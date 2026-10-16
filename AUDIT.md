# PHARMA OS — ENTERPRISE AUDIT GAP MATRIX
Generated: 2026-09-10 · Method: 3 read-only audits (Edge Functions+migrations, frontend, config/tests) + inline verification of every P0.
Status labels: FIXED (this session, code changed) · DEPLOY-BLOCKED (code fixed, needs `supabase db push` + `functions deploy` with SUPABASE_ACCESS_TOKEN) · OPEN (not yet addressed) · NOT-VERIFIED (no runtime evidence possible this session).

## VERIFIED P0 (security / money)
| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| 1 | seed-users: `Authorization: Bearer garbage` bypassed admin check AND bootstrap guard → anyone could mint admin@pharmaos.io forever | seed-users/index.ts (old 26-50) | FIXED (code) → DEPLOY-BLOCKED |
| 2 | users_insert RLS: `WITH CHECK (auth_user_id = auth.uid())` allowed self-minting role='ADMIN' — full privilege escalation | 013_security_audit_fixes.sql:100 | FIXED (migration 018) → DEPLOY-BLOCKED |
| 3 | basket-scan-match: undeclared `authError` → ReferenceError → 500 on every authenticated call. OCR basket-scan feature dead in production | basket-scan-match/index.ts:51 | FIXED (code) → DEPLOY-BLOCKED |
| 4 | admin/update-platform-settings: same undeclared `authError` → 500 always | update-platform-settings/index.ts:29 | FIXED (code) → DEPLOY-BLOCKED |
| 5 | BasketScreen: UPI payment amount from CLIENT math; server value computed then ignored. ALSO buyer was shown subtotal+fee — wrong model: buyer pays seller gross, fee is deducted from SELLER at settlement (SRS §1.3) | BasketScreen.tsx:55-104 | FIXED — server now returns gross_invoice_value; UPI link pays server gross; fee display-only |
| 6 | Realtime migration 017 referenced nonexistent `disputes` table (actual: `dispute_tickets`) → guaranteed push failure (introduced same day) | 017_realtime_receipts.sql | FIXED (own bug, caught by audit) |

## P1 (data integrity)
| # | Finding | Status |
|---|---------|--------|
| 7 | checkout: mid-basket decrement failure left listings 1..N-1 reserved forever (stock burn across sellers) | FIXED — full cross-seller compensation |
| 8 | checkout idempotency replay used unescaped LIKE prefix (`chk_1` replayed `chk_12:seller` orders; new basket silently never placed) | FIXED — exact per-seller key match after seller resolution |
| 9 | Money math in IEEE-754 floats → paisa drift between gross/fee/net | FIXED — integer-paise derivation in checkout-basket |
| 10 | OrdersScreen reorder: price fabricated from gross/qty (ok under corrected model) but availableStock invented `qty*2`; user could order 2× real stock | FIXED — live listing stock+price fetched; unavailable → error |
| 11 | Hardcoded UPI VPA `pharmaos@upi` in payment path | OPEN (needs real VPA from owner — cannot invent payee) |
| 12 | Migration 018 adds pool contribution idempotency: RPC returns existing pool state on unique violation; EF sends key (header `idempotency-key` or deterministic fallback) | FIXED (code) → DEPLOY-BLOCKED |

## P2 (authorization / audit integrity)
| # | Finding | Status |
|---|---------|--------|
| 13 | resolve-dispute (sub-route): order update had NO state guard — could force-SETTLE unverified orders | FIXED — `.eq("state","DISPUTED")` + zero-rows 409 |
| 14 | admin router: conditional update result unchecked; audit logged transitions that never happened | FIXED — `.select().maybeSingle()` + 409 on no-match |
| 15 | Settings audit_log `entity_id: "1"` vs uuid column → silent audit-logging failure on every settings change (both files) | FIXED — stable singleton uuid + note |
| 16 | Pool contributions had no idempotency (retries double-billed financial commitments) | FIXED (12) |

## P3/P4 fixed this session (reliability / honesty of UI)
| # | Finding | Status |
|---|---------|--------|
| 17 | `t('company.registrationFailed')` — nonexistent key rendered raw to users | FIXED → common.registrationFailed |
| 18 | AdminStats: failed query rendered ₹0 GMV / 0 users as REAL | FIXED — error state + retry |
| 19 | ManufacturerScreen: catalog/pools errors rendered as empty data | FIXED — error states |
| 20 | SearchBar: network error shown as "no results" | FIXED — distinct error state |
| 21 | DisputeCard: irreversible resolve with zero feedback | FIXED — success/error alerts |
| 22 | Marketplace header basket button dead (`onPress: () => {}`) | FIXED → navigates to Basket |
| 23 | Input leftIcon rendered icon KEYS as literal text ("rupee", "camera") inside inputs | FIXED → PharmaIcon |
| 24 | BatchScan modal hardcoded English; a11y gaps (previous session) | FIXED |

