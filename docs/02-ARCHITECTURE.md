# PharmaOS — Technical Architecture & Cost-Optimized Stack v1.0

**Companion to:** `01-SRS.md`. This document specifies exactly what to build with, why each choice was made against the "almost free" constraint, and what it costs at three real scale points.

---

## 1. Guiding Principle

Every component below was chosen by asking: *"Is there a genuinely free or near-free option that meets this requirement, and does introducing a paid service here buy something a free option structurally cannot?"* Where a paid service is unavoidable (payment/escrow processing, SMS OTP at volume), it's called out explicitly with its real per-transaction cost — never hidden inside a vague "cloud costs" line.

---

## 2. High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  REACT NATIVE APP (Expo) — 4 role-scoped experiences          │
│  Admin / Manufacturer / Company / Stockist                    │
│  One codebase, role determined by auth session, not 4 apps    │
└───────────────────────────┬──────────────────────────────────┘
                             │ HTTPS (REST/RPC) + Realtime (WebSocket)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  SUPABASE (single managed backend — free tier, self-hostable  │
│  later if scale demands it)                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐ │
│  │ Postgres   │ │ Auth       │ │ Storage    │ │ Edge         │ │
│  │ (schema in │ │ (phone OTP │ │ (license/  │ │ Functions    │ │
│  │ 03-SCHEMA) │ │ + role)    │ │ COA docs,  │ │ (Deno/TS —   │ │
│  │            │ │            │ │ photos)    │ │ business     │ │
│  │            │ │            │ │            │ │ logic: pool  │ │
│  │            │ │            │ │            │ │ matching,    │ │
│  │            │ │            │ │            │ │ escrow calc) │ │
│  └────────────┘ └────────────┘ └────────────┘ └─────────────┘ │
│  Row-Level Security (RLS) policies enforce the role isolation  │
│  from SRS §1.2 — a Stockist's Postgres session literally       │
│  cannot SELECT from manufacturer_production_catalog, enforced  │
│  by the database itself, not just application code             │
└───────────────────────────┬──────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                     ▼
┌───────────────┐   ┌────────────────┐   ┌──────────────────┐
│ Escrow/Payment │   │ SMS OTP        │   │ Push Notifications│
│ Split Gateway  │   │ (Auth)         │   │ (Firebase Cloud   │
│ (Razorpay      │   │ (Supabase Auth │   │  Messaging — free)│
│  Route / Cash- │   │  built-in OR   │   │                    │
│  free Easy     │   │  MSG91 free    │   │                    │
│  Split — the   │   │  tier)         │   │                    │
│  one genuinely │   │                │   │                    │
│  paid-per-txn  │   │                │   │                    │
│  component)    │   │                │   │                    │
└───────────────┘   └────────────────┘   └──────────────────┘
```

---

## 3. React Native App Layer

| Concern | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo (managed workflow), TypeScript** | Expo's free tier covers builds (EAS Build has a free monthly build allowance), OTA updates (EAS Update free tier), and avoids needing to touch native Xcode/Android Studio config for most of this app's needs — fastest path to a real device install for a non-technical pilot user |
| Navigation | **React Navigation** | The de facto standard, free, no paid tier exists to accidentally reach for |
| State/data | **TanStack Query** wrapping Supabase client calls | Server-state caching, automatic refetch, optimistic updates for basket/order actions — same reasoning as any modern data-heavy app, free and open-source |
| Forms | **React Hook Form + Zod** | Type-safe validation shared between client and (where relevant) Edge Function input validation — one schema definition, not two |
| Camera / OCR | **`react-native-vision-camera` + on-device ML Kit Text Recognition** (via `@react-native-ml-kit/text-recognition`, free, runs fully on-device) | **On-device OCR means zero per-scan cost** — this is the single most important cost decision in the whole app, since batch-verification scanning (SRS §3.7) and basket-list scanning (SRS §3.5) both happen at very high frequency. A cloud OCR API (Google Vision, AWS Textract) would turn into a real per-transaction cost line at scale; on-device ML Kit does not |
| Voice input | **`@react-native-voice/voice`** (wraps the OS's native speech recognizer — free, on-device on both iOS and Android) | Same reasoning as OCR: voice search (SRS §5.3) must not become a per-query cost at scale |
| Offline sync | **Supabase's client-side cache + a lightweight local queue (MMKV or AsyncStorage) for basket actions taken offline, flushed on reconnect** | Meets SRS §4's offline-resilience requirement without pulling in a heavier offline-sync framework (e.g., WatermelonDB) that this app's actual sync needs (basket composition, not full bidirectional live collaboration) don't justify |
| Localization | **`i18next` + `react-i18next`**, string catalogs per language, voice-input language selector feeding the same locale | Free, standard, and — critically — architected as data (JSON catalogs) not code, so adding Tamil/Telugu/Marathi later is a translation task, not an engineering one |
| Push | **Firebase Cloud Messaging**, free at any realistic pilot-to-mid volume | Industry-standard, zero cost until a scale far beyond this platform's near-term needs |

---

## 4. Backend: Why Supabase, Specifically

Considered alternatives and why they lost:
- **Custom Node/NestJS + self-hosted Postgres**: more control, but means building auth, RLS-equivalent authorization, storage, and realtime from scratch — pure engineering time cost with no functional benefit over Supabase at this stage. Revisit only if/when Supabase's free/pro tier limits are actually hit in production (a real, observed problem, not a hypothetical one) — Supabase is fully open-source and self-hostable, so this is not a lock-in dead end, it's a genuine "start managed, self-host later if the bill justifies the ops burden" path.
- **Firebase (Firestore) instead of Supabase**: rejected because this platform's data is fundamentally **relational** (the Manufacturer/Company/Stockist isolation in SRS §1.2 depends on real foreign-key structure and row-level security policies) — a document database fights this data shape rather than helping it. Firebase remains in the stack anyway, but scoped to what it's actually good for: push notifications (FCM) only.
- **AWS full stack (RDS, Cognito, S3, Lambda)**: capable, but nothing in AWS's free tier is as generous or as fast-to-a-working-app as Supabase's, and self-managing IAM/VPC/RDS correctly is a much larger ops burden than this project's team size justifies for an MVP.

### 4.1 Row-Level Security as the enforcement layer for SRS §1.2
Every table has an RLS policy keyed off `auth.jwt() ->> 'role'`. Concretely:
```sql
-- Stockists can only ever SELECT from the Company-facing marketplace table
CREATE POLICY stockist_marketplace_read ON stockist_procurement_marketplace
  FOR SELECT USING (auth.jwt() ->> 'role' = 'STOCKIST' OR auth.jwt() ->> 'role' = 'ADMIN');

