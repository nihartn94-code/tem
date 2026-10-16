-- 018: Enterprise hardening — privilege escalation, idempotency, integrity constraints
-- 1. P0: users_insert allowed any authenticated user to mint role='ADMIN'.
--    Roles must be self-selectable among non-admin roles only; ADMIN is created
--    exclusively via seed-users (service role bypasses RLS).
DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (
    auth_user_id = auth.uid()
    AND role IN ('MANUFACTURER', 'PHARMA_COMPANY', 'STOCKIST')
  );

-- 2. P2: pool contribution idempotency — a retried/timed-out contribution must
--    not double-increment. contribution_key carried client→EF→RPC; NULL keys
--    (legacy callers) are exempt from the unique index.
ALTER TABLE production_pool_contributions
  ADD COLUMN IF NOT EXISTS contribution_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pool_contributions_idem_key
  ON production_pool_contributions (pool_id, company_id, contribution_key)
  WHERE contribution_key IS NOT NULL;

-- 3. P4: CHECK constraints the EFs were enforcing alone (defense in depth)
ALTER TABLE platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_fee_bounds;
ALTER TABLE platform_settings
  ADD CONSTRAINT platform_settings_fee_bounds CHECK (
    global_fee_pct >= 0 AND global_fee_pct <= 100
    AND cash_velocity_discount_max_pct >= 0 AND cash_velocity_discount_max_pct <= 100
  );

ALTER TABLE stockist_marketplace
  DROP CONSTRAINT IF EXISTS marketplace_stock_nonneg;
ALTER TABLE stockist_marketplace
  ADD CONSTRAINT marketplace_stock_nonneg CHECK (available_stock_units >= 0);

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_qty_positive;
ALTER TABLE orders
  ADD CONSTRAINT orders_qty_positive CHECK (quantity > 0);

-- 4. P5: same batch listed twice doubles apparent stock
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_batch_unique
  ON stockist_marketplace (brand_id, batch_number);

-- 5. P3: hot-path indexes (search join, checkout compliant-seller probe, order detail)
CREATE INDEX IF NOT EXISTS company_brands_combination_idx ON company_brands (combination_id);
CREATE INDEX IF NOT EXISTS combination_salt_bridge_comb_idx ON combination_salt_bridge (combination_id);
CREATE INDEX IF NOT EXISTS combination_salt_bridge_salt_idx ON combination_salt_bridge (salt_id);
CREATE INDEX IF NOT EXISTS stockist_marketplace_company_idx ON stockist_marketplace (company_id);
CREATE INDEX IF NOT EXISTS orders_listing_idx ON orders (marketplace_listing_id);

-- 6. P2: contribution idempotency in the atomic RPC.
--    Unique-violation on (pool, company, key) returns current pool state with
--    just_locked=false — a retried contribution NEVER double-increments.
CREATE OR REPLACE FUNCTION public.contribute_to_pool(
  p_catalog_id UUID,
  p_company_id UUID,
  p_requested_quantity INTEGER,
  p_brand_name TEXT,
  p_packaging JSONB DEFAULT NULL,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_contribution_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  pool_id UUID,
  pool_status TEXT,
  acc_qty INTEGER,
  target_qty INTEGER,
  just_locked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool production_pools%ROWTYPE;
  v_locked BOOLEAN := false;
BEGIN
  IF p_requested_quantity IS NULL OR p_requested_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pool:' || p_catalog_id::TEXT));

  SELECT * INTO v_pool
  FROM production_pools
  WHERE manufacturer_catalog_id = p_catalog_id AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO production_pools (manufacturer_catalog_id, target_quantity, accumulated_quantity, status)
    VALUES (p_catalog_id, (SELECT minimum_order_qty FROM manufacturer_catalog WHERE id = p_catalog_id), 0, 'open')
    RETURNING * INTO v_pool;
  END IF;

  IF v_pool IS NULL OR v_pool.id IS NULL THEN
    RAISE EXCEPTION 'CATALOG_NOT_FOUND';
  END IF;

  BEGIN
    INSERT INTO production_pool_contributions
      (pool_id, company_id, requested_quantity, intended_brand_name, packaging_spec, agreed_unit_cost, contribution_key)
    VALUES
      (v_pool.id, p_company_id, p_requested_quantity, p_brand_name, p_packaging, p_unit_cost, p_contribution_key);
  EXCEPTION WHEN unique_violation THEN
    -- Idempotent replay: no second insert, no double increment
    RETURN QUERY SELECT v_pool.id, v_pool.status::TEXT, v_pool.accumulated_quantity, v_pool.target_quantity, false;
    RETURN;
  END;

  UPDATE production_pools
  SET accumulated_quantity = accumulated_quantity + p_requested_quantity
  WHERE id = v_pool.id
  RETURNING * INTO v_pool;

  IF v_pool.accumulated_quantity >= v_pool.target_quantity AND v_pool.status = 'open' THEN
    UPDATE production_pools
    SET status = 'locked', locked_at = now()
    WHERE id = v_pool.id AND status = 'open';
    v_pool.status := 'locked';
    v_locked := true;
  END IF;

  RETURN QUERY SELECT v_pool.id, v_pool.status::TEXT, v_pool.accumulated_quantity, v_pool.target_quantity, v_locked;
END;
$$;
