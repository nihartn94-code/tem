# PharmaOS — E2E Verification Report

## Every claim below has an actual command and actual output as receipt.

### ✅ Backend Verification (Live against gmynykiwnvairngkvtdl)

#### Receipt 1: All 4 role tokens obtained
```
STOCKIST_TOKEN=$(curl -s -X POST .../auth/v1/token?grant_type=password ...)
# Output: eyJhbGciOiJFUzI1NiIsImtpZCI6Ij...
```
- Stockist: ✅ Token obtained
- Manufacturer: ✅ Token obtained
- Company: ✅ Token obtained
- Admin: ✅ Token obtained

#### Receipt 2: SECURITY DEFINER functions return correct roles
```
curl -s -X POST .../rest/v1/rpc/get_current_user_role -H "Authorization: Bearer $STOCKIST_TOKEN"
# Output: "STOCKIST"

curl -s -X POST .../rest/v1/rpc/get_current_user_role -H "Authorization: Bearer $MFG_TOKEN"
# Output: "MANUFACTURER"

curl -s -X POST .../rest/v1/rpc/get_current_user_role -H "Authorization: Bearer $COMPANY_TOKEN"
# Output: "PHARMA_COMPANY"

curl -s -X POST .../rest/v1/rpc/get_current_user_role -H "Authorization: Bearer $ADMIN_TOKEN"
# Output: "ADMIN"

curl -s -X POST .../rest/v1/rpc/get_current_user_id -H "Authorization: Bearer $STOCKIST_TOKEN"
# Output: "b557a71e-f594-4221-96d0-8ed5872c2661"
```

#### Receipt 3: increment_pool_quantity RPC exists
```
curl -s -X POST .../rest/v1/rpc/increment_pool_quantity -d '{"pool_id":"000...","qty":1}'
# Output: No error (function exists)
```

#### Receipt 4-8: Stockist RLS permissions
- ✅ Users (own only): `[{"id":"b557a71e...","role":"STOCKIST","display_name":"Test Medical Store"}]`
- ✅ Marketplace: `[{"id":"fb72f782...","batch_number":"BATCH2026A","wholesale_price_per_unit":85.50,"available_stock_units":490}]`
- ✅ Company brands: `[{"id":"7573fa52...","brand_name":"Glycomet-V","company_id":"7cf24fa8..."}]`
- ✅ Formulation combinations: `[{"id":"bb53cd9c...","display_composition":"Metformin 500mg + Vildagliptin 50mg"},...]`
- ✅ Chemical salts: `[{"id":"baef4028...","salt_name":"Metformin","therapeutic_category":"Antidiabetic"},...]`

#### Receipt 9-11: Adversarial RLS blocking
- ✅ Stockist CANNOT see manufacturer_catalog: `[]`
- ✅ Stockist CANNOT see audit_log: `[]`
- ✅ Manufacturer CANNOT see stockist_marketplace: `[]`

#### Receipt 12-14: Privileged access
- ✅ Admin sees audit_log: `[{"action":"ORDER_CREATED","entity_type":"orders","entity_id":"..."},...]`
- ✅ Admin sees platform_settings: `[{"global_fee_pct":1.50,"cash_velocity_discount_default_pct":3.00}]`
- ✅ Manufacturer sees own catalog: `[{"id":"7ad88697...","minimum_order_qty":1000,"factory_gate_unit_cost":12.50,"is_active":true}]`

#### Receipt 15-17: Edge Function auth checks (unauthenticated)
- ✅ basket-scan-match: `{"error":{"code":"UNAUTHORIZED","message":"Missing auth"}}`
- ✅ search-molecule: `{"error":{"code":"UNAUTHORIZED","message":"Missing auth"}}`
- ✅ confirm-batch-delivery: `{"error":{"code":"UNAUTHORIZED","message":"Missing auth"}}`

#### Receipt 18-19: Edge Functions with Stockist auth
- ✅ search-molecule: `Found 1 combinations with offers`
- ✅ basket-scan-match: `Got 1 matches, first confidence: 1`

#### Receipt 20-23: Checkout flow
- ✅ Checkout created order with fee/discount: `{"orders":[{"order_id":"a08a78ae...","escrow_provider_ref":"escrow_a08a78ae...","net_seller_payout":...}]}`
- ✅ Order state: `DELIVERED_PENDING_SCAN`
- ✅ Batch match -> SETTLED: `{"state":"SETTLED","dispute_ticket_id":null}`
- ✅ Settled state verified: `{"state":"SETTLED","settled_at":"2026-08-26T20:19:16.35+00:00"}`

#### Receipt 24: Adversarial - Settled order rejected
```
curl -s -X POST .../confirm-batch-delivery -d '{"order_id":"...","scanned_batch_number":"BATCH-FAKE"}'
# Output: {"error":{"code":"INVALID_STATE","message":"Order is in state 'SETTLED', only 'DELIVERED_PENDING_SCAN' orders can be confirmed"}}
```

#### Receipt 25: Audit log entries
```
curl -s .../audit_log?select=action,entity_type,entity_id&entity_id=eq.$ORDER_ID
# Output: [{"action":"ORDER_CREATED","entity_type":"orders","entity_id":"..."},{"action":"BATCH_CONFIRMED","entity_type":"orders","entity_id":"..."}]
```

#### Receipt 26-28: Batch mismatch -> dispute
- ✅ Mismatch response: `{"state":"DISPUTED","dispute_ticket_id":"..."}`
- ✅ Order state: `DISPUTED`
- ✅ Dispute ticket: `[{"id":"...","order_id":"...","reason":"BATCH_MISMATCH","resolution":"PENDING"}]`

#### Receipt 29-31: Admin resolves dispute (RELEASED_TO_SELLER)
- ✅ Resolution: `{"success":true,"order_state":"SETTLED"}`
- ✅ Order state: `SETTLED`
- ✅ Dispute recorded: `[{"resolution":"RELEASED_TO_SELLER","resolved_by":"...","resolved_at":"..."}]`

#### Receipt 36-37: Admin resolves dispute (REFUNDED_TO_BUYER)
- ✅ Resolution: `{"success":true,"order_state":"REFUNDED"}`
- ✅ Order state: `REFUNDED`

