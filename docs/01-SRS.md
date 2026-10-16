# PharmaOS — Software Requirements Specification (SRS) v1.0
## Asset-Light B2B Pharma Trade Network (Manufacturer → Company → Stockist)

**Platform type:** React Native mobile app (4 role-based experiences) + web Admin console
**Target market:** India first (CDSCO/state FDA regulatory scope), architected to extend to other regulated markets later
**Companion documents:** `02-ARCHITECTURE.md`, `03-DATABASE-SCHEMA.md`, `04-API-SPEC.md`, `MASTER_PROMPT.md`

---

## 1. Business Model (the contract every technical decision below serves)

### 1.1 The four roles
| Role | Who they are | What they can do | What they cannot do |
|---|---|---|---|
| **Admin** | Platform operator | No-code control of fee %, compliance gating, dispute arbitration, master medicine database | Cannot see or alter any party's private commercial terms beyond what's needed for arbitration |
| **Manufacturer** | Factory / contract manufacturing unit | List production-line capacity, chemical formulations, MOQ, factory-gate price | **Cannot sell to Stockists. Cannot see Stockist demand directly.** Sells only to Company |
| **Company (Brand)** | Virtual/physical pharma brand owner | Buys from Manufacturers, registers branded formulations, sells to Stockists, runs trade schemes | Is the **mandatory bridge** — every transaction must pass through a Company; Manufacturer and Stockist can never transact directly |
| **Stockist / Distributor** | Regional wholesale buyer | Buys only from Company-registered brand listings, browses molecule-first price comparison | **Cannot see or buy from the Manufacturer catalog at all** — it is not in their query scope |

### 1.2 Why the Company layer is structurally mandatory (not just a policy)
This is enforced at the **database and API level**, not by a rule a user could route around: `manufacturer_production_catalog` and `stockist_procurement_marketplace` are two disjoint tables with no foreign key between them. A Stockist-role JWT can never query the manufacturer catalog table — the API gateway rejects the request before it reaches business logic. See `03-DATABASE-SCHEMA.md` §2 and `04-API-SPEC.md` §1.3 for the exact mechanism.

### 1.3 Revenue model
A single, fixed, Admin-configurable **percentage fee on every invoice's gross value**, deducted automatically at the escrow-split moment — charged on both transaction layers (Manufacturer→Company and Company→Stockist). No subscriptions, no listing fees, no ad-based revenue. The platform's incentive is aligned with the platform's users: more trade volume through the app is the only way the platform earns more, so the platform's own interest is in making the app the cheapest, fastest, safest way to trade — never in extracting rent from a captive user.

### 1.4 What the platform does NOT own (asset-light, on purpose)
No trucks, no warehouses, no inventory, no physical quality control. Every seller (Manufacturer, Company) is contractually and legally responsible for the quality and timely delivery of what they list — enforced by the compliance and dispute mechanisms in §6, not by the platform taking on that liability itself.

---

## 2. Core Value Proposition Per Stakeholder

| Stakeholder | Real-world pain today | What PharmaOS gives them | Why they can't just leave and go back offline |
|---|---|---|---|
| Manufacturer | Idle factory capacity, unpredictable small-batch orders, expensive line-setup costs per small run | Pooled/aggregated demand from multiple Companies hitting MOQ faster → continuous, predictable production runs | An individual offline buyer alone can never match the pooled volume — offline is strictly worse pricing |
| Company/Brand | 20–30% of revenue burned on MR salaries, travel, doctor incentives, physical field marketing | Zero-MR digital distribution to a verified Stockist network; direct, pooled access to factory-gate manufacturing pricing | Losing platform access means losing both the pooled manufacturing rate and the digital Stockist reach simultaneously |
| Stockist | 10–15 phone/WhatsApp calls a day to different distributors, manual invoice reconciliation, chasing credit, no visibility into who's cheapest | One search → ranked cheapest-to-most-expensive verified Company offers for the same molecule; escrow-protected orders; optional instant-pay discount | Going offline forfeits escrow buyer-protection and the cash-velocity discount — offline is financially worse, not just less convenient |
| Admin (platform operator) | N/A — this is the platform owner's own seat | Full no-code governance: fee %, license gating, dispute resolution, master drug database — zero engineering time for day-to-day operation | N/A |

---

## 3. Functional Requirements by Module

