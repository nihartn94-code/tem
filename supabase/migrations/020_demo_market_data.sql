-- 020: Demo market data seeding — idempotent, user-independent ordering fix.
-- 016's catalog/brand/listing inserts joined on users that don't exist at
-- migration time on a FRESH database (migrations run before seed-users) —
-- they silently matched zero rows. This function is called by the seed-users
-- Edge Function AFTER auth users exist, so every environment (local reset,
-- fresh cloud) gets complete demo data. Safe to call repeatedly (NOT EXISTS
-- guards everywhere).

CREATE OR REPLACE FUNCTION public.seed_demo_market_data()
RETURNS TABLE (catalogs INT, brands INT, listings INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalogs INT := 0;
  v_brands INT := 0;
  v_listings INT := 0;
BEGIN
  -- Manufacturer catalog: Test Pharma Manufacturing (5) + MedQuest Labs (3)
  WITH ins AS (
    INSERT INTO manufacturer_catalog (manufacturer_id, combination_id, minimum_order_qty, factory_gate_unit_cost, lead_time_days)
    SELECT u.id, fc.id, v.moq, v.cost, v.lead
    FROM (VALUES
      ('amlo5', 50000, 0.95, 21),
      ('amlo5+at40', 20000, 2.10, 21),
      ('panto40', 30000, 1.40, 18),
      ('ceti10', 40000, 0.55, 15),
      ('azi500', 15000, 4.80, 25),
      ('amox500+clav125', 10000, 6.20, 30),
      ('levo50', 25000, 1.15, 20),
      ('ceti10', 20000, 0.48, 12)
    ) AS v(hash, moq, cost, lead)
    JOIN formulation_combinations fc ON fc.combination_hash = v.hash
    JOIN users u ON u.display_name IN ('Test Pharma Manufacturing', 'MedQuest Labs Pvt Ltd')
                AND u.role = 'MANUFACTURER'
    WHERE NOT EXISTS (
      SELECT 1 FROM manufacturer_catalog mc
      WHERE mc.combination_id = fc.id AND mc.manufacturer_id = u.id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_catalogs FROM ins;

  -- Brands (Company layer)
  WITH ins AS (
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
    WHERE NOT EXISTS (SELECT 1 FROM company_brands cb WHERE cb.brand_name = v.brand AND cb.company_id = u.id)
    RETURNING 1
  )
  SELECT count(*) INTO v_brands FROM ins;

  -- Marketplace listings — priced with margin over factory gate, future expiry,
  -- structured trade schemes. Requires brands to exist.
  WITH ins AS (
    INSERT INTO stockist_marketplace (brand_id, company_id, batch_number, expiry_date, wholesale_price_per_unit, available_stock_units, trade_scheme)
    SELECT cb.id, cb.company_id, v.batch, (now() + interval '18 months')::date, v.price, v.stock, v.scheme::JSONB
    FROM (VALUES
      ('Amlopin-5',   'AMLO5-2026A', 1.40, 30000, '{"buy":20,"get":2}'),
      ('Amlop-AT',    'AMAT40-2026A', 3.10, 20000, NULL),
      ('Pantop-40',   'PANTO40-2026A', 2.05, 25000, '{"buy":10,"get":1}'),
      ('Cetzine-10',  'CETZ10-2026A', 0.95, 40000, NULL),
      ('Azithral-500','AZI500-2026A', 6.90, 12000, '{"buy":5,"get":1}'),
      ('Thyronorm-50','THYRO50-2026A', 1.85, 22000, NULL)
    ) AS v(brand, batch, price, stock, scheme)
    JOIN company_brands cb ON cb.brand_name = v.brand
    WHERE NOT EXISTS (
      SELECT 1 FROM stockist_marketplace sm
      WHERE sm.brand_id = cb.id AND sm.batch_number = v.batch
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_listings FROM ins;

  RETURN QUERY SELECT v_catalogs, v_brands, v_listings;
END;
$$;
