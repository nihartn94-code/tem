-- ============================================================
-- PharmaOS — Complete Database Migration
-- Based on 03-DATABASE-SCHEMA.md v1.0
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'MANUFACTURER', 'PHARMA_COMPANY', 'STOCKIST');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_state AS ENUM (
    'POOLING_ACTIVE', 'BATCH_LOCKED', 'IN_PRODUCTION', 'DISPATCHED',
    'DELIVERED_PENDING_SCAN', 'DELIVERED_CONFIRMED', 'DISPUTED', 'SETTLED', 'REFUNDED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_channel AS ENUM ('ESCROW_INSTANT', 'NBFC_CREDIT_LINE', 'STANDARD_CREDIT_TERMS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_reason AS ENUM ('BATCH_MISMATCH', 'LATE_DELIVERY', 'QUALITY_ISSUE', 'QUANTITY_MISMATCH', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_resolution AS ENUM ('PENDING', 'RELEASED_TO_SELLER', 'REFUNDED_TO_BUYER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 1. IDENTITY & COMPLIANCE (SRS §3.1)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL,
  role user_role NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  legal_entity_name TEXT NOT NULL,
  gstin TEXT UNIQUE NOT NULL,
  drug_license_number TEXT UNIQUE NOT NULL,
  drug_license_expiry DATE NOT NULL,
  who_gmp_certified BOOLEAN DEFAULT false,
  license_doc_storage_path TEXT,
  gmp_cert_storage_path TEXT,
  facility_lat DOUBLE PRECISION NOT NULL,
  facility_lng DOUBLE PRECISION NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_expiry ON compliance_profiles(drug_license_expiry);

-- SRS §3.1 Zero-Day Regulatory Ghosting view
CREATE OR REPLACE VIEW active_compliant_users AS
  SELECT u.id AS user_id, u.role
  FROM users u
  JOIN compliance_profiles cp ON cp.user_id = u.id
  WHERE u.is_active = true
    AND cp.verification_status = 'verified'
    AND cp.drug_license_expiry >= CURRENT_DATE;

-- ============================================================
-- 2. MOLECULE-FIRST MASTER DATABASE (SRS §3.2)
-- ============================================================
CREATE TABLE IF NOT EXISTS chemical_salts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salt_name TEXT UNIQUE NOT NULL,
  therapeutic_category TEXT,
  nlem_price_capped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salts_trgm ON chemical_salts USING gin (salt_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS formulation_combinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_hash TEXT UNIQUE NOT NULL,
  display_composition TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS combination_salt_bridge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_id UUID NOT NULL REFERENCES formulation_combinations(id) ON DELETE CASCADE,
  salt_id UUID NOT NULL REFERENCES chemical_salts(id) ON DELETE RESTRICT,
  strength_value NUMERIC(10,2) NOT NULL,
  strength_unit TEXT NOT NULL DEFAULT 'mg'
);

-- ============================================================
-- 3. MANUFACTURER CATALOG (SRS §3.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS manufacturer_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  combination_id UUID NOT NULL REFERENCES formulation_combinations(id) ON DELETE RESTRICT,
  minimum_order_qty INTEGER NOT NULL,
  factory_gate_unit_cost NUMERIC(12,4) NOT NULL,
  lead_time_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_catalog_id UUID NOT NULL REFERENCES manufacturer_catalog(id) ON DELETE RESTRICT,
  target_quantity INTEGER NOT NULL,
  accumulated_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_pool_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id UUID NOT NULL REFERENCES production_pools(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_quantity INTEGER NOT NULL,
  intended_brand_name TEXT NOT NULL,
  packaging_spec JSONB,
  agreed_unit_cost NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. COMPANY-REGISTERED BRANDS (SRS §1.2, §3.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS company_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  combination_id UUID NOT NULL REFERENCES formulation_combinations(id) ON DELETE RESTRICT,
  brand_name TEXT NOT NULL,
  trademark_doc_storage_path TEXT,
  is_verified_trademark BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_brands_trgm ON company_brands USING gin (brand_name gin_trgm_ops);

-- ============================================================
-- 5. STOCKIST-FACING MARKETPLACE (SRS §3.4, §3.5)
-- ============================================================
CREATE TABLE IF NOT EXISTS stockist_marketplace (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES company_brands(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  wholesale_price_per_unit NUMERIC(12,2) NOT NULL,
  available_stock_units INTEGER NOT NULL DEFAULT 0,
  trade_scheme JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_brand ON stockist_marketplace(brand_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_stock ON stockist_marketplace(available_stock_units) WHERE available_stock_units > 0;

-- ============================================================
-- 6. ORDERS & ESCROW LEDGER (SRS §3.6, §3.7)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  layer TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  marketplace_listing_id UUID REFERENCES stockist_marketplace(id),
  pool_contribution_id UUID REFERENCES production_pool_contributions(id),
  quantity INTEGER NOT NULL,
  gross_invoice_value NUMERIC(14,2) NOT NULL,
  platform_fee_pct NUMERIC(5,2) NOT NULL,
  platform_fee_value NUMERIC(14,2) NOT NULL,
  cash_velocity_discount_pct NUMERIC(5,2) DEFAULT 0,
  net_seller_payout NUMERIC(14,2) NOT NULL,
  payment_channel payment_channel NOT NULL,
  declared_batch_number TEXT,
  scanned_batch_number TEXT,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  state order_state NOT NULL DEFAULT 'POOLING_ACTIVE',
  escrow_provider_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  settled_at TIMESTAMPTZ,
  CONSTRAINT valid_layer_refs CHECK (
    (layer = 'MFG_TO_COMPANY' AND pool_contribution_id IS NOT NULL AND marketplace_listing_id IS NULL) OR
    (layer = 'COMPANY_TO_STOCKIST' AND marketplace_listing_id IS NOT NULL AND pool_contribution_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state);

CREATE TABLE IF NOT EXISTS dispute_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  raised_by UUID NOT NULL REFERENCES users(id),
  reason dispute_reason NOT NULL,
  evidence_storage_paths TEXT[],
  resolution dispute_resolution NOT NULL DEFAULT 'PENDING',
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. ADMIN CONFIGURATION (SRS §3.9)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  global_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  cash_velocity_discount_default_pct NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  cash_velocity_discount_min_pct NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  cash_velocity_discount_max_pct NUMERIC(5,2) NOT NULL DEFAULT 6.0,
  dispute_auto_flag_threshold INTEGER NOT NULL DEFAULT 3,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_settings_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. AUDIT LOG (SRS §4)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- 9. ROW-LEVEL SECURITY (SRS §1.2 enforcement)
-- ============================================================
ALTER TABLE manufacturer_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockist_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_pool_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Manufacturer catalog: visible to MANUFACTURER, PHARMA_COMPANY, ADMIN — never STOCKIST
DROP POLICY IF EXISTS manufacturer_catalog_visibility ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_visibility ON manufacturer_catalog
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('MANUFACTURER', 'PHARMA_COMPANY', 'ADMIN')
  );

DROP POLICY IF EXISTS manufacturer_catalog_insert ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_insert ON manufacturer_catalog
  FOR INSERT WITH CHECK (
    manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS manufacturer_catalog_update ON manufacturer_catalog;
CREATE POLICY manufacturer_catalog_update ON manufacturer_catalog
  FOR UPDATE USING (
    manufacturer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Stockist marketplace: visible to STOCKIST, PHARMA_COMPANY, ADMIN
DROP POLICY IF EXISTS stockist_marketplace_visibility ON stockist_marketplace;
CREATE POLICY stockist_marketplace_visibility ON stockist_marketplace
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('STOCKIST', 'PHARMA_COMPANY', 'ADMIN')
  );

DROP POLICY IF EXISTS stockist_marketplace_insert ON stockist_marketplace;
CREATE POLICY stockist_marketplace_insert ON stockist_marketplace
  FOR INSERT WITH CHECK (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS stockist_marketplace_update ON stockist_marketplace;
CREATE POLICY stockist_marketplace_update ON stockist_marketplace
  FOR UPDATE USING (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Orders: participant or admin only
DROP POLICY IF EXISTS orders_participant_only ON orders;
CREATE POLICY orders_participant_only ON orders
  FOR SELECT USING (
    buyer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR seller_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Compliance profiles: self or admin
DROP POLICY IF EXISTS compliance_self_or_admin ON compliance_profiles;
CREATE POLICY compliance_self_or_admin ON compliance_profiles
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

DROP POLICY IF EXISTS compliance_profiles_insert ON compliance_profiles;
CREATE POLICY compliance_profiles_insert ON compliance_profiles
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS compliance_profiles_update ON compliance_profiles;
CREATE POLICY compliance_profiles_update ON compliance_profiles
  FOR UPDATE USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Company brands: owner, or admin
DROP POLICY IF EXISTS company_brands_visibility ON company_brands;
CREATE POLICY company_brands_visibility ON company_brands
  FOR SELECT USING (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

DROP POLICY IF EXISTS company_brands_insert ON company_brands;
CREATE POLICY company_brands_insert ON company_brands
  FOR INSERT WITH CHECK (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS company_brands_update ON company_brands;
CREATE POLICY company_brands_update ON company_brands
  FOR UPDATE USING (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Production pools: manufacturer of the catalog entry, contributing companies, or admin
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
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Pool contributions: contributing company, pool manufacturer, or admin
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
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

DROP POLICY IF EXISTS pool_contributions_insert ON production_pool_contributions;
CREATE POLICY pool_contributions_insert ON production_pool_contributions
  FOR INSERT WITH CHECK (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS pool_contributions_update ON production_pool_contributions;
CREATE POLICY pool_contributions_update ON production_pool_contributions
  FOR UPDATE USING (
    company_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Dispute tickets: participant, or admin
DROP POLICY IF EXISTS dispute_tickets_visibility ON dispute_tickets;
CREATE POLICY dispute_tickets_visibility ON dispute_tickets
  FOR SELECT USING (
    raised_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR resolved_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Users: own profile or admin
DROP POLICY IF EXISTS users_visibility ON users;
CREATE POLICY users_visibility ON users
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Platform settings: readable by all authenticated users
DROP POLICY IF EXISTS platform_settings_visibility ON platform_settings;
CREATE POLICY platform_settings_visibility ON platform_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Audit log: admin only
DROP POLICY IF EXISTS audit_log_visibility ON audit_log;
CREATE POLICY audit_log_visibility ON audit_log
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- ============================================================
-- 10. RPC FUNCTIONS
-- ============================================================

-- Decrement stock atomically (used by checkout-basket Edge Function)
CREATE OR REPLACE FUNCTION decrement_stock(listing_id UUID, qty INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Reject invalid quantity BEFORE acquiring row lock
  IF qty <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Get current stock with row lock
  SELECT available_stock_units INTO current_stock
  FROM stockist_marketplace
  WHERE id = listing_id
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN FALSE;
  END IF;

  IF current_stock < qty THEN
    RETURN FALSE;
  END IF;

  UPDATE stockist_marketplace
  SET available_stock_units = available_stock_units - qty,
      updated_at = now()
  WHERE id = listing_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search molecule full (used by search-molecule Edge Function)
-- Uses pg_trgm similarity index for efficient fuzzy search
-- Returns formulations with their offers, ranked by cheapest price
CREATE OR REPLACE FUNCTION search_molecule_full(search_query TEXT)
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
  LEFT JOIN chemical_salts cs ON EXISTS (
    SELECT 1 FROM combination_salt_bridge csb
    WHERE csb.combination_id = fc.id AND csb.salt_id = cs.id
  )
  WHERE sm.available_stock_units > 0
    AND (
      -- pg_trgm similarity uses GIN index — efficient fuzzy matching
      similarity(fc.display_composition, search_query) > 0.1
      OR similarity(cb.brand_name, search_query) > 0.1
      OR similarity(COALESCE(cs.salt_name, ''), search_query) > 0.1
      -- Fallback ILIKE for exact substring matches (short queries)
      OR fc.display_composition ILIKE '%' || search_query || '%'
      OR cb.brand_name ILIKE '%' || search_query || '%'
    )
  ORDER BY sm.wholesale_price_per_unit ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GIN index for formulation composition similarity search
CREATE INDEX IF NOT EXISTS idx_combinations_trgm ON formulation_combinations USING gin (display_composition gin_trgm_ops);
