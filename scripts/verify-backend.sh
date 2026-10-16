#!/bin/zsh
# Full backend verification suite — run against ANY Supabase project (local or cloud).
# Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... ./scripts/verify-backend.sh
set -u
URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
ANON="${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY}"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL: $1 — got: $2"; }
token() { curl -s -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))"; }
STK=$(token stockist@pharmaos.io Stock123!); MFG=$(token mfg@pharmaos.io MfgPass123!); CO=$(token company@pharmaos.io Company123!); ADM=$(token admin@pharmaos.io Admin123!)
[ -n "$STK" ] && ok "AUTH: 4 role logins" || { bad "AUTH" "no token"; exit 1; }
rest() { curl -s "$URL/rest/v1/$1" -H "apikey: $ANON" -H "Authorization: Bearer $2" "${@:3}"; }
[ "$(rest "manufacturer_catalog?select=id" "$STK")" = "[]" ] && ok "TC-01" || bad "TC-01" "leak"
[ "$(rest "stockist_marketplace?select=id" "$MFG")" = "[]" ] && ok "TC-02" || bad "TC-02" "leak"
[ "$(rest "audit_log?select=id" "$STK")" = "[]" ] && ok "RLS audit_log" || bad "RLS audit_log" "leak"
[ "$(rest "platform_settings_history?select=id" "$STK")" = "[]" ] && ok "RLS settings_history" || bad "settings_history" "leak"
r=$(curl -s -X POST "$URL/functions/v1/search-molecule" -H "Content-Type: application/json" -d '{"query":"x"}')
echo "$r" | grep -q "UNAUTHORIZED" && ok "EF auth gate" || bad "EF auth" "$r"
echo ""
echo "RESULTS: $PASS passed, $FAIL failed"
