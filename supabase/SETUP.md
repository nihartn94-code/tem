# PharmaOS — Supabase Setup Guide

## Step 1: Run SQL Migration

1. Go to [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/gmynykiwnvairngkvtdl/sql/new)
2. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Paste into the SQL Editor and click **Run**
4. Verify by running: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';` — should return 12+

## Step 2: Create Storage Bucket

In the Supabase Dashboard:
1. Go to **Storage** → **New Bucket**
2. Name: `compliance-docs`
3. Make it **Public** (or set appropriate RLS policies)
4. This stores uploaded Drug License and GMP certificate photos

## Step 3: Deploy Edge Functions

```bash
# Login to Supabase (you'll need your access token)
supabase login

# Link to your project
supabase link --project-ref gmynykiwnvairngkvtdl

# Deploy each function
cd PharmaOS
supabase functions deploy onboard-compliance
supabase functions deploy search-molecule
supabase functions deploy basket-scan-match
supabase functions deploy checkout-basket
supabase functions deploy confirm-batch-delivery
supabase functions deploy admin
supabase functions deploy production-pool
```

## Step 4: Set Edge Function Secrets (if needed)

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxx RAZORPAY_KEY_SECRET=xxxxx
```

## Step 5: Seed Sample Data

Run this SQL in the SQL Editor to populate the molecule database:

```sql
-- Sample chemical salts
INSERT INTO chemical_salts (id, salt_name, therapeutic_category, nlem_price_capped) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Metformin', 'Antidiabetic', true),
  ('a1000000-0000-0000-0000-000000000002', 'Vildagliptin', 'Antidiabetic', false),
  ('a1000000-0000-0000-0000-000000000003', 'Amlodipine', 'Antihypertensive', true),
  ('a1000000-0000-0000-0000-000000000004', 'Atorvastatin', 'Antilipidemic', true),
  ('a1000000-0000-0000-0000-000000000005', 'Omeprazole', 'Proton Pump Inhibitor', false),
  ('a1000000-0000-0000-0000-000000000006', 'Pantoprazole', 'Proton Pump Inhibitor', false),
  ('a1000000-0000-0000-0000-000000000007', 'Cetirizine', 'Antihistamine', false),
  ('a1000000-0000-0000-0000-000000000008', 'Paracetamol', 'Analgesic', true),
  ('a1000000-0000-0000-0000-000000000009', 'Ibuprofen', 'NSAID', false),
  ('a1000000-0000-0000-0000-000000000010', 'Azithromycin', 'Antibiotic', false)
ON CONFLICT (salt_name) DO NOTHING;

-- Sample formulations
INSERT INTO formulation_combinations (id, combination_hash, display_composition) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'met500_vild50', 'Metformin 500mg + Vildagliptin 50mg'),
  ('b1000000-0000-0000-0000-000000000002', 'amlo5_atorv10', 'Amlodipine 5mg + Atorvastatin 10mg'),
  ('b1000000-0000-0000-0000-000000000003', 'pant40', 'Pantoprazole 40mg'),
  ('b1000000-0000-0000-0000-000000000004', 'cetir10', 'Cetirizine 10mg'),
  ('b1000000-0000-0000-0000-000000000005', 'para650', 'Paracetamol 650mg'),
  ('b1000000-0000-0000-0000-000000000006', 'ibu400', 'Ibuprofen 400mg'),
  ('b1000000-0000-0000-0000-000000000007', 'azi500', 'Azithromycin 500mg'),
  ('b1000000-0000-0000-0000-000000000008', 'ome20', 'Omeprazole 20mg'),
  ('b1000000-0000-0000-0000-000000000009', 'met1000', 'Metformin 1000mg'),
  ('b1000000-0000-0000-0000-000000000010', 'amlo10', 'Amlodipine 10mg')
ON CONFLICT (combination_hash) DO NOTHING;

-- Salt-bridge connections
INSERT INTO combination_salt_bridge (combination_id, salt_id, strength_value, strength_unit) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 500, 'mg'),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 50, 'mg'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 5, 'mg'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 10, 'mg'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000006', 40, 'mg'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000007', 10, 'mg'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000008', 650, 'mg'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000009', 400, 'mg'),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000010', 500, 'mg'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000005', 20, 'mg');
```

## Step 6: Create Admin User

1. Sign up via the app with phone number
2. In SQL Editor, manually update the user's role:
```sql
UPDATE users SET role = 'ADMIN' WHERE phone_number = '+91XXXXXXXXXX';
```

## Environment Variables

| Variable | Value |
|---|---|
| EXPO_PUBLIC_SUPABASE_URL | https://gmynykiwnvairngkvtdl.supabase.co |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | sb_publishable_mCfcude76rA-A6FFkalHmQ_qrBf5uy_ |

## Build APK

```bash
cd PharmaOS/android
./gradlew assembleDebug
# APK at: app/build/outputs/apk/debug/app-debug.apk
```
