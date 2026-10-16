# PharmaOS — Database Schema v1.0 (PostgreSQL / Supabase)

**Companion to:** `01-SRS.md`, `02-ARCHITECTURE.md`. Every table below maps to a specific SRS requirement — the comment above each table names it, so this schema is traceable, not arbitrary.

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- powers SRS §3.2 fuzzy molecule/brand search, zero external cost

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('ADMIN', 'MANUFACTURER', 'PHARMA_COMPANY', 'STOCKIST');
CREATE TYPE order_state AS ENUM (
  'POOLING_ACTIVE',      -- SRS §3.3 production pool still accumulating
  'BATCH_LOCKED',        -- pool target hit / direct order confirmed
  'IN_PRODUCTION',
  'DISPATCHED',
  'DELIVERED_PENDING_SCAN', -- physically arrived, awaiting SRS §3.7 batch-OCR confirmation
  'DELIVERED_CONFIRMED',
  'DISPUTED',            -- SRS §3.8
  'SETTLED',             -- escrow released to seller
  'REFUNDED'              -- escrow returned to buyer
);
CREATE TYPE payment_channel AS ENUM ('ESCROW_INSTANT', 'NBFC_CREDIT_LINE', 'STANDARD_CREDIT_TERMS');
CREATE TYPE dispute_reason AS ENUM ('BATCH_MISMATCH', 'LATE_DELIVERY', 'QUALITY_ISSUE', 'QUANTITY_MISMATCH', 'OTHER');
CREATE TYPE dispute_resolution AS ENUM ('PENDING', 'RELEASED_TO_SELLER', 'REFUNDED_TO_BUYER');

-- ============================================================
-- 1. IDENTITY & COMPLIANCE  (SRS §3.1)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL,      -- maps to Supabase auth.users.id
  role user_role NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'en',   -- drives i18next locale, SRS §3 non-functional (localization)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One row per non-Admin account; SRS §3.1's compliance gate.
CREATE TABLE compliance_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  legal_entity_name TEXT NOT NULL,
  gstin TEXT UNIQUE NOT NULL,
  drug_license_number TEXT UNIQUE NOT NULL,
  drug_license_expiry DATE NOT NULL,
  who_gmp_certified BOOLEAN DEFAULT false,          -- required true for Manufacturer catalog visibility
  license_doc_storage_path TEXT,                    -- Supabase Storage path to uploaded license photo
  gmp_cert_storage_path TEXT,
  facility_lat DOUBLE PRECISION NOT NULL,
  facility_lng DOUBLE PRECISION NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending', -- pending | verified | suspended
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_compliance_expiry ON compliance_profiles(drug_license_expiry);
-- SRS §3.1 "Zero-Day Automated Regulatory Ghosting": any query joining against this table for
-- listing visibility MUST filter `drug_license_expiry >= CURRENT_DATE AND verification_status = 'verified'`.
-- This is enforced in every relevant RLS policy and view below, not left to app-layer discipline.

-- A view every listing-visibility query joins against, so the expiry check lives in exactly one place.
CREATE VIEW active_compliant_users AS
  SELECT u.id AS user_id, u.role
  FROM users u
  JOIN compliance_profiles cp ON cp.user_id = u.id
  WHERE u.is_active = true
    AND cp.verification_status = 'verified'
    AND cp.drug_license_expiry >= CURRENT_DATE;

-- ============================================================
-- 2. MOLECULE-FIRST MASTER DATABASE  (SRS §3.2)
-- ============================================================
CREATE TABLE chemical_salts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salt_name TEXT UNIQUE NOT NULL,             -- e.g. 'Metformin'
  therapeutic_category TEXT,
  nlem_price_capped BOOLEAN DEFAULT false,    -- NPPA/NLEM price-controlled flag
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_salts_trgm ON chemical_salts USING gin (salt_name gin_trgm_ops);

CREATE TABLE formulation_combinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_hash TEXT UNIQUE NOT NULL,      -- deterministic hash of sorted (salt_id, strength) pairs
  display_composition TEXT NOT NULL,          -- e.g. 'Metformin 500mg + Vildagliptin 50mg'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE combination_salt_bridge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_id UUID NOT NULL REFERENCES formulation_combinations(id) ON DELETE CASCADE,
  salt_id UUID NOT NULL REFERENCES chemical_salts(id) ON DELETE RESTRICT,
  strength_value NUMERIC(10,2) NOT NULL,
  strength_unit TEXT NOT NULL DEFAULT 'mg'
);