### 3.1 Onboarding & Regulatory Compliance Gate
- Every non-Admin account requires: legal entity name, GSTIN, Drug License number + expiry (Form 20/21 for trade, manufacturing license for Manufacturers), facility geo-coordinates.
- **Zero-Day Automated Regulatory Ghosting**: license expiry date is stored and checked on every listing-visibility query — an expired license makes that account's listings invisible network-wide the instant the expiry date passes, with no human review needed for the *removal* (re-activation after renewal does require a document re-upload + Admin or automated-API re-verification, since a forged renewal document is a real risk a pure expiry-date check can't catch).
- WHO-GMP / lab-compliance certificate upload is mandatory for Manufacturers before any catalog listing goes live.
- OCR-assisted onboarding: the user photographs their physical license/GSTIN certificate; on-device OCR (see `02-ARCHITECTURE.md` §4) pre-fills the form fields for confirmation rather than requiring manual typing — critical for the semi-literate-user-friendly requirement (§5).

### 3.2 Molecule-First Master Medicine Database & Search
- Every product in the system is anchored to a **chemical salt / combination**, not a brand name. Brand names are a presentation layer on top of a `combination_id` (see `03-DATABASE-SCHEMA.md` §3).
- Typing (or speaking) a partial brand or salt name returns **fuzzy, typo-tolerant** suggestions (Postgres `pg_trgm` trigram matching — no external search service needed, keeps cost at zero; see `02-ARCHITECTURE.md` §3).
- Every search result for a branded product also surfaces the underlying molecule and every other Company's brand registered against that same molecule, ranked cheapest-first — this is the mechanism that breaks brand-premium pricing power described in the original business analysis.
- Admin can bulk-import the master salts/combinations list from a CSV/Excel (e.g., a CDSCO or NLEM published list) through a no-code upload screen — no engineering involvement for routine data updates.

### 3.3 Manufacturer → Company Trade Flow
1. Manufacturer lists production lines: molecule/combination, MOQ (minimum order quantity), factory-gate unit cost, lead time.
2. Companies browse **anonymized** manufacturer listings (see §6.1) and either place a direct order (if it independently meets MOQ) or join a **Production Pool** — multiple Companies' sub-MOQ requests for the same combination accumulate against a shared target; once the pool total crosses the Manufacturer's MOQ, the batch is automatically locked and production begins.
3. Custom packaging/branding specs are submitted per Company even within a shared pooled production run (one physical production run, multiple branded packaging outputs at the final boxing stage).
4. Real identity/contact details of the Manufacturer are revealed to the Company only after an escrow-backed purchase order is opened (§6.1) — this is what prevents the "meet on platform, transact offline forever after" leakage.

### 3.4 Company → Stockist Trade Flow
1. Company registers a branded formulation (`company_registered_brands`) against a `combination_id` it has secured manufacturing supply for.
2. Company lists it for sale to Stockists (`stockist_procurement_marketplace`) with wholesale price, available stock, batch number, expiry date, and optional trade scheme (e.g., "Buy 10 Get 1 Free" — stored as structured data, not free text, so it renders as a real UI element, not a string the Stockist has to parse).
3. Stockist search/basket flow (§3.5) matches demand to the cheapest valid Company offer for the requested molecule automatically.
4. Escrow payment is collected from the Stockist at checkout; funds release to the Company only after delivery is confirmed via the batch-OCR verification step (§6.2).

### 3.5 Stockist Ordering Experience ("Smart Basket")
- **Camera-first ordering**: the Stockist photographs their handwritten/printed daily order list; on-device OCR extracts line items; each extracted item is matched against the molecule database and shown for one-tap confirmation (never silently auto-submitted — a misread OCR item must be confirmed or corrected by the human before it enters the cart).
- **Auto-cheapest routing**: once the basket is confirmed, the system computes, per item, the lowest-price valid (license-current, in-stock) Company offer and assembles the full basket total — with an optional "split across 2 sellers to save ₹X more" alternative shown, not forced.
- **Payment method choice at checkout** (§3.6): standard credit-flagged price vs. instant-pay discounted price, shown side by side, not hidden in settings.
- **One-tap reorder** of any previous basket for recurring/chronic-medicine restocking.

### 3.6 Payments, Escrow & the Cash-Velocity Incentive
- All payments flow through a **platform-governed digital escrow** — the buyer's payment is held, not sent directly to the seller, until delivery is confirmed.
- **Dynamic Cash-Velocity Discount**: a Stockist who pays via instant escrow (versus a credit-term arrangement negotiated outside the standard flow) receives an automatic 2–6% discount, funded by the value the seller recovers from not having to chase a 30–90 day collection — the discount percentage is an Admin-configurable platform-wide default, with Company-level override allowed within an Admin-set floor/ceiling.
- **Optional NBFC credit-line integration**: for Stockists without ready cash, a short (7–15 day) interest-free digital credit line via a partnered NBFC funds the instant-pay flow on their behalf — this is a genuinely optional, later-phase integration (§8 Roadmap), not a Phase-1 requirement, since it depends on a real lending partner being signed and is out of the platform's own engineering control.
- Every invoice is split automatically at settlement: seller payout = gross invoice value − platform fee %. The split is computed and recorded atomically with the escrow release, never as a manual reconciliation step.