#### Receipt 38-39: Admin updates platform settings
- ✅ Update: `{"global_fee_pct":2.0,...}`
- ✅ Verified: `{"global_fee_pct":2.0}`

#### Receipt 41-42: Stock validation
- ✅ Remaining stock: 490 units
- ✅ Over-stock rejected: `{"error":{"code":"INSUFFICIENT_STOCK","message":"Only 490 units available for Glycomet-V, requested 9999"}}`

#### Receipt 54c-55c: Manufacturer catalog creation
- ✅ Catalog created: `[{"id":"7ad88697...","minimum_order_qty":1000,"factory_gate_unit_cost":12.50,"is_active":true}]`

#### Receipt 56c-57c: Production pool - first contribution (200 units)
- ✅ Pool created: `{"pool_id":"79a84b07...","pool_status":"open","accumulated_quantity":200,"target_quantity":1000}`

#### Receipt 58c-59c: Production pool - second contribution (900 units) -> LOCKS
- ✅ Pool locked: `{"pool_id":"79a84b07...","pool_status":"locked","accumulated_quantity":1100,"target_quantity":1000}`
- ✅ Verified: `[{"target_quantity":1000,"accumulated_quantity":1100,"status":"locked","locked_at":"..."}]`

#### Receipt 60c: Contributions recorded
- ✅ `[{"requested_quantity":200,"intended_brand_name":"TestBrand1","agreed_unit_cost":15.00},{"requested_quantity":900,"intended_brand_name":"TestBrand2","agreed_unit_cost":14.50}]`

#### Receipt 62: Compliance profiles
- ✅ `[{"legal_entity_name":"Test Pharma Mfg Pvt Ltd","verification_status":"verified"},{"legal_entity_name":"Test Pharma Co Pvt Ltd","verification_status":"verified"},{"legal_entity_name":"Test Medical Store","verification_status":"verified"}]`

#### Frontend TypeScript
- ✅ `npx tsc --noEmit` → zero errors (only npm warn about allow-scripts)

### ✅ Migrations (9 total, all applied)
1. 001_initial_schema.sql — Core schema
2. 002_add_manual_confirmation.sql — Payment channel
3. 003_fix_users_rls_recursion.sql — SECURITY DEFINER get_current_user_role()
4. 004_fix_remaining_rls_recursion.sql — SECURITY DEFINER get_current_user_id()
5. 005_fix_pool_circular_recursion.sql — Pool helper functions
6. 006_security_and_pool_fix.sql — SET search_path=public, increment_pool_quantity RPC (FIXED: no CASCADE)
7. 007_seed_test_data.sql — Idempotent seed data
8. 008_recreate_rls_policies.sql — Recreated all 21 policies
9. 009_fix_missing_rls_policies.sql — Added policies for reference tables

### ✅ Edge Functions (8 deployed)
All ACTIVE: search-molecule, basket-scan-match, checkout-basket, confirm-batch-delivery, onboard-compliance, admin, production-pool, seed-users

### ✅ Test Users
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pharmaos.io | Admin123! |
| Manufacturer | mfg@pharmaos.io | MfgPass123! |
| Company | company@pharmaos.io | Company123! |
| Stockist | stockist@pharmaos.io | Stock123! |

### Known Remaining Items
1. Frontend screenshot verification (requires running app/emulator)
2. APK build and real device testing
3. Supabase Storage upload test
4. Supabase Realtime subscription test
5. On-device OCR and voice test
6. UPI deep-link flow test
7. Push notification test
8. Error boundary and crash resistance verification


---

## Session Update: August 27, 2026

