-- ============================================================
-- Migration 013: Security audit fixes (post full-codebase audit)
--
-- 1. RPC lockdown completion: REVOKE ... FROM PUBLIC. Postgres grants
--    EXECUTE to PUBLIC at creation; the 011/012 revokes from
--    anon/authenticated left the PUBLIC grant intact, so all service
--    RPCs remained callable by every client (verified live: anon
--    decremented stock). Helpers keep authenticated access because RLS
--    policies invoke them as the querying user.
-- 2. Compliance self-verification closed: client-facing UPDATE policy
--    dropped (users self-set verification_status='verified',
--    expiry=2099 in live test). Updates now admin-only via RLS;
--    resubmission flows through onboard-compliance (service role).
-- 3. Insert role checks: only MANUFACTURER writes manufacturer_catalog,
--    only PHARMA_COMPANY writes company_brands/stockist_marketplace
--    (inserts previously allowed any role → layer isolation gap).
-- 4. Dispute visibility: both order participants (buyer + seller) can
--    see tickets on their orders, not only the raising party.
-- 5. Self-signup made viable: users INSERT policy for own row (signup
--    previously produced zombie auth accounts — no profile write path).
-- 6. SET search_path pinned on the remaining SECURITY DEFINER functions
--    (decrement_stock, search_molecule_full) — search-path injection
--    class closed for all SECURITY DEFINER functions.
-- 7. Audit/forensics indexes for pool and dispute hot paths.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Complete RPC lockdown (FROM PUBLIC)
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.decrement_stock(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_molecule_full(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_pool_quantity(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contribute_to_pool(UUID, UUID, INTEGER, TEXT, JSONB, NUMERIC) FROM PUBLIC;

-- Helper functions used inside RLS policies: authenticated MUST keep
-- EXECUTE (policies run as the invoking user); anon loses it (fail-closed).
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_pool_manufacturer(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_pool_contributor(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_contribution_pool_manufacturer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pool_manufacturer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pool_contributor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_contribution_pool_manufacturer(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 2. Compliance: admin-only UPDATE (self-verification closed)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS compliance_profiles_update ON compliance_profiles;
CREATE POLICY compliance_profiles_admin_update ON compliance_profiles
  FOR UPDATE
  USING ((SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN')
  WITH CHECK ((SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN');

-- ------------------------------------------------------------
-- 3. Insert role checks (layer isolation at the write path)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS manufacturer_catalog_insert ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_insert ON manufacturer_catalog
  FOR INSERT WITH CHECK (
    manufacturer_id = public.get_current_user_id()
    AND (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'MANUFACTURER'
  );

DROP POLICY IF EXISTS company_brands_insert ON company_brands;
CREATE POLICY company_brands_insert ON company_brands
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
    AND (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'PHARMA_COMPANY'
  );

DROP POLICY IF EXISTS stockist_marketplace_insert ON stockist_marketplace;
CREATE POLICY stockist_marketplace_insert ON stockist_marketplace
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
    AND (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'PHARMA_COMPANY'
  );

-- ------------------------------------------------------------
-- 4. Dispute visibility for both order participants
-- ------------------------------------------------------------
DROP POLICY IF EXISTS dispute_tickets_visibility ON dispute_tickets;
CREATE POLICY dispute_tickets_visibility ON dispute_tickets
  FOR SELECT USING (
    raised_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR resolved_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR order_id IN (
      SELECT id FROM orders
      WHERE buyer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
         OR seller_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- ------------------------------------------------------------
-- 5. Self-signup profile creation (no more zombie auth accounts)
-- ------------------------------------------------------------
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- ------------------------------------------------------------
-- 6. search_path pinning for the remaining SECURITY DEFINER functions
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrement_stock(listing_id UUID, qty INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  IF qty <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT available_stock_units INTO current_stock
  FROM stockist_marketplace
  WHERE id = listing_id
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN FALSE;
  END IF;

  IF current_stock < qty THEN
    RETURN FALSE;
  END IF;

  UPDATE stockist_marketplace
  SET available_stock_units = available_stock_units - qty,
      updated_at = now()
  WHERE id = listing_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Stock compensation for checkout rollback (service-role only)
CREATE OR REPLACE FUNCTION public.increment_stock(listing_id UUID, qty INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  IF qty <= 0 THEN
    RETURN FALSE;
  END IF;
  UPDATE stockist_marketplace
  SET available_stock_units = available_stock_units + qty,
      updated_at = now()
  WHERE id = listing_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.search_molecule_full(search_query TEXT)
RETURNS TABLE (
  combination_id UUID,
  display_composition TEXT,
  offer_brand_id UUID,
  offer_brand_name TEXT,
  offer_company_id UUID,
  offer_price NUMERIC,
  offer_stock INTEGER,
  offer_trade_scheme JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id AS combination_id,
    fc.display_composition,
    cb.id AS offer_brand_id,
    cb.brand_name AS offer_brand_name,
    sm.company_id AS offer_company_id,
    sm.wholesale_price_per_unit AS offer_price,
    sm.available_stock_units AS offer_stock,
    sm.trade_scheme AS offer_trade_scheme
  FROM formulation_combinations fc
  JOIN company_brands cb ON cb.combination_id = fc.id
  JOIN stockist_marketplace sm ON sm.brand_id = cb.id
  JOIN active_compliant_users acu ON acu.user_id = sm.company_id
  LEFT JOIN chemical_salts cs ON EXISTS (
    SELECT 1 FROM combination_salt_bridge csb
    WHERE csb.combination_id = fc.id AND csb.salt_id = cs.id
  )
  WHERE sm.available_stock_units > 0
    AND (
      similarity(fc.display_composition, search_query) > 0.1
      OR similarity(cb.brand_name, search_query) > 0.1
      OR similarity(COALESCE(cs.salt_name, ''), search_query) > 0.1
      OR fc.display_composition ILIKE '%' || search_query || '%'
      OR cb.brand_name ILIKE '%' || search_query || '%'
    )
  ORDER BY sm.wholesale_price_per_unit ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- Revoke the recreated/relisted service functions again (recreation
-- resets ACLs to defaults incl. PUBLIC)
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.decrement_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_molecule_full(TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 7. Hot-path indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pools_catalog_status ON production_pools(manufacturer_catalog_id, status);
CREATE INDEX IF NOT EXISTS idx_pool_contributions_pool ON production_pool_contributions(pool_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON dispute_tickets(order_id);
