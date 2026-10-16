-- 021: Realtime RLS executor permissions.
-- Migration 013 revoked EXECUTE on the SECURITY DEFINER helpers from PUBLIC
-- and granted it to authenticated only. The realtime RLS engine evaluates
-- row policies as `supabase_realtime_admin`, which is NOT in `authenticated`
-- → "permission denied for function get_current_user_id" during
-- realtime.apply_rls → postgres_changes silently delivers NO events.
-- Found by local E2E (subscription OK, zero events delivered).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO supabase_realtime_admin;
    GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO supabase_realtime_admin;
  END IF;
END
$$;
