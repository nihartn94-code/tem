-- ============================================================
-- Fix: Additional infinite recursion in production_pools,
-- pool_contributions, and other cross-table policies
-- The previous fix handled role checks via get_current_user_role(),
-- but ownership checks still query users through other tables.
-- Solution: SECURITY DEFINER function for user ID lookup too.
-- ============================================================

-- SECURITY DEFINER function to get current user's internal ID
-- Bypasses RLS on users table to prevent recursion
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM anon;

-- ============================================================
-- Fix all policies that use (SELECT id FROM users WHERE auth_user_id = auth.uid())
-- Replace with public.get_current_user_id() to bypass RLS
-- ============================================================

-- manufacturer_catalog_insert
DROP POLICY IF EXISTS manufacturer_catalog_insert ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_insert ON manufacturer_catalog
  FOR INSERT WITH CHECK (
    manufacturer_id = public.get_current_user_id()
  );

-- manufacturer_catalog_update
DROP POLICY IF EXISTS manufacturer_catalog_update ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_update ON manufacturer_catalog
  FOR UPDATE USING (
    manufacturer_id = public.get_current_user_id()
  );

-- stockist_marketplace_insert
DROP POLICY IF EXISTS stockist_marketplace_insert ON stockist_marketplace;
CREATE POLICY stockist_marketplace_insert ON stockist_marketplace
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
  );

-- stockist_marketplace_update
DROP POLICY IF EXISTS stockist_marketplace_update ON stockist_marketplace;
CREATE POLICY stockist_marketplace_update ON stockist_marketplace
  FOR UPDATE USING (
    company_id = public.get_current_user_id()
  );

-- orders_participant_only (also fix ownership checks)
DROP POLICY IF EXISTS orders_participant_only ON orders;
CREATE POLICY orders_participant_only ON orders
  FOR SELECT USING (
    buyer_id = public.get_current_user_id()
    OR seller_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- compliance_self_or_admin
DROP POLICY IF EXISTS compliance_self_or_admin ON compliance_profiles;
CREATE POLICY compliance_self_or_admin ON compliance_profiles
  FOR SELECT USING (
    user_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- compliance_profiles_insert
DROP POLICY IF EXISTS compliance_profiles_insert ON compliance_profiles;
CREATE POLICY compliance_profiles_insert ON compliance_profiles
  FOR INSERT WITH CHECK (
    user_id = public.get_current_user_id()
  );

-- compliance_profiles_update
DROP POLICY IF EXISTS compliance_profiles_update ON compliance_profiles;
CREATE POLICY compliance_profiles_update ON compliance_profiles
  FOR UPDATE USING (
    user_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- company_brands_visibility
DROP POLICY IF EXISTS company_brands_visibility ON company_brands;
CREATE POLICY company_brands_visibility ON company_brands
  FOR SELECT USING (
    company_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- company_brands_insert
DROP POLICY IF EXISTS company_brands_insert ON company_brands;
CREATE POLICY company_brands_insert ON company_brands
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
  );

-- company_brands_update
DROP POLICY IF EXISTS company_brands_update ON company_brands;
CREATE POLICY company_brands_update ON company_brands
  FOR UPDATE USING (
    company_id = public.get_current_user_id()
  );

-- production_pools_visibility (remove cross-table queries that cause recursion)
DROP POLICY IF EXISTS production_pools_visibility ON production_pools;
CREATE POLICY production_pools_visibility ON production_pools
  FOR SELECT USING (
    manufacturer_catalog_id IN (
      SELECT id FROM manufacturer_catalog WHERE manufacturer_id = public.get_current_user_id()
    )
    OR id IN (
      SELECT pool_id FROM production_pool_contributions WHERE company_id = public.get_current_user_id()
    )
    OR public.get_current_user_role() = 'ADMIN'
  );

-- pool_contributions_visibility
DROP POLICY IF EXISTS pool_contributions_visibility ON production_pool_contributions;
CREATE POLICY pool_contributions_visibility ON production_pool_contributions
  FOR SELECT USING (
    company_id = public.get_current_user_id()
    OR pool_id IN (
      SELECT pp.id FROM production_pools pp
      JOIN manufacturer_catalog mc ON mc.id = pp.manufacturer_catalog_id
      WHERE mc.manufacturer_id = public.get_current_user_id()
    )
    OR public.get_current_user_role() = 'ADMIN'
  );

-- pool_contributions_insert
DROP POLICY IF EXISTS pool_contributions_insert ON production_pool_contributions;
CREATE POLICY pool_contributions_insert ON production_pool_contributions
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
  );

-- pool_contributions_update
DROP POLICY IF EXISTS pool_contributions_update ON production_pool_contributions;
CREATE POLICY pool_contributions_update ON production_pool_contributions
  FOR UPDATE USING (
    company_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- dispute_tickets_visibility
DROP POLICY IF EXISTS dispute_tickets_visibility ON dispute_tickets;
CREATE POLICY dispute_tickets_visibility ON dispute_tickets
  FOR SELECT USING (
    raised_by = public.get_current_user_id()
    OR resolved_by = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );
