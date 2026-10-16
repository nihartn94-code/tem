-- ============================================================
-- Migration 016: Realistic market data (idempotent)
-- Indian pharma market: 14 salts → 18 combos already seeded. Adds
-- brands, live marketplace listings with real-world pricing (₹/unit,
-- NLEM-aware), structured trade schemes, and a second manufacturer.
-- Safe to re-run (ON CONFLICT DO NOTHING / guarded inserts).
-- ============================================================

-- Additional salts (NLEM-flagged where applicable)
INSERT INTO chemical_salts (salt_name, therapeutic_category, nlem_price_capped) VALUES
  ('Amlodipine', 'Antihypertensive', true),
  ('Atorvastatin', 'Antihyperlipidemic', true),
  ('Pantoprazole', 'Proton Pump Inhibitor', true),
  ('Cetirizine', 'Antihistamine', false),
  ('Amoxicillin + Clavulanic Acid', 'Antibiotic', true),
  ('Azithromycin', 'Antibiotic', true),
  ('Levothyroxine', 'Thyroid Hormone', false)
ON CONFLICT (salt_name) DO NOTHING;

-- Combos (salt+strength anchors)
INSERT INTO formulation_combinations (combination_hash, display_composition) VALUES
  ('amlo5', 'Amlodipine 5mg'),
  ('amlo5+at40', 'Amlodipine 5mg + Atorvastatin 40mg'),
  ('panto40', 'Pantoprazole 40mg'),
  ('ceti10', 'Cetirizine 10mg'),
  ('amox500+clav125', 'Amoxicillin 500mg + Clavulanic Acid 125mg'),
  ('azi500', 'Azithromycin 500mg'),
  ('levo50', 'Levothyroxine 50mcg')
ON CONFLICT (combination_hash) DO NOTHING;

-- Bridges for the new combos
INSERT INTO combination_salt_bridge (combination_id, salt_id, strength_value, strength_unit)
SELECT fc.id, cs.id, v.strength, v.unit
FROM (VALUES
  ('amlo5', 'Amlodipine', 5, 'mg'),
  ('amlo5+at40', 'Amlodipine', 5, 'mg'),
  ('amlo5+at40', 'Atorvastatin', 40, 'mg'),
  ('panto40', 'Pantoprazole', 40, 'mg'),
  ('ceti10', 'Cetirizine', 10, 'mg'),
  ('amox500+clav125', 'Amoxicillin', 500, 'mg'),
  ('amox500+clav125', 'Amoxicillin + Clavulanic Acid', 125, 'mg'),
  ('azi500', 'Azithromycin', 500, 'mg'),
  ('levo50', 'Levothyroxine', 50, 'mcg')
) AS v(hash, salt_name, strength, unit)
JOIN formulation_combinations fc ON fc.combination_hash = v.hash
JOIN chemical_salts cs ON cs.salt_name = v.salt_name
ON CONFLICT DO NOTHING;

-- Second manufacturer user (profile only; auth user created via seed-users pattern)
INSERT INTO users (auth_user_id, role, phone_number, display_name, is_active)
SELECT u.id, 'MANUFACTURER', '+919000000005', 'MedQuest Labs Pvt Ltd', true
FROM auth.users u
WHERE u.email = 'mfg2@pharmaos.io'
ON CONFLICT (auth_user_id) DO NOTHING;

-- Catalog entries (manufacturer layer) — MOQ + factory-gate pricing
INSERT INTO manufacturer_catalog (manufacturer_id, combination_id, minimum_order_qty, factory_gate_unit_cost, lead_time_days)
SELECT u.id, fc.id, v.moq, v.cost, v.lead
FROM (VALUES
  ('amlo5', 50000, 0.95, 21),
  ('amlo5+at40', 20000, 2.10, 21),
  ('panto40', 30000, 1.40, 18),
  ('ceti10', 40000, 0.55, 15),
  ('azi500', 15000, 4.80, 25)
) AS v(hash, moq, cost, lead)
JOIN formulation_combinations fc ON fc.combination_hash = v.hash
JOIN users u ON u.display_name = 'Test Pharma Manufacturing' AND u.role = 'MANUFACTURER'
WHERE NOT EXISTS (
  SELECT 1 FROM manufacturer_catalog mc
  WHERE mc.combination_id = fc.id AND mc.manufacturer_id = u.id
);

INSERT INTO manufacturer_catalog (manufacturer_id, combination_id, minimum_order_qty, factory_gate_unit_cost, lead_time_days)
SELECT u.id, fc.id, v.moq, v.cost, v.lead
FROM (VALUES
  ('amox500+clav125', 10000, 6.20, 30),
  ('levo50', 25000, 1.15, 20),
  ('ceti10', 20000, 0.48, 12)
) AS v(hash, moq, cost, lead)
JOIN formulation_combinations fc ON fc.combination_hash = v.hash
JOIN users u ON u.display_name = 'MedQuest Labs Pvt Ltd' AND u.role = 'MANUFACTURER'
WHERE NOT EXISTS (
  SELECT 1 FROM manufacturer_catalog mc
  WHERE mc.combination_id = fc.id AND mc.manufacturer_id = u.id
);

-- Brands (Company layer) — realistic Indian brand names
INSERT INTO company_brands (company_id, combination_id, brand_name, is_verified_trademark)
SELECT u.id, fc.id, v.brand, true
FROM (VALUES
  ('amlo5', 'Amlopin-5'),
  ('amlo5+at40', 'Amlop-AT'),
  ('panto40', 'Pantop-40'),
  ('ceti10', 'Cetzine-10'),
  ('azi500', 'Azithral-500'),
  ('levo50', 'Thyronorm-50')
) AS v(hash, brand)
JOIN formulation_combinations fc ON fc.combination_hash = v.hash
JOIN users u ON u.role = 'PHARMA_COMPANY'
WHERE NOT EXISTS (SELECT 1 FROM company_brands cb WHERE cb.brand_name = v.brand AND cb.company_id = u.id);

-- Marketplace listings — wholesale pricing with margin over factory gate,
-- batch numbers, future expiry, structured trade schemes
INSERT INTO stockist_marketplace (brand_id, company_id, batch_number, expiry_date, wholesale_price_per_unit, available_stock_units, trade_scheme)
SELECT cb.id, cb.company_id, v.batch, v.expiry::date, v.price, v.stock,
       CASE WHEN v.scheme_buy IS NULL THEN NULL
            ELSE jsonb_build_object('buy', v.scheme_buy, 'get_free', v.scheme_get) END
FROM (VALUES
  ('Amlopin-5', 'AML2614A', '2027-09-30', 1.65, 25000, 10, 1),
  ('Amlop-AT', 'ALT2612B', '2027-08-31', 3.40, 12000, 10, 2),
  ('Pantop-40', 'PAN2609C', '2027-12-31', 2.25, 18000, 10, 1),
  ('Cetzine-10', 'CET2701A', '2027-01-31', 0.95, 30000, 20, 2),
  ('Azithral-500', 'AZI2608A', '2026-12-31', 7.90, 8000, NULL, NULL),
  ('Thyronorm-50', 'THY2611B', '2027-11-30', 1.85, 15000, NULL, NULL)
) AS v(brand, batch, expiry, price, stock, scheme_buy, scheme_get)
JOIN company_brands cb ON cb.brand_name = v.brand
WHERE NOT EXISTS (
  SELECT 1 FROM stockist_marketplace sm
  WHERE sm.brand_id = cb.id AND sm.batch_number = v.batch
);
