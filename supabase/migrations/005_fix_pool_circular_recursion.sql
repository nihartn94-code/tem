-- ============================================================
-- Fix: Circular recursion between production_pools ↔ production_pool_contributions
-- Both policies query each other, causing infinite recursion.
-- Solution: SECURITY DEFINER functions that bypass RLS entirely.
-- ============================================================

-- Helper: Check if current user is manufacturer of a pool's catalog entry
CREATE OR REPLACE FUNCTION public.is_pool_manufacturer(pool_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM production_pools pp
    JOIN manufacturer_catalog mc ON mc.id = pp.manufacturer_catalog_id
    WHERE pp.id = $1
    AND mc.manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_pool_manufacturer(UUID) FROM anon;

-- Helper: Check if current user has contributed to a pool
CREATE OR REPLACE FUNCTION public.is_pool_contributor(pool_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM production_pool_contributions
    WHERE pool_id = pool_uuid
    AND company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_pool_contributor(UUID) FROM anon;

-- Helper: Check if current user is manufacturer of a contribution's pool
CREATE OR REPLACE FUNCTION public.is_contribution_pool_manufacturer(contrib_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM production_pool_contributions ppc
    JOIN production_pools pp ON pp.id = ppc.pool_id
    JOIN manufacturer_catalog mc ON mc.id = pp.manufacturer_catalog_id
    WHERE ppc.pool_id = contrib_pool_id
    AND mc.manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_contribution_pool_manufacturer(UUID) FROM anon;

-- ============================================================
-- Recreate production_pools visibility using helper functions
-- ============================================================
DROP POLICY IF EXISTS production_pools_visibility ON production_pools;
CREATE POLICY production_pools_visibility ON production_pools
  FOR SELECT USING (
    public.is_pool_manufacturer(id)
    OR public.is_pool_contributor(id)
    OR public.get_current_user_role() = 'ADMIN'
  );

-- ============================================================
-- Recreate production_pool_contributions visibility using helper functions
-- ============================================================
DROP POLICY IF EXISTS pool_contributions_visibility ON production_pool_contributions;
CREATE POLICY pool_contributions_visibility ON production_pool_contributions
  FOR SELECT USING (
    company_id = public.get_current_user_id()
    OR public.is_contribution_pool_manufacturer(pool_id)
    OR public.get_current_user_role() = 'ADMIN'
  );
