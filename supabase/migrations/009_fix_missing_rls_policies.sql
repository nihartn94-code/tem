-- ============================================================
-- FIX: Missing RLS policies for public reference tables
-- and fix company_brands visibility for Stockist browsing
-- ============================================================

-- Chemical salts: public reference database (SRS §3.2) - visible to all authenticated users
ALTER TABLE chemical_salts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chemical_salts_visibility ON chemical_salts;
CREATE POLICY chemical_salts_visibility ON chemical_salts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Formulation combinations: public reference database (SRS §3.2) - visible to all authenticated users
ALTER TABLE formulation_combinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS formulation_combinations_visibility ON formulation_combinations;
CREATE POLICY formulation_combinations_visibility ON formulation_combinations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Combination salt bridge: visible to all authenticated users (needed for search)
ALTER TABLE combination_salt_bridge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS combination_salt_bridge_visibility ON combination_salt_bridge;
CREATE POLICY combination_salt_bridge_visibility ON combination_salt_bridge
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Company brands: visible to all authenticated users (public commercial info per SRS §3.2)
-- The stockist needs to see brand names when browsing marketplace listings
DROP POLICY IF EXISTS company_brands_visibility ON company_brands;
CREATE POLICY company_brands_visibility ON company_brands
  FOR SELECT USING (auth.uid() IS NOT NULL);
