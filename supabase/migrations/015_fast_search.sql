-- ============================================================
-- Migration 015: Hot-path search consolidation
-- One RPC call resolves caller role + runs the scoped search instead of
-- the Edge Function doing profile-fetch then search (two internal
-- round-trips). SECURITY DEFINER resolves the caller from p_auth_uid
-- (the Edge Function extracts it from the locally-verified JWT).
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_molecule_scoped(search_query TEXT, p_auth_uid UUID)
RETURNS TABLE (
  combination_id UUID,
  display_composition TEXT,
  offer_type TEXT,
  brand_id UUID,
  brand_name TEXT,
  company_id UUID,
  price_per_unit NUMERIC,
  available_stock INTEGER,
  trade_scheme JSONB,
  minimum_order_qty INTEGER,
  lead_time_days INTEGER
) AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM users WHERE auth_user_id = p_auth_uid;

  -- Brand + marketplace offers: STOCKIST / PHARMA_COMPANY / ADMIN (§4 matrix)
  IF caller_role IN ('STOCKIST', 'PHARMA_COMPANY', 'ADMIN') THEN
    RETURN QUERY
    SELECT
      fc.id, fc.display_composition,
      'MARKETPLACE'::TEXT,
      cb.id, cb.brand_name, sm.company_id,
      sm.wholesale_price_per_unit, sm.available_stock_units, sm.trade_scheme,
      NULL::INTEGER, NULL::INTEGER
    FROM formulation_combinations fc
    JOIN company_brands cb ON cb.combination_id = fc.id
    JOIN stockist_marketplace sm ON sm.brand_id = cb.id
    JOIN active_compliant_users acu ON acu.user_id = sm.company_id
    WHERE sm.available_stock_units > 0
      AND (
        similarity(fc.display_composition, search_query) > 0.1
        OR similarity(cb.brand_name, search_query) > 0.1
        OR fc.display_composition ILIKE '%' || search_query || '%'
        OR cb.brand_name ILIKE '%' || search_query || '%'
      );
  END IF;

  -- Manufacturer layer: only MANUFACTURER / PHARMA_COMPANY / ADMIN (§4)
  IF caller_role IN ('MANUFACTURER', 'PHARMA_COMPANY', 'ADMIN') THEN
    RETURN QUERY
    SELECT
      fc.id, fc.display_composition,
      'MANUFACTURER'::TEXT,
      NULL::UUID, NULL::TEXT, NULL::UUID,
      mc.factory_gate_unit_cost, NULL::INTEGER, NULL::JSONB,
      mc.minimum_order_qty, mc.lead_time_days
    FROM formulation_combinations fc
    JOIN manufacturer_catalog mc ON mc.combination_id = fc.id
    JOIN active_compliant_users acu ON acu.user_id = mc.manufacturer_id
    WHERE mc.is_active
      AND (
        similarity(fc.display_composition, search_query) > 0.1
        OR fc.display_composition ILIKE '%' || search_query || '%'
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.search_molecule_scoped(TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- Compliance-join index for the catalog hot path
CREATE INDEX IF NOT EXISTS idx_catalog_combination ON manufacturer_catalog(combination_id) WHERE is_active;
