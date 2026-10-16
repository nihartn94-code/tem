-- ============================================================
-- Migration 011: Production hardening
-- Master doc compliance: §10 trust boundary, §14 authorization,
-- §25 idempotency + reliability, TC-07 "pool locks exactly once".
--
-- 1. contribute_to_pool: ONE atomic SQL operation — advisory-locked
--    find-or-create pool + contribution insert + atomic increment +
--    threshold lock. Replaces the JS read-then-write race in the
--    production-pool Edge Functions.
-- 2. orders.idempotency_key UNIQUE: retried checkout cannot create
--    duplicate orders (master doc §25).
-- 3. platform_settings_history: RLS enabled, ADMIN-only read, no
--    public INSERT/UPDATE — append-only by construction (only the
--    service role, via Edge Functions, can write).
-- 4. Service-RPC lockdown: decrement_stock / search_molecule_full /
--    increment_pool_quantity / contribute_to_pool are Edge-Function
--    internals (service role). Direct client EXECUTE revoked.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Atomic pool contribution
-- ------------------------------------------------------------
-- Serialize concurrent contributions against the same catalog entry.
-- One open pool per catalog entry is guaranteed by holding the
-- transaction-scoped advisory lock across find-or-create.
CREATE OR REPLACE FUNCTION public.contribute_to_pool(
  p_catalog_id UUID,
  p_company_id UUID,
  p_requested_quantity INTEGER,
  p_brand_name TEXT,
  p_packaging JSONB DEFAULT NULL,
  p_unit_cost NUMERIC DEFAULT NULL
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

  -- Serialize all pool operations for this catalog entry
  PERFORM pg_advisory_xact_lock(hashtext('pool:' || p_catalog_id::TEXT));

  -- Find or create the open pool (atomic under the advisory lock)
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

  -- Record the contribution (agreed_unit_cost is locked at contribution time)
  INSERT INTO production_pool_contributions
    (pool_id, company_id, requested_quantity, intended_brand_name, packaging_spec, agreed_unit_cost)
  VALUES
    (v_pool.id, p_company_id, p_requested_quantity, p_brand_name, p_packaging, p_unit_cost);

  -- Atomic increment (single statement — no read-then-write race)
  UPDATE production_pools
  SET accumulated_quantity = accumulated_quantity + p_requested_quantity
  WHERE id = v_pool.id
  RETURNING * INTO v_pool;

  -- Threshold lock — exactly once, guarded by status = 'open'
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

-- ------------------------------------------------------------
-- 2. Checkout idempotency
-- ------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
-- A retried checkout with the same key must never create a second order
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ------------------------------------------------------------
-- 3. platform_settings_history: append-only, ADMIN-readable
-- ------------------------------------------------------------
ALTER TABLE platform_settings_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_history_admin_read ON platform_settings_history
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );
-- No INSERT/UPDATE/DELETE policies: only the service role (Edge Functions) can write.

-- ------------------------------------------------------------
-- 4. Service-RPC lockdown (Edge Functions call these with the
--    service role; direct client calls bypass RLS and are forbidden)
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.decrement_stock(UUID, INTEGER) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_molecule_full(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_pool_quantity(UUID, INTEGER) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contribute_to_pool(UUID, UUID, INTEGER, TEXT, JSONB, NUMERIC) FROM anon, authenticated;
