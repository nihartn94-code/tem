-- ============================================================
-- Fix: Infinite recursion in users RLS policy
-- The original policy queried users to check admin status,
-- which triggered the same policy, causing recursion.
-- Solution: SECURITY DEFINER function bypasses RLS.
-- ============================================================

-- SECURITY DEFINER function to get current user's role
-- This bypasses RLS and prevents infinite recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::TEXT FROM users WHERE auth_user_id = auth.uid();
$$;

-- Revoke execute from anon (only authenticated users should call this)
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon;

-- Drop and recreate the users visibility policy using the new function
DROP POLICY IF EXISTS users_visibility ON users;
CREATE POLICY users_visibility ON users
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- Also fix other policies that query users table to check role
-- These won't cause recursion because they use SELECT subqueries,
-- but let's update them to use the function for consistency

-- manufacturer_catalog_visibility
DROP POLICY IF EXISTS manufacturer_catalog_visibility ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_visibility ON manufacturer_catalog
  FOR SELECT USING (
    public.get_current_user_role() IN ('MANUFACTURER', 'PHARMA_COMPANY', 'ADMIN')
  );

-- stockist_marketplace_visibility
DROP POLICY IF EXISTS stockist_marketplace_visibility ON stockist_marketplace;
CREATE POLICY stockist_marketplace_visibility ON stockist_marketplace
  FOR SELECT USING (
    public.get_current_user_role() IN ('STOCKIST', 'PHARMA_COMPANY', 'ADMIN')
  );

-- orders_participant_only
DROP POLICY IF EXISTS orders_participant_only ON orders;
CREATE POLICY orders_participant_only ON orders
  FOR SELECT USING (
    buyer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR seller_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR public.get_current_user_role() = 'ADMIN'
  );

-- compliance_self_or_admin
DROP POLICY IF EXISTS compliance_self_or_admin ON compliance_profiles;
CREATE POLICY compliance_self_or_admin ON compliance_profiles
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR public.get_current_user_role() = 'ADMIN'
  );

-- company_brands_visibility
DROP POLICY IF EXISTS company_brands_visibility ON company_brands;
CREATE POLICY company_brands_visibility ON company_brands
  FOR SELECT USING (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR public.get_current_user_role() = 'ADMIN'
  );

-- production_pools_visibility
DROP POLICY IF EXISTS production_pools_visibility ON production_pools;
CREATE POLICY production_pools_visibility ON production_pools
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM manufacturer_catalog mc
      WHERE mc.id = manufacturer_catalog_id
      AND mc.manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM production_pool_contributions ppc
      WHERE ppc.pool_id = production_pools.id
      AND ppc.company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    OR public.get_current_user_role() = 'ADMIN'
  );

-- pool_contributions_visibility
DROP POLICY IF EXISTS pool_contributions_visibility ON production_pool_contributions;
CREATE POLICY pool_contributions_visibility ON production_pool_contributions
  FOR SELECT USING (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM production_pools pp
      JOIN manufacturer_catalog mc ON mc.id = pp.manufacturer_catalog_id
      WHERE pp.id = pool_id
      AND mc.manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    OR public.get_current_user_role() = 'ADMIN'
  );

-- pool_contributions_update
DROP POLICY IF EXISTS pool_contributions_update ON production_pool_contributions;
CREATE POLICY pool_contributions_update ON production_pool_contributions
  FOR UPDATE USING (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR public.get_current_user_role() = 'ADMIN'
  );

-- dispute_tickets_visibility
DROP POLICY IF EXISTS dispute_tickets_visibility ON dispute_tickets;
CREATE POLICY dispute_tickets_visibility ON dispute_tickets
  FOR SELECT USING (
    raised_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR resolved_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR public.get_current_user_role() = 'ADMIN'
  );

-- audit_log_visibility
DROP POLICY IF EXISTS audit_log_visibility ON audit_log;
CREATE POLICY audit_log_visibility ON audit_log
  FOR SELECT USING (
    public.get_current_user_role() = 'ADMIN'
  );
