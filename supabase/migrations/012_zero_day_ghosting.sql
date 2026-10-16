-- ============================================================
-- Migration 012: Zero-day license-expiry gating (§7/§11)
-- Master doc: "active_compliant_users — Single choke-point for the
-- zero-day license-expiry check — Joined by every listing-visibility
-- query." Live testing exposed that listing RLS checked role only —
-- an expired-license seller's listings stayed visible. Fixed here at
-- the database layer (not in app code) per the enforcement-layer rule.
-- Also: search_molecule_full (SECURITY DEFINER) now joins the view, and
-- §30 troubleshooting row "expired listings still visible" is closed.
-- ============================================================

-- Marketplace: seller (company) must be active+verified+unexpired
DROP POLICY IF EXISTS stockist_marketplace_visibility ON stockist_marketplace;
CREATE POLICY stockist_marketplace_visibility ON stockist_marketplace
  FOR SELECT USING (
    public.get_current_user_role() IN ('STOCKIST', 'PHARMA_COMPANY', 'ADMIN')
    AND (
      public.get_current_user_role() = 'ADMIN'
      OR EXISTS (SELECT 1 FROM active_compliant_users acu WHERE acu.user_id = company_id)
    )
  );

-- Manufacturer catalog: manufacturer must be active+verified+unexpired
-- (WHO-GMP/licensed manufacturers only — §4 role matrix + §43)
DROP POLICY IF EXISTS manufacturer_catalog_visibility ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_visibility ON manufacturer_catalog
  FOR SELECT USING (
    public.get_current_user_role() IN ('MANUFACTURER', 'PHARMA_COMPANY', 'ADMIN')
    AND (
      public.get_current_user_role() = 'ADMIN'
      OR EXISTS (SELECT 1 FROM active_compliant_users acu WHERE acu.user_id = manufacturer_id)
    )
  );

-- search_molecule_full bypasses RLS (SECURITY DEFINER) — apply the same
-- choke-point directly so molecule search can never surface ghosted offers.
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
  -- §7 zero-day ghosting: only offers from compliant sellers
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.search_molecule_full(TEXT) FROM anon, authenticated;
