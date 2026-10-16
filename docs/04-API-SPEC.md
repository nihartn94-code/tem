# PharmaOS — API Specification v1.0

**Companion to:** `01-SRS.md`, `02-ARCHITECTURE.md`, `03-DATABASE-SCHEMA.md`.

## 1. API Shape Overview

Two access patterns, chosen per operation based on whether it's a simple RLS-protected read/write or business logic that must be server-authoritative:

1. **Direct Supabase client calls** (PostgREST auto-generated REST, or the Supabase JS client) — used for simple CRUD the RLS policies in `03-DATABASE-SCHEMA.md` §9 already protect correctly: reading your own orders, browsing the marketplace, updating your own compliance profile fields.
2. **Supabase Edge Functions** (Deno/TypeScript, deployed alongside the DB) — used for **every operation with financial or cross-party consequence**, listed in §2 below. These use the service-role key server-side and perform their own authorization checks rather than relying solely on RLS, because the logic (fee calculation, pool matching, escrow release) is exactly the kind of thing SRS §4 says must never be trusted to the client.

**Rule for extending this API:** if a new operation moves money, changes another party's visible state, or decides a dispute outcome, it is an Edge Function, never a direct client write. If in doubt, treat it as an Edge Function — the cost of an unnecessary one is a slightly longer request; the cost of a missing one is a client-side trust bug.

---

## 2. Edge Functions (server-authoritative business logic)

### 2.1 `POST /functions/v1/onboard-compliance`
**Callers:** any authenticated non-Admin user, once, at signup.
**Input:**
```json
{
  "legal_entity_name": "string",
  "gstin": "string",
  "drug_license_number": "string",
  "drug_license_expiry": "YYYY-MM-DD",
  "who_gmp_certified": false,
  "facility_lat": 0.0,
  "facility_lng": 0.0,
  "license_doc_storage_path": "string (already-uploaded Storage path)",
  "gmp_cert_storage_path": "string|null"
}
```
**Behavior:** validates GSTIN format, checks `drug_license_expiry` is in the future, inserts `compliance_profiles` with `verification_status = 'pending'`, writes an `audit_log` entry, and (Phase 2+) calls a CDSCO/state-FDA verification API if/when one is integrated — Phase 1 ships with `pending` requiring a manual Admin approve action (§2.6) rather than assuming an automated government API integration exists on day one, since that dependency is external and not guaranteed available.
**Output:** the created `compliance_profiles` row.

### 2.2 `POST /functions/v1/search-molecule`
**Callers:** any authenticated user.
**Input:** `{ "query": "string", "language": "en|hi|..." }`
**Behavior:** runs `pg_trgm` similarity search across `chemical_salts.salt_name` and `company_brands.brand_name` (scoped to the caller's visible tables per their role — a Stockist's search never touches `manufacturer_catalog`), returns ranked results **clustered by `combination_id`** with every valid Stockist-visible offer for that combination sorted cheapest-first, per SRS §3.2's core anti-brand-premium mechanic. This endpoint is the same one both typed and voice search (after on-device speech-to-text) call — no separate "voice search" backend path.
**Output:**
```json
{
  "combinations": [
    {
      "combination_id": "uuid",
      "display_composition": "string",
      "offers": [
        { "brand_id": "uuid", "brand_name": "string", "company_id": "uuid",
          "price_per_unit": 0.0, "available_stock": 0, "trade_scheme": {} }
      ]
    }
  ]
}
```

