#!/bin/zsh
# PharmaOS backend deployment — migrations + all Edge Functions + storage, one command.
# Usage: SUPABASE_ACCESS_TOKEN=... PROJECT_REF=... DB_PASSWORD=... ./scripts/deploy-supabase.sh
set -e
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens)}"
: "${PROJECT_REF:?Set PROJECT_REF (the xxxx.supabase.co ref)}"
: "${DB_PASSWORD:?Set DB_PASSWORD (project database password)}"

export SUPABASE_ACCESS_TOKEN
CLI=${SUPABASE_CLI:-supabase}
$CLI link --project-ref "$PROJECT_REF"

echo "== 1/4 Applying migrations (001-014) =="
$CLI db push

echo "== 2/4 Storage bucket + policies =="
PGPASSWORD="$DB_PASSWORD" psql "postgresql://postgres:$DB_PASSWORD@db.$PROJECT_REF.supabase.co:5432/postgres" << 'SQL'
INSERT INTO storage.buckets (id, name, public) VALUES ('compliance-docs', 'compliance-docs', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "compliance_upload_own" ON storage.objects;
CREATE POLICY "compliance_upload_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'compliance-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "compliance_read_own" ON storage.objects;
CREATE POLICY "compliance_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'compliance-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "compliance_read_admin" ON storage.objects;
CREATE POLICY "compliance_read_admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'compliance-docs' AND EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'ADMIN'));
SQL
echo "storage OK"

echo "== 3/4 Deploying Edge Functions (9) =="
for fn in onboard-compliance search-molecule basket-scan-match checkout-basket confirm-batch-delivery admin pool-dispatch production-pool seed-users; do
  echo "  → $fn"
  $CLI functions deploy "$fn" --no-verify-jwt=false
done

echo "== 4/4 Smoke check =="
curl -s -o /dev/null -w "auth health: %{http_code}\n" "https://$PROJECT_REF.supabase.co/auth/v1/health"
echo ""
echo "DONE."
echo "Next: update app .env → EXPO_PUBLIC_SUPABASE_URL=https://$PROJECT_REF.supabase.co + the project anon key, then rebuild:"
echo "  cd android && JAVA_HOME=\$HOME/jdk17 ./gradlew :app:assembleRelease"
echo "Seed initial users (admin first): POST to /functions/v1/seed-users once, unauthenticated — the bootstrap window closes after the first ADMIN exists."
