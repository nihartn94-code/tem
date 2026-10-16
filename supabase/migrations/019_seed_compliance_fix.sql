-- 019: Seed-data integrity — mfg2 (MedQuest Labs) was seeded without a
-- compliance profile, so active_compliant_users excluded ALL its catalog
-- entries from search results (looked like a search bug).
--
-- NOTE: on the production cloud project this was fixed manually on 2026-09-10
-- (auth user created via API, users row + verified compliance profile inserted
-- via SQL) because the auth user itself was missing — a migration cannot
-- create auth.users entries reliably. This migration is the reproducible
-- remainder for environments where the auth user and users row already exist.

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE phone_number = '+919000000005';
  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM compliance_profiles WHERE user_id = v_user_id
  ) THEN
    INSERT INTO compliance_profiles (
      user_id, legal_entity_name, gstin, drug_license_number,
      drug_license_expiry, who_gmp_certified, verification_status,
      facility_lat, facility_lng
    ) VALUES (
      v_user_id, 'MedQuest Labs Pvt Ltd',
      '27MEDQS1234M1Z5',
      'DL-MH-MFG-2026-0045',
      (now() + interval '3 years')::date,
      true,
      'verified',
      19.0760, 72.8777
    );
  END IF;
END
$$;
