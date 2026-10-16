-- ============================================================
-- FIX: Recreate all RLS policies dropped by DROP FUNCTION CASCADE
-- Migration 006 dropped functions with CASCADE, which also dropped
-- all RLS policies that referenced those functions.
-- With RLS enabled but no policies, Postgres denies ALL queries.
-- ============================================================

-- Users: own profile or admin
DROP POLICY IF EXISTS users_visibility ON users;
CREATE POLICY users_visibility ON users
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- Manufacturer catalog: visible to MANUFACTURER, PHARMA_COMPANY, ADMIN — never STOCKIST
DROP POLICY IF EXISTS manufacturer_catalog_visibility ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_visibility ON manufacturer_catalog
  FOR SELECT USING (
    public.get_current_user_role() IN ('MANUFACTURER', 'PHARMA_COMPANY', 'ADMIN')
  );

DROP POLICY IF EXISTS manufacturer_catalog_insert ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_insert ON manufacturer_catalog
  FOR INSERT WITH CHECK (
    manufacturer_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS manufacturer_catalog_update ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_update ON manufacturer_catalog
  FOR UPDATE USING (
    manufacturer_id = public.get_current_user_id()
  );

-- Stockist marketplace: visible to STOCKIST, PHARMA_COMPANY, ADMIN
DROP POLICY IF EXISTS stockist_marketplace_visibility ON stockist_marketplace;
CREATE POLICY stockist_marketplace_visibility ON stockist_marketplace
  FOR SELECT USING (
    public.get_current_user_role() IN ('STOCKIST', 'PHARMA_COMPANY', 'ADMIN')
  );

DROP POLICY IF EXISTS stockist_marketplace_insert ON stockist_marketplace;
CREATE POLICY stockist_marketplace_insert ON stockist_marketplace
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS stockist_marketplace_update ON stockist_marketplace;
CREATE POLICY stockist_marketplace_update ON stockist_marketplace
  FOR UPDATE USING (
    company_id = public.get_current_user_id()
  );

-- Orders: participant or admin only
DROP POLICY IF EXISTS orders_participant_only ON orders;
CREATE POLICY orders_participant_only ON orders
  FOR SELECT USING (
    buyer_id = public.get_current_user_id()
    OR seller_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- Compliance profiles: self or admin
DROP POLICY IF EXISTS compliance_self_or_admin ON compliance_profiles;
CREATE POLICY compliance_self_or_admin ON compliance_profiles
  FOR SELECT USING (
    user_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS compliance_profiles_insert ON compliance_profiles;
CREATE POLICY compliance_profiles_insert ON compliance_profiles
  FOR INSERT WITH CHECK (
    user_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS compliance_profiles_update ON compliance_profiles;
CREATE POLICY compliance_profiles_update ON compliance_profiles
  FOR UPDATE USING (
    user_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- Company brands: owner, or admin
DROP POLICY IF EXISTS company_brands_visibility ON company_brands;
CREATE POLICY company_brands_visibility ON company_brands
  FOR SELECT USING (
    company_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS company_brands_insert ON company_brands;
CREATE POLICY company_brands_insert ON company_brands
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS company_brands_update ON company_brands;
CREATE POLICY company_brands_update ON company_brands
  FOR UPDATE USING (
    company_id = public.get_current_user_id()
  );

-- Production pools: manufacturer, contributing companies, or admin
DROP POLICY IF EXISTS production_pools_visibility ON production_pools;
CREATE POLICY production_pools_visibility ON production_pools
  FOR SELECT USING (
    public.is_pool_manufacturer(id)
    OR public.is_pool_contributor(id)
    OR public.get_current_user_role() = 'ADMIN'
  );

-- Pool contributions: contributing company, pool manufacturer, or admin
DROP POLICY IF EXISTS pool_contributions_visibility ON production_pool_contributions;
CREATE POLICY pool_contributions_visibility ON production_pool_contributions
  FOR SELECT USING (
    company_id = public.get_current_user_id()
    OR public.is_contribution_pool_manufacturer(pool_id)
    OR public.get_current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS pool_contributions_insert ON production_pool_contributions;
CREATE POLICY pool_contributions_insert ON production_pool_contributions
  FOR INSERT WITH CHECK (
    company_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS pool_contributions_update ON production_pool_contributions;
CREATE POLICY pool_contributions_update ON production_pool_contributions
  FOR UPDATE USING (
    company_id = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- Dispute tickets: participant, or admin
DROP POLICY IF EXISTS dispute_tickets_visibility ON dispute_tickets;
CREATE POLICY dispute_tickets_visibility ON dispute_tickets
  FOR SELECT USING (
    raised_by = public.get_current_user_id()
    OR resolved_by = public.get_current_user_id()
    OR public.get_current_user_role() = 'ADMIN'
  );

-- Platform settings: readable by all authenticated users
DROP POLICY IF EXISTS platform_settings_visibility ON platform_settings;
CREATE POLICY platform_settings_visibility ON platform_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Audit log: admin only
DROP POLICY IF EXISTS audit_log_visibility ON audit_log;
CREATE POLICY audit_log_visibility ON audit_log
  FOR SELECT USING (
    public.get_current_user_role() = 'ADMIN'
  );