### 2.3 `POST /functions/v1/basket-scan-match`
**Callers:** Stockist.
**Input:** `{ "ocr_extracted_lines": ["string", "string", ...] }` (raw text lines from the on-device OCR pass over a photographed order list)
**Behavior:** fuzzy-matches each line against the molecule/brand search index (reusing §2.2's matching logic), returns a candidate match **with a confidence score** per line — never auto-adds a low-confidence match to the basket; the app must show it for human confirmation per SRS §3.5's "never silently auto-submitted" rule.
**Output:** `{ "matches": [{ "input_line": "string", "candidate_combination_id": "uuid|null", "confidence": 0.0 }] }`

### 2.4 `POST /functions/v1/checkout-basket`
**Callers:** Stockist.
**Input:**
```json
{
  "items": [{ "marketplace_listing_id": "uuid", "quantity": 0 }],
  "payment_channel": "ESCROW_INSTANT|NBFC_CREDIT_LINE|STANDARD_CREDIT_TERMS",
  "delivery_lat": 0.0, "delivery_lng": 0.0
}
```
**Behavior:**
1. Server-side re-validates every listing's current price/stock (never trusts client-cached prices — prevents a stale-price checkout).
2. Confirms `delivery_lat/lng` is within the buyer's own verified `compliance_profiles.facility_lat/lng` radius (SRS §6.3 anti-split-account check) — rejects with a clear error otherwise, does not silently proceed.
3. Looks up current `platform_settings.global_fee_pct` and applicable cash-velocity discount, computes gross/fee/discount/net values, and **copies them onto the order row** (never a live lookup at settlement — see `03-DATABASE-SCHEMA.md` notes).
4. Creates one `orders` row per distinct seller in the basket (a multi-seller basket per SRS §3.5's "split across sellers" option becomes multiple order rows, one escrow transaction each).
5. Calls the Razorpay Route (or Cashfree) API to create the actual escrow hold.
6. Decrements `stockist_marketplace.available_stock_units` atomically.
**Output:** `{ "orders": [{ "order_id": "uuid", "escrow_provider_ref": "string", "net_seller_payout": 0.0 }] }`

### 2.5 `POST /functions/v1/confirm-batch-delivery`
**Callers:** the buyer on that order (Company for MFG_TO_COMPANY, Stockist for COMPANY_TO_STOCKIST).
**Input:** `{ "order_id": "uuid", "scanned_batch_number": "string" }`
**Behavior:** compares `scanned_batch_number` against `orders.declared_batch_number`.
- **Match** → sets `state = 'DELIVERED_CONFIRMED'`, triggers the Razorpay Route payout split to the seller, sets `state = 'SETTLED'`, writes `audit_log`.
- **Mismatch** → sets `state = 'DISPUTED'`, auto-creates a `dispute_tickets` row with `reason = 'BATCH_MISMATCH'`, freezes the escrow hold (no payout call made), notifies the seller and Admin via push. This is the concrete implementation of SRS §3.7/§6.2's "mismatch automatically freezes release."
**Output:** `{ "state": "SETTLED|DISPUTED", "dispute_ticket_id": "uuid|null" }`

### 2.6 `POST /functions/v1/admin/resolve-dispute`
**Callers:** Admin only (checked server-side against `users.role`, not just trusted from a client flag).
**Input:** `{ "dispute_ticket_id": "uuid", "resolution": "RELEASED_TO_SELLER|REFUNDED_TO_BUYER" }`
**Behavior:** calls the corresponding Razorpay Route release-or-refund API, updates `dispute_tickets.resolution` and `orders.state`, writes `audit_log` with the Admin's `actor_id`. This is SRS §3.8's "one-click action triggers actual fund movement automatically" requirement — never a manual bank transfer the Admin has to do outside the app.

### 2.7 `POST /functions/v1/admin/update-platform-settings`
**Callers:** Admin only.
**Input:** any subset of `platform_settings` columns.
**Behavior:** updates `platform_settings`, writes one `platform_settings_history` row per changed field with `old_value`/`new_value`. This is what makes SRS §3.9's fee-change requirement auditable, not just mutable.

### 2.8 `POST /functions/v1/production-pool/contribute`
**Callers:** Company.
**Input:** `{ "manufacturer_catalog_id": "uuid", "requested_quantity": 0, "intended_brand_name": "string", "packaging_spec": {}, "agreed_unit_cost": 0.0 }`
**Behavior:** finds or creates the open `production_pools` row for that `manufacturer_catalog_id`, inserts the `production_pool_contributions` row, atomically increments `accumulated_quantity`. If the increment crosses `target_quantity`, sets `production_pools.status = 'locked'`, `locked_at = now()`, and fires a notification to the Manufacturer and every contributing Company — this atomic increment-and-check is exactly why pool matching lives in an Edge Function and not client-side math (SRS §3.3, `02-ARCHITECTURE.md` §4.2).
**Output:** `{ "pool_id": "uuid", "pool_status": "open|locked", "accumulated_quantity": 0, "target_quantity": 0 }`

---

## 3. Direct Supabase Client Operations (RLS-protected, no Edge Function needed)

| Operation | Table(s) | Notes |
|---|---|---|
| View own orders | `orders` (via RLS `orders_participant_only`) | Read-only; state transitions only ever happen via §2.4/§2.5/§2.6 |
| Browse marketplace | `stockist_marketplace` joined to `company_brands`, `formulation_combinations` | RLS restricts to Stockist/Company/Admin |
| Browse manufacturer catalog | `manufacturer_catalog` | RLS restricts to Manufacturer/Company/Admin — **a direct client query from a Stockist session returns zero rows, enforced by Postgres itself** |
| List/register a brand | `company_brands` INSERT | Company only, per RLS; trademark doc verification (`is_verified_trademark`) is set `false` by default and only flipped `true` by an Admin action, never by the inserting client |
| Update own compliance doc paths | `compliance_profiles` UPDATE (own row only) | Re-triggers `verification_status = 'pending'` via a Postgres trigger if `drug_license_number`/`gstin` change, so an edited license always gets re-checked |

---

## 4. Realtime Subscriptions

Supabase Realtime (Postgres logical replication over WebSocket, included free) powers:
- Live order-state updates on the Stockist/Company "My Orders" screen (no polling).
- Live production-pool progress bar (`accumulated_quantity`/`target_quantity`) on the Company's sourcing screen, per the original business design's "live countdown progress bar" request — implemented here as a Realtime-subscribed value, not a client polling loop, which is both cheaper and instant.
- Admin dispute queue live updates.

---

## 5. Error Handling Convention

Every Edge Function returns errors in one shape:
```json
{ "error": { "code": "STRING_CODE", "message": "human-readable", "field": "optional-field-name" } }
```
Client-side, this maps to inline field errors (via React Hook Form) where `field` is present, or a toast otherwise — never a raw stack trace or provider error message surfaced to a semi-literate end user (SRS §5 UX principles apply to error states too, not just happy paths).

---

*Next: `MASTER_PROMPT.md` — hand the full document set (`01`–`04`) to a development agent with this as the entry-point instruction.*