### 3.7 Quality & Delivery Verification (Batch-OCR Gate)
- On physical delivery, the receiving party (Company receiving from Manufacturer, or Stockist receiving from Company) must scan the batch number/expiry printed on the physical packaging via the in-app camera before the app allows them to mark the order "Received."
- The scanned batch number is checked against the batch number declared on the original digital order — mismatch **automatically freezes the escrow release** and opens a dispute ticket for Admin arbitration (§3.8), rather than silently releasing funds on a mismatch.
- This is the mechanism that makes "ship a different/expired batch than what was listed" a self-defeating strategy for a bad-faith seller.

### 3.8 Dispute Resolution (Admin, No-Code)
- Any escrow freeze (batch mismatch, non-delivery past SLA, buyer-reported quality issue with photo evidence) creates a `dispute_ticket` visible in the Admin console.
- Admin sees the structured evidence (declared batch vs scanned batch, delivery timestamp vs SLA, uploaded photos) and resolves with one of two one-click actions: **Release to seller** or **Refund to buyer** — both trigger the actual fund movement through the escrow provider's API automatically; Admin never manually wires money.
- Repeated disputes against the same account (configurable threshold, Admin-set) auto-flags that account for manual compliance review — not an automatic ban, since a pattern of disputes needs human judgment, but it must not be invisible either.

