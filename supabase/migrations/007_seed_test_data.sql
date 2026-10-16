-- ============================================================
-- Seed Test Data for E2E Testing (IDEMPOTENT)
-- Creates: molecules, combinations, salt bridges
-- Users are created via the seed-users Edge Function
-- ============================================================

-- 1. Chemical salts (idempotent)
INSERT INTO chemical_salts (salt_name, therapeutic_category, nlem_price_capped)
VALUES
  ('Metformin', 'Antidiabetic', false),
  ('Paracetamol', 'Analgesic', true),
  ('Amoxicillin', 'Antibiotic', false)
ON CONFLICT (salt_name) DO NOTHING;

-- 2. Formulation combinations (idempotent)
INSERT INTO formulation_combinations (combination_hash, display_composition)
VALUES
  ('MET500', 'Metformin 500mg'),
  ('PAR500', 'Paracetamol 500mg'),
  ('AMO500', 'Amoxicillin 500mg')
ON CONFLICT (combination_hash) DO NOTHING;

-- 3. Combination-salt bridges (idempotent)
INSERT INTO combination_salt_bridge (combination_id, salt_id, strength_value, strength_unit)
SELECT fc.id, cs.id, 500, 'mg'
FROM formulation_combinations fc, chemical_salts cs
WHERE fc.combination_hash = 'MET500' AND cs.salt_name = 'Metformin'
AND NOT EXISTS (
  SELECT 1 FROM combination_salt_bridge csb
  WHERE csb.combination_id = fc.id AND csb.salt_id = cs.id
);

-- 4. Insert default platform_settings if not exists
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