## OPEN (not yet addressed — honest ledger)
| # | Finding | Sev | Note |
|---|---------|-----|------|
| 25 | ~40 remaining hardcoded user-facing strings across Admin/BatchScan/OrderDetail/Manufacturer screens (en/hi parity maintained for all ADDED keys: 321=321) | P4-P6 | Mechanical sweep, next session |
| 26 | Raw DB error text reaches clients via catch-all `(err as Error).message` in EFs | P3 | Needs error sanitizer in _shared |
| 27 | basket-scan-match/search-molecule unbounded work (CPU amplification) | P4 | Add line/query caps |
| 28 | _shared/auth.ts: no exp-mandatory, kid fallback to keys[0], no iss/aud | P4 | Mitigated by platform verify_jwt; defense-in-depth TODO |
| 29 | onboarding: second upload path duplicates lib/documents.ts | P5 | Consolidate |
| 30 | MarketplaceItem/OrderItem unmemoized list rows; badge styles recreated per render | P5-P7 | memo pass |
| 31 | `NativeStackScreenProps<any>` on OrderDetail/BatchScan routes | P4 | Type with RootStackParamList |
| 32 | Version 3-way mismatch (ProfileScreen "1.0.0" vs Config 2.0.0 vs app.json 2.1.0) | P4 | Single source = Config.app.version |
| 33 | Delhi coords silently used as delivery fallback on fetch failure | P2 | Must fail checkout loudly instead |
| 34 | ManufacturerScreen fabricates `declared_batch_number` (POOL-XXXX-date) | P2 | Server must assign batch refs |
| 35 | offlineQueue.ts dead module | P4 | Implement or delete |
| 36 | Missing unique index history items (5 missing hot-path indexes now in 018) | P3 | FIXED via 018 |
| 37 | mfg2 seed data lacks compliance profile → invisible in search | P5 | Seed-data fix in next cloud push |
| 38 | Duplicate EF `production-pool/contribute` — drift risk | P5 | Consolidate to one |

## BLOCKERS (exact, per no-false-completion rule)
- SUPABASE_ACCESS_TOKEN missing → cannot push migrations 017+018, cannot deploy fixed Edge Functions, cannot fix seed-users on the LIVE cloud project. Until push: findings 1-4 remain exploitable in production. Owner command: `SUPABASE_ACCESS_TOKEN=<token> npx supabase@latest link --project-ref gmynykiwnvairngkvtdl && npx supabase@latest db push && for fn in seed-users basket-scan-match admin production-pool checkout-basket; do npx supabase@latest functions deploy $fn; done`
- Seeded test credentials absent (scrubbed per security audit C4) → authenticated device E2E NOT-VERIFIED this session.
- Real VPA for UPI collection missing → payment deep-link payee is placeholder (finding 11).

## Verification state
- tsc: 0 errors · jest: 83/83 (incl. 3 new realtime-sync tests)
- NOT-VERIFIED: cloud runtime behavior of all EF fixes (no token); authenticated E2E; production realtime event delivery (needs 017 pushed)
- RUNTIME-VERIFIED earlier sessions: splash/icon/brand, app boot 0 FATAL, release signing

---
## SESSION 2 ADDendum (2026-09-10, continuous loop)
| # | Finding | Status |
|---|---------|--------|
| 34 | ManufacturerScreen fabricates declared_batch_number → §3.7 gate preconditionable | FIXED — pool-dispatch server-assigns `PB-<poolid>-<time>`; client no longer sends it |
| 26 | Raw DB error text to clients | FIXED — `publicErrorMessage()` sanitizer in _shared; applied to 11 EF catch-alls (seed-users keeps granular admin errors) |
| 28 | _shared/auth.ts weak contract | FIXED — exp mandatory, kid must match (no keys[0] fallback) |
| 27 | CPU amplification (scan/search) | FIXED — 40-line/100-char scan cap; 80-char query cap |
| 33 | Delhi coords silent fallback | FIXED — checkout blocked with explanation when no verified delivery location |
| 32 | Version 3-way mismatch | FIXED — single source Config.app.version (2.1.0) |
| 31 | `NativeStackScreenProps<any>` | FIXED — typed with RootStackParamList; Stack navigator typed |
| 35 | offlineQueue dead module | DELETED (+ its tests) — offline basket works via persisted AsyncStorage basket; checkout online-only by design §25 |
| 30 | Unmemoized list rows / per-render StyleSheet | FIXED — React.memo on MarketplaceItem/OrderItem; badge styles hoisted |
| Currency dup | 4 inline ₹ formatters | FIXED — formatCurrency everywhere |
| 25 | i18n sweep | PARTIAL — OrderDetail (business-critical, was fully hardcoded), BatchScan, BasketItem, ListItem done; en/hi 331=331 keys; i18n parity regression test added (80/80) |
| 37 | mfg2 invisible in search | FIXED — migration 019 adds missing compliance profile (deploy-blocked) |
| 36 | 5 hot-path indexes + 4 CHECK constraints + batch uniqueness + contribution idempotency | in migration 018 (deploy-blocked) |
| 38 | production-pool/contribute duplicate | OPEN (both routes used by client; consolidation needs a deploy cycle to avoid breaking the client route) |