### 3.9 Admin Console (No-Code Governance)
Everything below must be operable by a non-technical operator with zero code changes or deploys:
- Global platform fee % (with effective-date scheduling, so a fee change doesn't retroactively alter in-flight orders).
- License/compliance override (manually clear or suspend any account's trading status).
- Master molecule/salt/combination database management (bulk CSV import + manual single-entry "salt stitcher" UI).
- Dispute queue and one-click resolution (§3.8).
- Cash-velocity discount default % and allowed override range.
- Broadcast/notification tool (e.g., regulatory update, planned downtime) to all users or a filtered segment (by role, by state).
- Read-only network health dashboard: GMV, transaction count, active accounts by role, top disputed accounts, license-expiry-approaching list.

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Cost** | Infrastructure must run at effectively $0–$25/month at pilot scale (see `02-ARCHITECTURE.md` §6 for the exact free-tier breakdown); no requirement in this SRS may be satisfied by a paid-only service unless a free/low-cost alternative was genuinely unavailable and is explicitly flagged as such |
| **Accessibility / literacy** | Every primary action must be completable via icon + camera + voice, without requiring the user to type more than a numeric quantity; text labels are supportive, never the only affordance |
| **Offline resilience** | Order composition (camera scan, basket building) must work with zero connectivity and sync automatically on reconnect — Stockists frequently work in basement shops with poor signal |
| **Localization** | UI text and voice-input/output support at minimum Hindi + English at launch, architected (not hardcoded) to add more Indian languages without a rebuild |
| **Auditability** | Every fund movement, every compliance status change, and every dispute resolution must be permanently logged with actor, timestamp, and reason — this is a regulated-industry financial platform, not a casual app |
| **Data integrity over availability** | If the escrow/payment provider is unreachable, the correct behavior is to block checkout with a clear retry message — **never** to let an order proceed without a confirmed payment lock |

---

## 5. UX Principles (Illiterate/Semi-Literate-User-First Design)

1. **Three-color system only** for status: green = safe/confirmed/money-in, yellow = pending/in-transit, red = alert/dispute/expiring. No other status colors anywhere in the app.
2. **Camera before keyboard** for every data-entry-heavy flow (ordering, license upload, batch verification) — typing is the fallback path, not the primary one.
3. **Voice search** in the primary search bar, in the user's chosen language, mapped to the same molecule/brand fuzzy-match backend as typed search — not a separate, weaker feature.
4. **Icon + number, not paragraphs.** Every screen leads with a large icon and a number (price, quantity, days) before any explanatory text.
5. **One primary action per screen.** A screen with two "equally important" buttons is a design failure for this user base — there is always a single dominant next action, with secondary actions visually smaller/lower.
6. **Undo, not confirm-dialogs, wherever the action is reversible.** A confirm dialog a low-literacy user doesn't fully parse creates either accidental rejection of a good action or blind-taps-yes fatigue; for anything reversible (like adding to a basket), let them act and undo, don't gate every tap behind a modal.

---

## 6. Anti-Loophole / Trust & Safety Architecture

This section exists because a platform whose entire value proposition is "we're cheaper and safer than going around us" only works if going around it is actually, structurally worse — not just against the rules.

### 6.1 Transaction Leakage (parties meeting on-platform, then trading offline to dodge the fee)
- **Anonymized discovery**: counterpart identity (company name, factory address, direct phone number) is withheld during browsing/comparison. Listings show a verified badge, compliance rating, and fulfillment-rate percentage instead — real identity unlocks only once an escrow-backed purchase order is opened.
- **Escrow-or-nothing value**: since real buyer protection (batch verification gate, dispute arbitration, guaranteed refund path) only exists for on-platform escrow transactions, an off-platform deal is strictly higher-risk for both sides even before price is considered.
- **Pooled pricing is unavailable offline**: an individual Company or Manufacturer's offline negotiating power is structurally worse than the pooled volume rate available only through the platform's Production Pool mechanism (§3.3) — the discount itself is the retention mechanism, not a policy.

### 6.2 Batch Substitution / Near-Expiry Dumping
Covered fully in §3.7 — the mandatory scan-and-match gate before escrow release makes shipping a different batch than declared a directly self-defeating action for the seller (frozen funds + a permanent dispute-history mark against their account).

### 6.3 Shared/Split-Account Abuse (one high-volume account fronting for several smaller unregistered buyers)
- Every delivery address on an order must geographically match (server-side distance check against stored lat/long, not just a text-field match) the facility address on that account's verified Drug License.
- A request to change or add a delivery destination outside that matched radius is blocked automatically and flagged for Admin review rather than silently allowed.

### 6.4 Dummy-Brand Listing Spam
- A Company cannot register a new brand name against a combination without the platform re-confirming (via the same trademark/registration document check used at onboarding) that the brand is a real, distinct registration — not a rubber-stamp.
- Regardless of how many brand variants a single Company registers for the same molecule, the Stockist-facing search UI **clusters by molecule first** (§3.2) and always surfaces the cheapest valid option at the top — burying the platform in redundant brand listings gains a spamming Company nothing in visibility.

---

## 7. Explicit Out-of-Scope for Phase 1 (say so, don't silently drop it)

- **Live-timed reverse-bidding auctions** were considered and explicitly rejected per the business owner's own stated concern (a stockist/distributor can't stop mid-shift to watch a 60-minute countdown) — replaced by the always-on "cheapest valid offer wins automatically" matching model in §3.4–3.5. Do not build a live-auction UI unless this decision is explicitly revisited.
- **NBFC credit-line financing** (§3.6) requires a signed lending partner and is not buildable as pure software alone — Phase 1 ships the instant-escrow-pay flow and cash-velocity discount without it; the credit-line option is added once a partner exists.
- **Non-India markets** — the entire compliance layer (§3.1, §6) is built against Indian regulatory identifiers (GSTIN, Form 20/21, CDSCO). Expansion to another country requires a new, separate compliance module, not a config flag — do not assume this generalizes for free.
- **End-consumer (patient-facing) app** — this SRS is B2B only, by explicit decision earlier in this project's scoping. A patient-facing layer is a different product with different regulatory obligations (drug dispensing to consumers) and is not part of this build.

---

## 8. Phased Delivery Roadmap

| Phase | Scope | Why this order |
|---|---|---|
| **P1 — Core Trade Rails** | Auth + compliance onboarding (§3.1), molecule database + search (§3.2), Company↔Stockist trade flow only (§3.4–3.5), basic escrow (single-seller, no split-pool yet), Admin console core (§3.9 minus broadcast/segments) | Company→Stockist is the highest-frequency, most price-sensitive layer — validates the core "cheapest offer wins" mechanic fastest with the smallest surface area |
| **P2 — Manufacturer Layer + Production Pooling** | Manufacturer onboarding, Manufacturer→Company flow (§3.3), Production Pool aggregation logic | Depends on P1's Company accounts and compliance framework already existing; pooling logic is genuinely complex and deserves its own phase rather than shipping alongside P1 |
| **P3 — Trust & Verification Hardening** | Batch-OCR verification gate (§3.7), dispute ticketing + Admin arbitration (§3.8), anti-loophole geo-fencing (§6.3) | Only meaningful once real transaction volume exists to actually generate deliveries/disputes to verify against |
| **P4 — Financial Depth** | Cash-velocity discount engine (§3.6), NBFC credit-line integration (once partner signed), multi-seller basket-splitting optimization | Financial incentive tuning benefits from real usage data from P1–P3 before calibrating discount percentages |
| **P5 — Scale & Localization** | Additional language packs, voice-input expansion, broadcast/segmented Admin notifications, network health analytics deepening | Polish and scale-out once the core trade loop is proven |

---

*See `02-ARCHITECTURE.md` for the technical system design and free-tier cost breakdown, `03-DATABASE-SCHEMA.md` for the full schema, `04-API-SPEC.md` for endpoint contracts, and `MASTER_PROMPT.md` for how a development agent should approach building this from these documents.*