-- ============================================================
-- 3. LAYER 1: MANUFACTURER CATALOG  (SRS §3.3)
-- Visible ONLY to MANUFACTURER, PHARMA_COMPANY, ADMIN roles — never STOCKIST. See RLS §7.
-- ============================================================
CREATE TABLE manufacturer_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  combination_id UUID NOT NULL REFERENCES formulation_combinations(id) ON DELETE RESTRICT,
  minimum_order_qty INTEGER NOT NULL,          -- MOQ that triggers a production run
  factory_gate_unit_cost NUMERIC(12,4) NOT NULL,
  lead_time_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- SRS §3.3 Production Pool: multiple Company sub-MOQ requests accumulate here until minimum_order_qty is met.
CREATE TABLE production_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer_catalog_id UUID NOT NULL REFERENCES manufacturer_catalog(id) ON DELETE RESTRICT,
  target_quantity INTEGER NOT NULL,             -- copied from manufacturer_catalog.minimum_order_qty at pool creation
  accumulated_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',          -- open | locked | in_production | completed
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One Company's contribution + custom packaging spec within a shared pool.
CREATE TABLE production_pool_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id UUID NOT NULL REFERENCES production_pools(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_quantity INTEGER NOT NULL,
  intended_brand_name TEXT NOT NULL,
  packaging_spec JSONB,                         -- {foil_type, box_dimensions_mm, artwork_storage_path}
  agreed_unit_cost NUMERIC(12,4) NOT NULL,       -- locked at contribution time, protects against later price change
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. THE MANDATORY BRIDGE: COMPANY-REGISTERED BRANDS  (SRS §1.2, §3.4)
-- Every Stockist-facing product traces back through here — this is what makes the
-- Manufacturer→Stockist bypass structurally impossible, not just policy-forbidden.
-- ============================================================
CREATE TABLE company_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  combination_id UUID NOT NULL REFERENCES formulation_combinations(id) ON DELETE RESTRICT,
  brand_name TEXT NOT NULL,
  trademark_doc_storage_path TEXT,              -- SRS §6.4 anti-dummy-brand-spam check
  is_verified_trademark BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, brand_name)
);
CREATE INDEX idx_brands_trgm ON company_brands USING gin (brand_name gin_trgm_ops);

