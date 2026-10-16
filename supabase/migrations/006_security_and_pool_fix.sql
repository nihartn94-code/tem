-- ============================================================
-- Fix: Add SET search_path = public to all SECURITY DEFINER functions
-- This prevents search_path injection attacks
-- NOTE: Uses CREATE OR REPLACE only — never DROP ... CASCADE
-- because CASCADE silently drops all dependent RLS policies
-- ============================================================

-- get_current_user_role: SECURITY DEFINER with SET search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::TEXT FROM users WHERE auth_user_id = auth.uid();
$$;

-- get_current_user_id: SECURITY DEFINER with SET search_path
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid();
$$;

-- is_pool_manufacturer: SECURITY DEFINER with SET search_path
CREATE OR REPLACE FUNCTION public.is_pool_manufacturer(pool_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM production_pools pp
    JOIN manufacturer_catalog mc ON mc.id = pp.manufacturer_catalog_id
    WHERE pp.id = pool_uuid
    AND mc.manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );
$$;

-- is_pool_contributor: SECURITY DEFINER with SET search_path
CREATE OR REPLACE FUNCTION public.is_pool_contributor(pool_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM production_pool_contributions
    WHERE pool_id = pool_uuid
    AND company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );
$$;

-- is_contribution_pool_manufacturer: SECURITY DEFINER with SET search_path
CREATE OR REPLACE FUNCTION public.is_contribution_pool_manufacturer(contrib_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM production_pool_contributions ppc
    JOIN production_pools pp ON pp.id = ppc.pool_id
    JOIN manufacturer_catalog mc ON mc.id = pp.manufacturer_catalog_id
    WHERE ppc.pool_id = contrib_pool_id
    AND mc.manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );
$$;

-- increment_pool_quantity: RPC used by production-pool contribution flow
CREATE OR REPLACE FUNCTION increment_pool_quantity(pool_id UUID, qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE production_pools
  SET accumulated_quantity = accumulated_quantity + qty
  WHERE id = pool_id;
END;
$$;

-- Revoke execute from anon for all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_pool_manufacturer(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_pool_contributor(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_contribution_pool_manufacturer(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_pool_quantity(UUID, INTEGER) FROM anon;
