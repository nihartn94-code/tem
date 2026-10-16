# PharmaOS

Asset-light B2B pharmaceutical trade network: Manufacturer → Company → Stockist.
React Native (Expo 57, TypeScript) + Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage, Realtime).

## Roles
- **STOCKIST** — molecule search, marketplace, smart-basket (camera OCR), checkout, batch verification
- **PHARMA_COMPANY** — brand registry, manufacturer sourcing, production pools, listings
- **MANUFACTURER** — production catalog, pools
- **ADMIN** — disputes, platform settings, broadcast, health dashboard

## Core guarantees (enforced at the database layer)
- Manufacturer↔Stockist isolation via RLS — no shared FK by design
- Zero-day license ghosting — expired license hides all listings instantly (`active_compliant_users` choke-point)
- Fee/discount immutability — copied onto order rows at creation, never recomputed
- Checkout idempotency — `orders.idempotency_key` unique index
- Atomic pool threshold locking — single SQL transaction, advisory-locked

## Repository layout
```
src/                 React Native app (screens, components, hooks, i18n en+hi)
supabase/
  migrations/        001–012 (apply in order; idempotent)
  functions/         8 Edge Functions (checkout, batch gate, pools, admin, search, OCR match)
scripts/
  deploy-supabase.sh  push migrations + deploy functions to a cloud project
  verify-backend.sh   adversarial RLS + EF auth suite (works local or cloud)
android/             prebuilt native project (or `npx expo prebuild`)
```

## Quick start (local backend)
```bash
supabase start                      # 12-container local stack
supabase migration up --local       # or: supabase db reset
supabase functions serve
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "INSERT INTO storage.buckets (id,name,public) VALUES ('compliance-docs','compliance-docs',false) ON CONFLICT DO NOTHING;"
curl -X POST http://127.0.0.1:54321/functions/v1/seed-users \
  -H "apikey: $(supabase status -o env | grep ANON_KEY | cut -d'"' -f2)" -d '{}'
cp .env.local.example .env.local    # app talks to 10.0.2.2:54321 from the emulator
npm install && npm run android
```

## Cloud deployment
```bash
SUPABASE_ACCESS_TOKEN=... PROJECT_REF=... DB_PASSWORD=... ./scripts/deploy-supabase.sh
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=... ./scripts/verify-backend.sh
```

## Seeded logins (local/dev)
| Role | Email | Password |
|---|---|---|
| Admin | admin@pharmaos.io | Admin123! |
| Manufacturer | mfg@pharmaos.io | MfgPass123! |
| Company | company@pharmaos.io | Company123! |
| Stockist | stockist@pharmaos.io | Stock123! |

## Test & verify
```bash
npx tsc --noEmit     # 0 errors
npx jest             # 75/75 (utils, validation, auth, compliance, security)
```

## Build
```bash
cd android && ./gradlew :app:assembleRelease
# Outputs: app-arm64-v8a (~61 MB, devices), app-universal (~163 MB, emulator fallback)
```

See `PROGRESS.md` for the full verification ledger (every claim has a command receipt)
and the master-document compliance matrix.