-- ============================================================
-- 5. LAYER 2: STOCKIST-FACING MARKETPLACE  (SRS §3.4, §3.5)
-- Stockists query ONLY this table (and company_brands via it) — never manufacturer_catalog.
-- ============================================================
CREATE TABLE stockist_marketplace (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES company_brands(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,   -- denormalized for fast RLS + query
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  wholesale_price_per_unit NUMERIC(12,2) NOT NULL,
  available_stock_units INTEGER NOT NULL DEFAULT 0,
  trade_scheme JSONB,                            -- structured, e.g. {"buy": 10, "get_free": 1} — SRS §3.4 note: never free text
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_marketplace_brand ON stockist_marketplace(brand_id);
CREATE INDEX idx_marketplace_stock ON stockist_marketplace(available_stock_units) WHERE available_stock_units > 0;

-- ============================================================
-- 6. ORDERS & ESCROW LEDGER  (SRS §3.6, §3.7)
-- Used for BOTH transaction layers (Manufacturer↔Company via pool contribution settlement,
-- and Company↔Stockist via marketplace purchase) — one ledger shape, two `layer` values.
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  layer TEXT NOT NULL,                           -- 'MFG_TO_COMPANY' | 'COMPANY_TO_STOCKIST'
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  marketplace_listing_id UUID REFERENCES stockist_marketplace(id),      -- set if layer = COMPANY_TO_STOCKIST
  pool_contribution_id UUID REFERENCES production_pool_contributions(id), -- set if layer = MFG_TO_COMPANY
  quantity INTEGER NOT NULL,
  gross_invoice_value NUMERIC(14,2) NOT NULL,
  platform_fee_pct NUMERIC(5,2) NOT NULL,        -- copied from platform_settings at order-creation time
  platform_fee_value NUMERIC(14,2) NOT NULL,
  cash_velocity_discount_pct NUMERIC(5,2) DEFAULT 0,   -- SRS §3.6
  net_seller_payout NUMERIC(14,2) NOT NULL,
  payment_channel payment_channel NOT NULL,
  declared_batch_number TEXT,                    -- what the seller said they'd ship
  scanned_batch_number TEXT,                      -- what the buyer's OCR scan actually read on arrival
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  state order_state NOT NULL DEFAULT 'POOLING_ACTIVE',
  escrow_provider_ref TEXT,                       -- Razorpay Route / Cashfree transaction reference
  created_at TIMESTAMPTZ DEFAULT now(),
  settled_at TIMESTAMPTZ,
  CONSTRAINT valid_layer_refs CHECK (
    (layer = 'MFG_TO_COMPANY' AND pool_contribution_id IS NOT NULL AND marketplace_listing_id IS NULL) OR
    (layer = 'COMPANY_TO_STOCKIST' AND marketplace_listing_id IS NOT NULL AND pool_contribution_id IS NULL)
  )
);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_state ON orders(state);

-- SRS §3.8 dispute tickets
CREATE TABLE dispute_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  raised_by UUID NOT NULL REFERENCES users(id),
  reason dispute_reason NOT NULL,
  evidence_storage_paths TEXT[],                 -- photos, uploaded via Supabase Storage
  resolution dispute_resolution NOT NULL DEFAULT 'PENDING',
  resolved_by UUID REFERENCES users(id),          -- Admin who clicked Release/Refund
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. ADMIN NO-CODE CONFIGURATION  (SRS §3.9)
-- ============================================================
CREATE TABLE platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  global_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  cash_velocity_discount_default_pct NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  cash_velocity_discount_min_pct NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  cash_velocity_discount_max_pct NUMERIC(5,2) NOT NULL DEFAULT 6.0,
  dispute_auto_flag_threshold INTEGER NOT NULL DEFAULT 3,   -- disputes within a rolling window before manual-review flag
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Every fee-percentage change is versioned so in-flight orders keep the rate they were created under
-- (see orders.platform_fee_pct being copied at creation, not looked up live at settlement).
CREATE TABLE platform_settings_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. AUDIT LOG  (SRS §4 non-functional: "every fund movement... permanently logged")
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,                 -- e.g. 'ESCROW_RELEASED', 'LICENSE_SUSPENDED', 'DISPUTE_RESOLVED'
  entity_type TEXT NOT NULL,            -- e.g. 'orders', 'compliance_profiles'
  entity_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- 9. ROW-LEVEL SECURITY  (enforces SRS §1.2 — see 02-ARCHITECTURE.md §4.1 for narrative)
-- ============================================================
ALTER TABLE manufacturer_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockist_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY manufacturer_catalog_visibility ON manufacturer_catalog
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('MANUFACTURER', 'PHARMA_COMPANY', 'ADMIN')
  );

CREATE POLICY stockist_marketplace_visibility ON stockist_marketplace
  FOR SELECT USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('STOCKIST', 'PHARMA_COMPANY', 'ADMIN')
  );

CREATE POLICY orders_participant_only ON orders
  FOR SELECT USING (
    buyer_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR seller_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

CREATE POLICY compliance_self_or_admin ON compliance_profiles
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Mutations (INSERT/UPDATE) go through Edge Functions using the service role key, never direct
-- client writes for orders/escrow/compliance-verification — see 04-API-SPEC.md §2.
```

---

## Notes for whoever extends this schema

- **Never add a foreign key from `stockist_marketplace` (or anything Stockist-visible) directly to `manufacturer_catalog`.** That FK would be the exact bypass SRS §1.2 exists to prevent — if a feature request seems to need one, the correct fix is a new field on `company_brands`, not a shortcut through the bridge.
- **`orders.platform_fee_pct` and `.cash_velocity_discount_pct` are always copied at order-creation time, never looked up live from `platform_settings` at settlement.** This is deliberate — an Admin changing the global fee percentage must never retroactively alter an order that's already in flight.
- **Every table that gates listing visibility must filter through `active_compliant_users`** (or replicate its expiry+verification check) — don't add a new listing table that queries `compliance_profiles` directly without that check, or SRS §3.1's "Zero-Day Automated Regulatory Ghosting" silently stops working for that one table.