## Remaining after this session (honest)
- OPEN: admin screens i18n (admin-only, low traffic), UPI VPA real value, production-pool/contribute consolidation, noUncheckedIndexedAccess tsconfig flag
- DEPLOY-BLOCKED (needs SUPABASE_ACCESS_TOKEN): migrations 017/018/019, EF deploys (seed-users P0 fix, basket-scan-match P0 fix, update-platform-settings P0 fix, pool-dispatch, checkout-basket paise/compensation, sanitizer everywhere)
- NOT-VERIFIED: authenticated E2E (no test creds), cloud runtime behavior post-deploy

## Verification state (this session)
- tsc 0 errors · jest 80/80 (parity + realtime suites added, dead-module tests removed)
- Release APK rebuilt + installed on emulator: boots, AuthScreen renders, 0 FATAL
- `PharmaOS-v2.1.0-hardened.apk` SHA-256 `ed74106db30b1725294dbe5adee5477d6fc2fd2bb1ab39635d49fc165b79744b`

---
## SESSION 3 — FULL COMPLETION PASS (2026-09-10)

### Cloud deployment: COMPLETE (token received)
- Migrations 017-021 pushed and verified via Management API SQL
- 10 Edge Functions deployed (9 named + discovered production-pool/contribute gap → gateway routes by first path segment; subfolder deleted as dead weight)
- users_insert policy verified in pg_policy (role lock active)
- All 7 indexes + 3 CHECK constraints verified in pg_indexes/pg_constraint
- Realtime publication verified: orders + dispute_tickets

### E2E verification matrix (local Supabase stack, fresh db reset 001→021)
| Flow | Result |
|---|---|
| Migration chain clean-apply | PASS (016 ordering bug found+fixed: seed data no-op'd on fresh envs; 020 seed_demo_market_data() called post-users by seed-users) |
| Molecule search (typed) | PASS — 3 hits with brand/price/stock/scheme |
| Manufacturer↔Stockist isolation (direct REST) | PASS — stockist: 0 rows |
| Geo-fence rejection | PASS — wrong-coords checkout 400 DELIVERY_MISMATCH |
| Checkout (server money) | PASS — 10×₹2.05=₹20.50 gross, fee 1.5% → net ₹20.19; stock 25000→24990 |
| Idempotent replay | PASS — same key → replay flag, stock unchanged |
| Concurrent checkout race (2×12500 vs 24990) | PASS — one OK, one STOCK_DECREMENT_FAILED, stock exactly 12490, never negative |
| Wrong-batch scan → dispute | PASS — order DISPUTED, ticket created, audit logged |
| Admin resolve (guarded) | PASS — SETTLED; re-resolve → 409 ALREADY_RESOLVED |
| Pool lifecycle | PASS — contribute → idempotent retry (no double-count) → MOQ lock exactly-once → company dispatch blocked → mfg dispatch (2 orders, server batch PB-…) → re-dispatch skipped 2 |
| seed-users lockout (P0) | RUNTIME VERIFIED — roleless JWT → 403 Admin only; garbage → 401 platform gate |
| Anon/garbage JWT on orders/users | PASS — denied (earlier "leak" was my test misreading a 401 JSON as a row) |
| **Realtime receipts** | **FOUND+FIXED production bug**: 013 revoked EXECUTE from PUBLIC incl. realtime engine → postgres_changes delivered NOTHING. Migration 021 grants to supabase_realtime_admin. Runtime-verified: event delivered to stockist-scoped subscription |

### Remaining OPEN (honest)
- Admin screens i18n sweep (admin-only surfaces, en/hi parity maintained for all shipped keys)
- Real UPI VPA (owner input)
- Play-Store AAB / EAS build (owner account action)
- Custom SMTP for cloud email (dashboard action; local dev uses inbucket)

### Artifacts
- PharmaOS-v2.1.0-final.apk SHA-256 b87241fbd6a4bc5c6e88ca3d97363bdb6fadd5eaf6d46660ad9a13b35e29e948 (older intermediates deleted)