### Verified with actual command receipts:
- TypeScript: 0 errors (npx tsc --noEmit)
- Emoji: 0 remaining in source files
- All leftIcon props use valid AppIcons
- ErrorBoundary wraps App root
- Design system tokens used (298 usages across screens)
- Button.tsx and Input.tsx use design tokens
- SafeScreen: HomeScreen wrapped with loading/error/retry props
- 12 unused SafeScreen imports removed from screens with inline state handling
- Admin loading bug fixed (complianceLoading set to false for Admin users)
- Email+password auth fallback added (loginWithEmail method)
- AuthScreen has email/password login mode with phone/email toggle
- AuthContextType updated with loginWithEmail
- createProfile updated to accept isEmail parameter
- AuthScreen handleRoleSelect passes correct identifier with isEmail flag
- handleEmailLogin validates email and password separately
- ProfileScreen dead SafeScreen import removed
- insertData properly typed in createProfile
- tsconfig.json excludes __tests__/**
- EAS build: FINISHED (APK: 152.6MB valid Android package)
- All 4 role logins verified with real JWT tokens
- RLS verified adversarially (Stockist gets empty from manufacturer_catalog)
- search-molecule Edge Function returns real data
- checkout-basket Edge Function works with real tokens

### Seed User Credentials:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pharmaos.io | Admin123! |
| Manufacturer | mfg@pharmaos.io | MfgPass123! |
| Company | company@pharmaos.io | Company123! |
| Stockist | stockist@pharmaos.io | Stock123! |

### APK Details:
- Path: /home/rajat/Downloads/PharmaOS/PharmaOS/PharmaOS.apk
- Size: 152.6MB
- Type: Android package (APK) with gradle app-metadata.properties
- EAS Build ID: d9dd3ff8-c4d7-401a-b810-47a961aa68fd
- Download URL: https://expo.dev/artifacts/eas/QwNtrY3S-pOsNVGhVaV19mrg-ZodVBrV1u-hCtsjz0A.apk

### Known Limitations:
1. **Phone OTP disabled** on this Supabase project (phone_provider_disabled). Auth flow uses email+password fallback.
2. **EAS build was from pre-migration code** — the APK doesn't include the email column support. A new build is needed after migration.
3. **Database migration 002 NOT applied** — email column doesn't exist in live DB. Must be applied via Supabase Dashboard SQL Editor.
4. **Test dependencies installed** (jest, @types/jest, ts-jest, react-test-renderer, @testing-library/react-hooks) but tests not yet executed.

### Remaining Work:
1. Apply migration 002 via Supabase Dashboard SQL Editor
2. Rebuild APK with migration applied
3. Run unit tests with jest
4. Test APK on device
5. Verify email-based login flow end-to-end

---

# PHASE 3 EXECUTION REPORT — September 7, 2026
## Master Documentation Compliance Pass + Production Hardening

Source of truth: `PharmaOS-Master-Documentation (2).pdf` (46 sections, extracted to text).
Every claim below has a command + output receipt from this session.

## 1. Compliance Fixes Implemented (doc section → change)

### Database (migration 011 — `supabase/migrations/011_production_hardening.sql`)
| Doc rule | Fix |
|---|---|
| §10 trust boundary, TC-07 "pool locks exactly once" | New `contribute_to_pool()` SECURITY DEFINER function: advisory-locked find-or-create + contribution + atomic increment + status-guarded threshold lock in ONE transaction |
| §25 idempotency | `orders.idempotency_key` TEXT + UNIQUE partial index — retried checkout cannot duplicate orders |
| §11 append-only settings history | `platform_settings_history` RLS enabled, ADMIN-only SELECT, no public writes |
| §14 authorization | EXECUTE revoked from anon+authenticated on `decrement_stock`, `search_molecule_full`, `increment_pool_quantity`, `contribute_to_pool` (Edge-Function-only internals) |

### Edge Functions (all rewritten/hardened)
| Function | Fixes |
|---|---|
| checkout-basket | Mandatory geo-fence (no-profile → 403 COMPLIANCE_REQUIRED; NaN/non-finite coords rejected; §7/TC-04); idempotency replay + unique-constraint race guard; one order per distinct seller (§12); payment_channel whitelist validated; no silent fee fallbacks (§6.4); batch price/stock re-validation; grouped atomic stock decrements; per-seller audit rows |
| production-pool (+ contribute route) | All mutation logic moved into atomic `contribute_to_pool` RPC; `agreed_unit_cost` re-derived server-side from catalog (§10 "never trust client"); POOL_LOCKED audit written exactly once when just_locked |
| confirm-batch-delivery | Conditional state-guarded updates (`.eq("state","DELIVERED_PENDING_SCAN")`) — concurrent double-settle returns 409 (§25); dispute row created with evidence array; audit both branches |
| admin (+ resolve-dispute) | Resolution enum validated in BOTH handlers; dispute update conditional on `resolution='PENDING'`; all writes error-checked (§24 — no fire-and-forget); ALREADY_RESOLVED 409 on lost race |
| search-molecule | Role-scoped server-side (§12): STOCKIST gets marketplace only; MFG/CO/ADMIN additionally get manufacturer-layer offers (MOQ, factory-gate, lead time), identity anonymized pre-escrow (§7) |
| onboard-compliance | drug_license_number required + length-checked; facility coords must be finite numbers (§24) |
| seed-users | Bootstrap guard: once any ADMIN exists, unauthenticated seeding returns 403 |

### Frontend
| Doc rule | Fix |
|---|---|
| §5 F9/F10, TC-09 | NEW `ScanToBasketModal`: camera → on-device OCR → server fuzzy match → per-line confidence; lines < 60% confidence flagged "CHECK" and never silently added; cheapest-offer binding via live marketplace query |
| §5 F4 | Real voice search: `expo-speech-recognition@57.0.0` (SDK-57 compatible) wired through `useVoiceInput`; transcript feeds the SAME `useMoleculeSearch` path as typed search |
| §5 F15, TC-10 | Offline basket → on reconnect NetInfo listener re-validates every basket line against live stock, drops depleted items, persists; OfflineQueue wired |
| §24 | `ErrorBoundary` mounted at app root; `friendlyError()` mapping (INSUFFICIENT_STOCK, DELIVERY_MISMATCH, network, etc.) replacing raw `err.message` in 6 screens |
| §2/Appendix D | "Escrow funds frozen" → "Payment held pending Admin review" (manual-confirmation mode must never say escrow); settings label fixed |
| §8 | Theme token fixes: `Colors.text/status/roles` namespaces + `Colors.white` restored; Card style prop accepts arrays (crash fix); Input accessibility prop fix |
| §5 F16 | Hardcoded strings extracted to en/hi catalogs: SearchBar, BatchScanScreen, HomeScreen, AuthScreen, BasketScreen, OnboardingScreen, OrderTimeline; en/hi at full parity (≥279 keys each, JSON-verified) |
| F1 | Onboarding: OCR-assisted license scan button — ML Kit extracts license number + expiry, PRE-FILLS for user confirmation (never auto-accepts) |
| Config | UPI ID/payee moved to `Config.payment` (no hardcoded business values in screens); app version 2.0.0, versionCode 2 |

## 2. Verification Receipts (this session)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors (multiple runs incl. final) |
| Unit tests | `npx jest --silent` | **5 suites, 69/69 passed** incl. new `compliance.test.ts`: haversine geo-fence (TC-04 parity), §6.4 fee/discount worked example (₹9,250 → ₹138.75 fee), TC-08 fee immutability, §24 error mapping |
| APK build | `./gradlew :app:assembleRelease` | BUILD SUCCESSFUL — 642 tasks |
| APK | `app/build/outputs/apk/release/app-release.apk` | 162,724,056 bytes, versionCode 2, versionName 2.0.0 |
| SHA-256 | `sha256sum` | `9e1eb34bcbf2bdf7891c4d03950a8253ca8474ec5fed38f90ce7f31920016583` |
| Clean install | `adb uninstall` → `adb install` | Success (emulator-5554, API 34) |
| Cold launch | `am start` + logcat | No FATAL/crash in app process; `mFocusedApp=com.pharmaos.app/.MainActivity` |
| Auth screen render | `uiautomator dump` | All elements present: Email, Password, Sign In, Use Phone Instead, localized labels |
| Input interaction | typed via adb | Text entry + secureTextEntry masking verified |
| i18n parity | JSON key diff en vs hi | Equal key sets |
| Sign-in flow | tap Sign In (live backend) | **BLOCKED — see below** |

## 3. BLOCKED ITEMS (external, with evidence)

### BLOCKER 1: Supabase project unreachable — live DB/Edge verification impossible
- ATTEMPTED: `curl https://gmynykiwnvairngkvtdl.supabase.co/auth/v1/token...`
- ACTUAL ERROR: `Could not resolve host` — from host AND emulator
- EVIDENCE: Google DNS-over-HTTPS returns **Status 3 (NXDOMAIN)** for `gmynykiwnvairngkvtdl.supabase.co` and `db.gmynykiwnvairngkvtdl.supabase.co` — the project DNS record no longer exists (free-tier project paused/deleted). `supabase.co` itself resolves fine.
- WHY BLOCKED: cannot apply migration 011, deploy Edge Functions, run adversarial RLS/TC-01..TC-13 live, or test end-to-end login/checkout/batch-scan against real backend.
- REQUIRED: restore/pause-resume the Supabase project (or create a new one), then: apply `supabase/migrations/011_production_hardening.sql` via Dashboard SQL Editor, deploy the 8 updated functions via `supabase functions deploy`, re-run `rls_verify.sh` + TC-01..TC-13, and rebuild APK if the URL changes.

### BLOCKER 2: Supabase CLI not authenticated
- ATTEMPTED: `supabase projects list` (v2.116.0 binary installed from GitHub release)
- ACTUAL ERROR: `Access token not provided. Supply an access token by running supabase login`
- REQUIRED: `SUPABASE_ACCESS_TOKEN` or interactive `supabase login`.

### NOT VERIFIED (honest gaps)
- Live RLS adversarial tests (TC-01, TC-02, TC-04, TC-07, TC-11) — blocked by BLOCKER 1; logic verified at SQL/unit level only
- Edge Function live E2E (checkout→batch-scan→settle/dispute) — blocked by BLOCKER 1
- Camera/OCR on real hardware, voice recognition runtime, UPI deep-link — device/hardware + backend required
- 152MB APK size — Hermes + 4 ABIs; recommend ABI splits (`abiFilters`) before store release

## 4. Delivery
- APK: `/home/rajat/Downloads/PharmaOS/PharmaOS/PharmaOS-v2.0.0-release.apk`
- SHA-256: `9e1eb34bcbf2bdf7891c4d03950a8253ca8474ec5fed38f90ce7f31920016583`
- Version: 2.0.0 (versionCode 2), signed with project debug keystore (release build)
- Backend state: repo contains migration 011 + 8 hardened Edge Functions, **not yet applied/deployed** (BLOCKER 1)

---

# PHASE 4 EXECUTION REPORT — September 7, 2026 (hardening loop, backend still blocked)

## New fixes this phase (all runtime-discovered)
| Defect | Root cause | Fix | Evidence |
|---|---|---|---|
| x86_64 build crash at launch (TurboModuleRegistry: PlatformConstants not found) | ABI splits `include` list excluded x86/x86_64 from the universal APK → `libappmodules.so` missing for emulator ABIs | All 4 ABIs included in splits; users install per-device APK | Tombstone receipt → rebuild → clean install → `mCurrentFocus=MainActivity`, 0 FATAL |
| Raw error messages surfaced to users (§24) | `useAuth` returned raw `err.message` from all 4 async flows | `friendlyError()` mapping applied at the source in useAuth (login/OTP/profile/init) | Code + unit tests |
| Checkout idempotency never engaged | Server accepted `idempotency_key` but client never sent it | BasketScreen generates one key per checkout attempt; useCheckout type extended | Code |
| ErrorBoundary used hardcoded English | Class component outside hook tree | `getBoundaryText()` locale snapshot synced on `languageChanged` | Code + en/hi keys |
| Package step OOM on release build | Gradle JVM 2GB heap | jvmargs → 6GB | BUILD SUCCESSFUL receipts |

## APK size optimization (§ Performance — measured, not invented)
| APK | Before | After |
|---|---|---|
| Universal (4 ABIs) | 162.7 MB | 162.7 MB (unchanged role: sideload/emulator fallback) |
| **arm64-v8a (real-device deliverable)** | — | **61.0 MB (−63%)** |
| armeabi-v7a | — | 48.7 MB |
| x86_64 / x86 (emulator) | — | 63.0 / 63.6 MB |

## Runtime verification receipts (emulator-5554, clean installs ×3)
- Cold start `am start -W`: TotalTime ~560–8000 ms (first run post-install slower; warm well under 3s target)
- Airplane-mode login → Alert with mapped copy, no crash, recovers on reconnect (§24/§25 network-failure path)
- Rapid triple-tap Sign In (airplane mode): no crash, no duplicate navigation, no infinite spinner
- Font scale 1.3×: full render, no crash (accessibility font scaling)
- 720×1280 small screen: full render, no clipping crash
- Background (HOME) → foreground → `am kill` → restart: all clean, 0 FATAL across all lifecycles
- Airplane-mode cold start: auth screen renders fully offline

## Test suite
- `security.test.ts` added: GSTIN schema (§43), coordinate-validation parity with checkout Edge Function (TC-04 regression guard), payment-channel whitelist, idempotency key uniqueness
- Total: **6 suites, 75/75 passing** (was 69)
- Static audits: no-bypass FK rule PASS (only production_pools → manufacturer_catalog); 76 CREATE POLICY statements across migrations reviewed

## FINAL APK SET (this exact source)
| Artifact | SHA-256 |
|---|---|
| PharmaOS-v2.0.0-arm64-release.apk (61.0 MB) — versionCode 2202 | `859bad289f85821811b85d3c102fa85614961f85a55520c8228b50f4ed94d1fd` |
| PharmaOS-v2.0.0-universal-release.apk (162.7 MB) — versionCode 2 | `b0636289948849820d1dbb0b915053b0b44c77bd501d64564578b3102b83c42c` |

## Blocker recheck
- `gmynykiwnvairngkvtdl.supabase.co` → DNS Status 3 (NXDOMAIN) via Google DoH — still unavailable. Live RLS/E2E remain NOT VERIFIED. All other work continues.

---

# PHASE 5 REPORT — September 8, 2026: BACKEND IS LIVE — FULL-STACK E2E VERIFIED

## The backend was rebuilt and verified as a working system
Self-hosted Supabase stack (12 containers: Kong, PostgREST, GoTrue, Postgres 15, Storage, Realtime, edge-runtime, Studio, analytics) — the architecture the master doc specified, now real and local.

- All 12 migrations applied (005 param-name preemption bug fixed en route)
- 8 Edge Functions serving locally
- 4 role seed users + compliance-docs storage bucket + storage RLS
- Committed runbooks: `scripts/deploy-supabase.sh` (cloud), `scripts/verify-backend.sh` (any project)

## Live E2E receipts (scripts + real emulator against the real backend)
| Test | Result |
|---|---|
| TC-01 Stockist↛manufacturer_catalog (RLS) | PASS |
| TC-02 Manufacturer↛stockist_marketplace (RLS) | PASS |
| Stockist↛audit_log, ↛settings_history | PASS |
| increment_pool_quantity RPC blocked for clients | PASS |
| EF auth gates (UNAUTHORIZED shape) | PASS |
| onboard-compliance create + GSTIN validation | PASS |
| TC-04 geo-fence rejects Chennai→Delhi delivery | PASS |
| §25 idempotent replay → same order, no dup stock loss | PASS |
| TC-05 batch mismatch → DISPUTED + ticket | PASS |
| §25 double-confirm rejected (state guard) | PASS |
| Admin dispute → REFUNDED; double-resolve blocked | PASS |
| TC-06 batch match → SETTLED + settled_at | PASS |
| TC-07a/b/c pool: atomic increment, locks once, fresh pool per run | PASS |
| **TC-11 zero-day ghosting** | **FOUND BROKEN → FIXED (migration 012) → VERIFIED at RLS + search + checkout layers** |
| checkout fee math (1.75% copied at creation) | PASS (DB row receipt) |

**Real app journey on emulator against real backend:** login (persisted session, 386ms cold start) → Stockist dashboard → Marketplace renders live listing → Add to Basket → basket math correct (₹85.50 + 1.75% = ₹87.00) → checkout → "Order Placed" → Orders shows DELIVERED_PENDING_SCAN → batch scan screen: camera permission flow, camera capture, OCR no-match → manual entry fallback → (direct EF receipt: SETTLED) → Orders shows SETTLED. Error states, offline banner, 1.3× font scale, 720p screen, background/kill/restart lifecycles — all clean, 0 FATAL.

## Defects found by live E2E and fixed this phase
1. **Zero-day ghosting not enforced** — listing RLS checked role only; expired-license sellers stayed visible. Migration 012: `active_compliant_users` joined into listing RLS + `search_molecule_full` + checkout trust-boundary check (SELLER_NOT_COMPLIANT). Master-doc §7/§11/§30 now fully enforced.
2. **PostgREST embed path broken** (2 places) — `formulation_combinations` embedded one level too deep; marketplace showed error state. Fixed to full FK path in `useMarketplaceListings` + `ScanToBasketModal`.
3. **i18n dotted-key bug** — 8 keys stored with literal dots → raw keys shown in UI; plus `common.logout` missing entirely (a11y label showed "common.logout"). Normalized; key sweep now 0 missing (234 used keys verified).
4. Migration 005 parameter-name mismatch (blocked `supabase start`).

## Environment notes
- `android:usesCleartextTraffic="true"` — required ONLY for the local-HTTP backend; remove for cloud-only HTTPS deploys (flagged in code).
- Emulator keyboard intercepts dialog taps when open; dismiss before tapping Confirm (test-env quirk, not a product bug).

## Current deliverables
- APKs (rebuilt, installed, E2E-verified against live backend):
  - `PharmaOS-v2.0.0-arm64-release.apk` — 61 MB, versionCode 2202, SHA-256 `859bad289f85821811b85d3c102fa85614961f85a55520c8228b50f4ed94d1fd`
  - `PharmaOS-v2.0.0-universal-release.apk` — 163 MB, versionCode 2, SHA-256 `b0636289948849820d1dbb0b915053b0b44c77bd501d64564578b3102b83c42c`
- Backend: reproducible via `supabase start` + `scripts/deploy-supabase.sh` for cloud
- Tests: 75/75 unit + full backend suite + app-level E2E receipts

## Remaining NOT VERIFIED (truthful)
- Cloud production deploy (needs SUPABASE_ACCESS_TOKEN + PROJECT_REF from the project owner — runbook ready)
- Physical-device camera/OCR/UPI (no hardware attached)
- The never-stop loop continues: next iterations = deeper admin-console E2E, voice-search runtime on device, realtime subscription receipts

---

# PHASE 6 REPORT — September 8, 2026: FULL-CODEBASE AUDIT → ALL CRITICALS FIXED & LIVE-VERIFIED

Three independent deep-review agents swept the entire codebase (frontend, backend, security). Findings triaged, criticals/highs fixed, every fix regression-verified live.

## Confirmed & FIXED (with live exploit/receipt before + after)

| # | Severity | Defect | Fix | Verification |
|---|---|---|---|---|
| C1 | CRITICAL | All service RPCs still callable by every client — `REVOKE` missed `FROM PUBLIC` (Postgres grants PUBLIC at creation) | Migration 013: full PUBLIC revokes + authenticated grants for RLS helpers | **Live-exploited before** (anon REST call decremented stock 484→479); after: `permission denied` |
| C2 | CRITICAL | Users could self-set `verification_status='verified'`, `expiry=2099` via direct PATCH — zero-day ghosting bypassed at its source | 013: compliance UPDATE now admin-only; resubmission via onboard-compliance (service role) | **Live-confirmed before** (expiry set to 2099); after: PATCH no-ops, admin path works |
| C3 | CRITICAL | Multi-seller checkout: same idempotency_key on every per-seller order → unique-index collision → partial checkout, lost stock | Per-seller namespaced keys (`<key>:<sellerId>`), replay lookup via prefix | Backend suite 13/13 |
| C4 | CRITICAL (release) | Release APKs signed with the public debug keystore | Real keystore generated outside the repo, wired via git-ignored `keystore.properties` with CI fallback; `apksigner verify` shows the PharmaOS cert | `CN=PharmaOS, OU=Mobile…` SHA-256 `7f1a0e8e…378d6f` |
| C-FE1 | CRITICAL | Basket was module state with **zero reactive subscribers** — mutations didn't re-render basket UI | `useQuery(['basket'])` notification layer over the module store | tsc + app renders |
| C-FE2 | CRITICAL | `crypto.randomUUID()` — not in Hermes → every new-user signup crashed | Hermes-safe unguessable generator | unit-tested path |
| H | HIGH | Manufacturer could insert marketplace rows / any role could write any layer (insert policies had no role check) | 013: role-checked INSERT policies for catalog/brands/marketplace | Live: MFG marketplace insert → `42501 row-level security` |
| H | HIGH | Checkout non-atomic: order-insert failure after decrement permanently lost stock | `increment_stock` compensation RPC on every failure path incl. 23505 | Backend suite |
| H | HIGH | Expired-batch stock purchasable | `EXPIRED_BATCH` rejection in checkout | Live: `PASS expired batch rejected` |
| H | HIGH | Admin settings accepted `-5`, `9999`, `"abc"` | Range validation 0–100 / 1–1000 + min≤max cross-check (server + client) | Live: `PASS settings range validated` |
| H | HIGH | Reorder fabricated non-UUID listing ids → checkout always failed | Reorder blocked without a live listing id | code + i18n keys |
| H | HIGH | Admin credentials + `.env` + `.temp` secrets tracked in git; docs contained prod passwords | `.gitignore` (.env/*.apk/.temp/keystore.properties), `git rm --cached` | `git ls-files` clean |
| H | HIGH | `usesCleartextTraffic` + `allowBackup` + VIBRATE/SYSTEM_ALERT_WINDOW in release manifest | allowBackup=false, perms stripped, cleartext documented as local-dev-only | aapt2 badging receipt |
| M×15 | MEDIUM | BatchScan stale cache; signOut left prior user's cache; auth race bounced users on token refresh; floating promises; settings form silent failures; DisputeCard blank icons; onboarding step validation; marketplace clear-filter invisible; audit_log writes unchecked (4 functions); admin order update non-conditional; UPI amount client-computed + basket cleared only on one branch; `|| 1.5` made 0% fee impossible; offlineQueue write-only churn; hi.json untranslated key; `common.progress` missing | All fixed | 80/80 tests |
| L | LOW | Dead exports/imports, unused deps (gesture-handler, reanimated, worklets, react-test-renderer — removed), test wrappers, version strings | Removed where verified | expo export succeeds |

## Final regression state
- Backend suite (local Supabase, 013 applied): **13/13 PASS** — includes the two live-exploit re-tests
- Unit/integration: **80/80 PASS** (6 suites; offlineQueue suite added)
- tsc: 0 errors; `expo export` succeeds after dependency removal
- APK: release-signed (PharmaOS cert), versionCode 2, installed on emulator, launches clean (TotalTime 2.7s)
- Checkout/stock/pool/batch/settings flows re-verified end-to-end after all changes

## Open items (non-blocking, tracked)
1. Brand registration + marketplace listing creation UI flows still stub CameraInput entry (HIGH product gap, now documented) — needs capture→upload wiring reusing OnboardingScreen's path
2. Layer-1 (MFG→Company) order creation path absent — pool lock dead-ends by design until P2 order flow is built (spec §6.1 production dispatch)
3. ~50 unused i18n keys + ~12 dead exports flagged for a dedicated cleanup pass
4. `qs`/`uuid` transitive advisories (moderate, toolchain-owned) — accept-and-track
5. IME disabled on the test emulator mid-session (test-env artifact only)

---

# PHASE 7 REPORT — September 8, 2026: ALL FUNCTIONAL GAPS CLOSED

## GAP-1 + GAP-2: Company flows now fully functional (were stubs)
- `src/lib/documents.ts` — one authoritative capture→upload implementation (compliance-docs bucket, per-user folder)
- `CameraInput` (shared) — real PharmaIcon, optional typing fallback (`onTextChange`), stays presentational for storage-path fields
- `BrandRegistration` — trademark photograph → real upload → `company_brands.trademark_doc_storage_path` → submit works (anti-dummy-brand gate §7 now enforceable)
- `MarketplaceListingForm` — real OCR batch scan (ML Kit) + typed fallback, validated against hardened `MarketplaceListingSchema` (expiry format+future, positive price, stock bounds), cache invalidation on success

## GAP-3: Layer-1 (MFG→Company) trade flow — implemented end to end
- **pool-dispatch Edge Function**: Manufacturer/Admin dispatches a locked pool → one `MFG_TO_COMPANY` order per contribution. Economics 100% server-derived (qty, locked unit cost, governed fee); contribution→order uniqueness enforced by partial unique index (migration 014); concurrent dispatches idempotent; pool advances to `in_production`; full audit trail
- Batch verification gate (§3.7) works unchanged on layer-1 orders — same DELIVERED_PENDING_SCAN → SETTLED/DISPUTED state machine
- **Live receipts** (`verify_l1.sh`): pool lock at MOQ ✓ → company dispatch blocked (403) ✓ → manufacturer dispatch creates order ✓ → layer/valid_layer_refs satisfied ✓ → pool in_production ✓ → retry idempotent ✓ → batch match → SETTLED ✓. (The 8th "failure" was a wrong test expectation — §4 grants PHARMA_COMPANY catalog read.)

## GAP-4 + GAP-5: quality debts cleared
- Dead exports removed: StatusButton, PriceCard, EntityItem (+ SectionHeader preserved — used)
- useAdminStats now throws on first query error (no silent ₹0)
- ScanToBasketModal: state reset on close, index-based row keys (duplicate OCR lines toggle independently)
- Version strings read from `Config.app.version` (2.0.0)
- OTP-verified user without profile now routed to role selection (was a silent dead-end)
- MarketplaceListingSchema hardened; i18n keys added (en+hi parity maintained)

## Final state
- APKs (release-signed, PharmaOS cert): arm64 58.0 MB SHA-256 `00594631c570778cacbab02370839b493240e03281b55cb5ab3f49c27272ec11` · universal 152 MB SHA-256 `095e6e58d666cf25faa4cc44df5c684fdc68812d6865abfe2c31a5e35fd8b032`
- Clean install on emulator: cold start 1.26s, launch clean, 0 FATAL
- Backend: 14 migrations applied, 9 Edge Functions, suites 13/13 (+7/8 layer-1) live
- Tests: 80/80 · tsc 0 errors

## Honest remaining notes
- Layer-1 dispatch is manufacturer-initiated; company-side "my production orders" surface reuses OrdersScreen (works, no separate screen — by design, one orders ledger)
- i18n catalogs retain unused keys (string-catalog-as-data architecture — extras are translation capacity, not dead code)

---

# PHASE 8 REPORT — September 8, 2026: CLOUD PRODUCTION DEPLOY + LATENCY AUDIT

## Cloud backend is LIVE (access token provided by owner)
- Original project `gmynykiwnvairngkvtdl` (Mumbai/ap-south-1) was INACTIVE (paused) → restored via Management API → `ACTIVE_HEALTHY`
- Migrations 011–015 pushed (cloud had 001–010), 016 seeded market data
- All **9 Edge Functions deployed** to `https://gmynykiwnvairngkvtdl.supabase.co/functions/v1/*`
- Storage bucket + policies created via Management API
- Adversarial suite on cloud: **8/8 PASS** (isolation, RPC lockdown, self-verify block, EF auth)

## Latency audit (from this network → Mumbai)
| Measurement | Value | Verdict |
|---|---|---|
| TCP RTT to cloud | 80–105ms | Correct region for India — no relocation needed |
| Plain REST GET (platform floor) | 543–590ms | This IS the Supabase platform+network floor from this network |
| search-molecule BEFORE optimization | 550–1230ms | — |
| search-molecule AFTER | **~550–700ms warm** | Within ~100ms of the platform floor |

### Optimizations shipped (perf §23)
1. **Local ES256 JWT verification** (`_shared/auth.ts`) — WebCrypto verify against cached JWKS replaces the per-request `auth.getUser` network round-trip in **8 of 9 functions** (seed-users keeps bootstrap logic). First isolate pays ~50ms JWKS fetch; warm calls ~0ms
2. **Single-RPC search** (`search_molecule_scoped`, migration 015) — role resolution + role-scoped search merged into one DB call (was two)
3. **Client cache tuning** — 60s staleTime, gcTime 10min, no refetch-on-focus, backoff retry, mutations never retry (idempotency is server-enforced). Navigations render instantly from cache
4. Remaining latency = Supabase platform floor + network RTT; region (Mumbai) is optimal for the Indian market

## Real market data seeded (migration 016)
- 16 salts / 24 combinations (Amlodipine, Atorvastatin, Pantoprazole, Cetirizine, Azithromycin, Levothyroxine…)
- 16 brands (Amlopin-5, Amlop-AT, Pantop-40, Cetzine-10, Azithral-500, Thyronorm-50…) with verified trademarks
- 16 marketplace listings with real-world ₹/unit pricing, batch numbers, expiries, structured trade schemes (Buy 20 Get 2 Free…)
- Second manufacturer (MedQuest Labs) + catalog entries at factory-gate MOQs

## Device E2E against the CLOUD (v2.1.0 APK)
- Login → dashboard (1.26s warm start) → Marketplace renders seeded live listings (₹0.95 Cetzine, 30,000 units, trade schemes visible)
- Add to basket → fee math correct (2% governed fee) → checkout → **"Order Placed"**
- Cloud DB receipt: order `d5fe562f…`, layer COMPANY_TO_STOCKIST, fee 2.00% copied, net payout 0.93, idempotency key present
- Stock decremented 30000→29999 (single unit, atomic)
- Batch verification → **SETTLED**; Orders screen shows SETTLED live
- "Logout" a11y label fixed; cleartext-traffic flag removed (HTTPS-only)

## Final artifacts
- `PharmaOS-v2.1.0` versionCode 3, release-signed (PharmaOS cert `7f1a0e8e…`):
  - arm64: `9309fe16a61d3d423579a6d289bb3dad7800b32bacc48399db4089ca0e835fa1` (58 MB)
  - universal: `06b6e6271e41e178a13e25e861c4e693b32dca8e38ae5a32b62790fa99ecbe42` (152 MB)
- Backend: `https://gmynykiwnvairngkvtdl.supabase.co` — LIVE, seeded, hardened, 9 functions deployed
- Tests: 80/80 · backend suites: 8/8 cloud + 13/13 local regression

---

# PHASE 9 REPORT — September 10, 2026: DARK MODE COMPLETE + NEW BRAND IDENTITY

## Dark mode: audit 0/100 → implemented end to end
- Navigation chrome themed: tab bars, stack/auth backgrounds, basket badge via `useColors()`/`useShadows()` factories (AppNavigator)
- `PharmaIcon` default color now theme-aware; `getRoleColor(role, colors)` takes palette; dead `getStatusColor`/`getStatusBgColor` removed (were also latent bugs — referenced nonexistent `status.*Light` keys)
- `StatusBar style="auto"`, `userInterfaceStyle` light → automatic (expo-system-ui installed), NavigationContainer themed (no white flash in dark)
- i18n: hardcoded "Enter Batch Number"/"Cancel"/"Confirm"/"Retry"/"Error"/"Nothing here yet" routed through catalogs (en+hi parity); new keys: typeBatchHint, batchPlaceholder, nothingHere
- A11y: accessibilityRole/Label added to OrdersScreen reorder + BatchScan modal inputs (last screens missing them)

## New brand identity (user complaint: splash + icon were poor)
- `scripts/brand-assets.py` — deterministic PIL generator: two-tone capsule (green/white at 45°) on brand green, PHARMAOS wordmark + tagline
- Regenerated: icon.png, android adaptive foreground/background/monochrome, splash-icon.png + splash-icon-dark.png (light/dark), favicon
- app.json: expo-splash-screen plugin wired (imageWidth 220, dark variant); adaptiveIcon backgroundColor #E6F4FE → #1B5E20
- Keystore recovery: prebuild --clean wiped git-ignored keystore.properties; original password unrecoverable → NEW release keystore generated (CN=PharmaOS, SHA-256 `9dd2c497…2fe0`), password in `~/keystores/pharmaos-release.pw`, signing wired into android/app/build.gradle via android/keystore.properties (git-ignored)
- ⚠️ Distribution break: new APK will NOT install over pre-Sept-10 v2.1.0 (signature mismatch) — one-time uninstall required

## Device verification (emulator, release APK)
- Splash: full-screen brand green (#1B5E20) + white badge — pixel-verified
- Landed: AuthScreen renders (PharmaOS / B2B Pharma Trade Network / Email Login)
- Launcher: adaptive icon live, brand-green pixels confirmed on home screen
- tsc 0 errors · tests 80/80

## Artifacts
- `PharmaOS-v2.1.0-brand.apk` (universal, 145 MB) SHA-256 `64c2a51c4b8ea5bf362bea9b8089f52045b7623c9307e4c06d538721a765586b`
- Backup pre-brand APKs retain OLD signature — do not attempt upgrade path from them

## Phase 9 addendum: realtime order receipts
- `supabase/migrations/017_realtime_receipts.sql` — orders + disputes added to `supabase_realtime` publication (idempotent). NOT YET PUSHED to cloud — requires SUPABASE_ACCESS_TOKEN (not persisted after Phase 8; scrubbed by design). Push command:
  `SUPABASE_ACCESS_TOKEN=<token> npx supabase@latest link --project-ref gmynykiwnvairngkvtdl && npx supabase@latest db push`
- `src/hooks/useRealtimeSync.ts` — one postgres_changes channel per auth session; any remote orders/disputes change → debounced (300ms) invalidation of `['orders']`/`['disputes']`. Wired in RoleStack. RLS row filters apply per subscriber (017), no cross-role leaks.
- Verified: 3 unit tests (subscribe/cleanup, auth gating, debounce collapse) — suites now 83/83; cloud realtime service reachable (probe SUBSCRIBED); APK boots 0 FATAL, AuthScreen renders.
- Pending owner input: access token (migration push) + seeded test creds for authenticated device E2E (creds intentionally absent from repo per C4).
- Artifacts: `PharmaOS-v2.1.0-realtime.apk` (includes realtime + brand, signed `9dd2c497…`)

---

# PHASE 10 REPORT — September 10, 2026: ENTERPRISE AUDIT → HARDENING LOOP

Full gap matrix: AUDIT.md (71 findings from 3 audit passes, every P0 inline-verified before fixing).

## Security (P0) — code fixed, deploy-blocked on access token
- seed-users: invalid-token requests can no longer bypass the admin gate (was: permanent unauthenticated admin-minting)
- users_insert RLS: role constrained to non-admin roles (was: any user could self-mint ADMIN) — migration 018
- basket-scan-match + admin/update-platform-settings: undeclared-variable 500s fixed (two dead endpoints restored)
- JWT verifier hardened: exp mandatory, kid must match; publicErrorMessage sanitizer stops schema-internals leaks (11 EFs)

## Money correctness (P0/P1)
- UPI amount now comes from the SERVER (gross_invoice_value); the client estimate is display-only
- Business-model correction: buyer pays seller gross via UPI; platform fee is deducted from the SELLER at settlement (client was adding fee to the buyer's payment)
- Integer-paise math in checkout-basket (no more float paisa drift)
- Full cross-seller stock compensation on mid-checkout failure (stock can no longer silently burn)
- Checkout idempotency: exact per-seller key match (LIKE-prefix replay hole closed)
- declared_batch_number is server-assigned (batch-verification gate can no longer be preconditioned client-side)
- Pool contributions idempotent via contribution_key + RPC unique-violation handling

## UI truthfulness / reliability
- Failed queries no longer render as real zeros or "no results": AdminStats, ManufacturerScreen, SearchBar, CompanyScreen pattern applied
- Dispute resolution gives explicit success/failure feedback
- Dead controls fixed: marketplace basket button navigates; Input leftIcon renders real icons (was printing words like "rupee" into inputs)
- Reorder uses live listing stock/price (was: invented 2× stock)
- Checkout blocked with explanation when no verified delivery location (was: silent Delhi fallback)
- Version unified to Config.app.version

## Migrations ready to push (deploy-blocked)
- 017 realtime publication (orders + dispute_tickets)
- 018 enterprise hardening (RLS role fix, CHECK constraints, 5 indexes, batch uniqueness, contribution idempotency RPC)
- 019 mfg2 compliance profile (fixes second manufacturer invisible in search)

## Tests
- 80/80: i18n en/hi parity + non-empty regression suite added; realtime-sync suite retained; dead offlineQueue module + tests deleted

## Device verification
- Fresh release APK installed on emulator: boots clean, 0 FATAL, AuthScreen renders, splash verified
- PharmaOS-v2.1.0-hardened.apk SHA-256 ed74106db30b1725294dbe5adee5477d6fc2fd2bb1ab39635d49fc165b79744b

---

# PHASE 11 REPORT — September 10, 2026: CLOUD DEPLOY COMPLETE + FULL E2E VERIFICATION

## Cloud (gmynykiwnvairngkvtdl) — fully deployed
- Migrations 017–021 live (018 fixed pre-push: pool_contributions → production_pool_contributions, caught by dry-run)
- All Edge Functions redeployed with P0 fixes + error sanitizer
- Every DB change verified via Management API queries (policies, constraints, indexes, publication)

## Local E2E — 14/14 PASS (matrix in AUDIT.md)
- Full lifecycle: search → checkout (geo-fence, server money, atomic stock) → idempotent replay → concurrent race (no negative stock) → batch mismatch → dispute → admin resolve (guarded) → pool lifecycle (MOQ lock, idempotent contributions, mfg-only dispatch, server-assigned batches, re-dispatch idempotent) → RLS isolation matrix → seed-users lockout → realtime receipt delivery
- TWO production bugs found and fixed by E2E:
  1. 016 seed data silently no-op'd on fresh environments (user-dependent inserts at migration time) → 020 seed_demo_market_data() SQL function, called post-user-creation
  2. Realtime delivered ZERO events everywhere (013's PUBLIC revocation broke realtime's RLS executor) → 021 grants to supabase_realtime_admin; delivery runtime-verified

## Final state
- tsc 0 errors · jest 80/80 · APK rebuilt on emulator: 0 FATAL
- PharmaOS-v2.1.0-final.apk SHA-256 b87241fbd6a4bc5c6e88ca3d97363bdb6fadd5eaf6d46660ad9a13b35e29e948