-- Manufacturer catalog is NEVER selectable by a Stockist session at all
CREATE POLICY manufacturer_catalog_read ON manufacturer_production_catalog
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('MANUFACTURER', 'PHARMA_COMPANY', 'ADMIN'));
```
This is the real mechanism behind SRS §1.2's claim that the isolation is structural, not policy — a compromised or buggy frontend cannot leak manufacturer pricing to a Stockist, because the database itself refuses the query.

### 4.2 Edge Functions for business logic that must not live in the client
- **Production Pool matching** (SRS §3.3): recalculating pool totals and triggering a batch lock must be atomic and server-authoritative — never computed client-side and trusted.
- **Escrow fee-split calculation** (SRS §3.6, §6.3 of SRS): the platform-fee-percentage lookup and gross/net split math happens in an Edge Function that the payment gateway webhook calls into, not in the app.
- **Batch-OCR match verification** (SRS §3.7): the app sends the scanned batch number; the Edge Function does the authoritative compare against the declared batch number and decides escrow release/freeze — the app only displays the result, it never itself decides to release funds.

---

## 5. Payments & Escrow — the one real line item

Full escrow-with-split-payout at B2B scale genuinely requires a licensed payment aggregator; there is no free way to legally hold and split third-party funds. Two realistic options, both India-focused and built for exactly this multi-party-split use case:

| Provider | Model | Approx. cost |
|---|---|---|
| **Razorpay Route** | Marketplace/split-payment product — funds collected from buyer, auto-split to seller(s) + platform fee | ~2% + GST per transaction (standard Razorpay rate; route/split itself has no extra platform fee from Razorpay beyond standard processing) |
| **Cashfree Easy Split** | Equivalent split-payment product | Comparable per-transaction pricing, competitive with Razorpay |

**Recommendation: start with Razorpay Route** — better-documented split-payment API, strong India B2B adoption, and a genuine test/sandbox mode that costs nothing during development. This is the one component in this entire stack that is a true per-transaction cost, and it is disclosed here explicitly rather than glossed over — the platform's own fee (SRS §1.3) needs to be set with this processing cost in mind, not net of it.

---

## 6. Real Cost Breakdown at Three Scale Points

| Component | Pilot (≤50 accounts, ≤500 orders/mo) | Growth (≤2,000 accounts, ≤20k orders/mo) | Scale (≤20,000 accounts, ≤500k orders/mo) |
|---|---|---|---|
| Supabase | **$0** (free tier: 500MB DB, 1GB storage, 2GB bandwidth — sufficient at pilot volume) | **$25/mo** (Pro tier — needed for backup retention + higher limits, not a functional cliff) | **$25–599/mo** depending on compute add-ons, or self-host on a $40–80/mo VPS once volume justifies the ops time |
| React Native / Expo | **$0** (EAS free tier build allowance covers pilot cadence) | **$0–29/mo** (EAS Production plan if build frequency exceeds free allowance) | **$99/mo** (EAS Team plan for higher build concurrency) |
| Firebase Cloud Messaging | **$0** | **$0** | **$0** (FCM has no meaningful cost ceiling for this use case) |
| SMS OTP (auth) | **$0–5/mo** (MSG91/Supabase Auth free allowance) | **~$0.10–0.15 per OTP** beyond free tier | Same per-OTP rate, scales linearly — budget it as a real line item, not "free," past pilot |
| On-device OCR / Voice | **$0 always** | **$0 always** | **$0 always** — this is the payoff of the on-device-first decision in §3 |
| Razorpay Route (payments) | **~2% of GMV** | **~2% of GMV** | **~2% of GMV, often negotiable lower at true scale** |
| **Total fixed infra (excl. payment processing)** | **~$0–5/month** | **~$25–55/month** | **~$125–700/month** |

The only cost that scales with revenue rather than staying near-fixed is payment processing — which is correct, since it's a percentage the platform's own fee model (SRS §1.3) already accounts for as a cost of doing business, not a surprise.

---

## 7. Deployment & Environments

- **Dev**: Supabase free-tier project + Expo Go for rapid iteration, no build step needed for most UI/logic work.
- **Staging**: separate Supabase free-tier project (isolation from production data), EAS internal-distribution build for real-device testing with the team.
- **Production**: Supabase Pro (once past pilot scale per §6), EAS Production build submitted to Play Store / App Store. CI via **GitHub Actions** (free minutes tier) running lint/typecheck/test on every PR before merge.

---

*Next: `03-DATABASE-SCHEMA.md` for the complete schema this architecture runs on, `04-API-SPEC.md` for the Edge Function and REST contract, `MASTER_PROMPT.md` to hand this whole document set to a development agent.*
