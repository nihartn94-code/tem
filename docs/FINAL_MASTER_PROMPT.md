# FINAL MASTER PROMPT — Build PharmaOS to a Ready-to-Install APK. Do Not Stop Until Done.

You are building PharmaOS to full completion, in one continuous work session. Before doing anything else, read `01-SRS.md`, `02-ARCHITECTURE.md`, `03-DATABASE-SCHEMA.md`, and `04-API-SPEC.md` in full. Two hard constraints below override anything in those documents that conflicts with them. Everything else in those documents stands.

---

## CONSTRAINT 1 — The app is free for every user, always

No Manufacturer, Company, Stockist, or Admin ever pays to download, install, register, or use any feature.
- No subscription tier, no "Pro" plan, no feature paywall, no in-app purchase, anywhere.
- No charge for onboarding, listing, searching, browsing, or using any screen.
- The only money that ever moves is the platform fee already defined in the business model (`01-SRS.md` §1.3) — a small % automatically deducted from a trade's invoice value at settlement, exactly like a payment processor's cut on a transaction that's already happening. This is never presented to a user as "paying for the app." If you find yourself building anything that charges a user to use the app itself (as opposed to taking its cut of an actual trade), stop and remove it.
- No ads, no ad SDKs, no third-party monetization that could surface a paywall or purchase prompt.

## CONSTRAINT 2 — Zero paid services for you to build with

Every service/SDK/API used in the build must be free to build and run at pilot scale — no credit card required to start, for anything:
- **Supabase**: free tier only.
- **Payments**: no Razorpay, no Cashfree, no paid gateway of any kind. Use `MANUAL_CONFIRMATION` mode: generate a `upi://pay?...` deep-link at checkout for the buyer to pay the seller directly via their own UPI app; seller/Admin manually marks "Payment Received" in-app. Label this plainly as **"Pay via UPI, confirm manually"** in the UI — never call it escrow, since no automated fund custody exists in this mode. Order state, fee/discount computation, and audit logging all still work exactly as specified — only the fund-movement mechanism changes.
- **OCR / voice**: on-device only (ML Kit text recognition, native OS speech recognizer) — zero cloud OCR/speech API calls, ever.
- **SMS OTP**: Supabase Auth's free-tier allowance; if exhausted during testing, fall back to magic-link/email auth rather than adding a paid SMS provider, and note the ceiling explicitly in `PROGRESS.md`.
- **Push**: Firebase Cloud Messaging free tier.
- **Geo/delivery-radius check** (SRS §6.3): on-device haversine distance math, no paid maps/geocoding API.
- **Build/release**: Expo EAS free tier.

If you're about to add any SDK, package, or API call that needs a credit card or has any per-request cost — stop, don't add it. Find a genuinely free alternative, or build a clearly-labeled reduced/manual version (like the UPI mode above) and document the limitation honestly in `PROGRESS.md`. Never silently degrade a feature without saying so, and never quietly add a paid dependency because it was easier.

---

## THE ONLY TWO WAYS THIS SESSION ENDS

1. **A signed, installable release APK exists**, has actually been built and installed on a real device or emulator, and — running inside that APK, not the dev server — every P1 flow from `01-SRS.md` §8 works end to end for all four roles, using only free infrastructure, with zero paywalls anywhere.
2. A genuine external blocker exists with no free workaround at all, even after trying alternatives — not a bug, not a missing feature, an actual dead end.

**Nothing else stops you.** A clean typecheck is a floor, not a finish line. A finished code-review pass is not a stopping point. A list of "suggested followups" is not a menu for me to choose from — it is your own next set of tasks. Pick them up yourself, in priority order, and keep working. Never present options and wait for a reply. Never ask "should I continue" — the answer is always yes. Never end a turn with a summary and silence when there is still unchecked work below.

---

## COMPLIANCE CHECKLIST — every box must be true, verified, before you stop

**User-facing free-ness**
- [ ] Codebase grepped for any paywall, subscription check, purchase prompt, or "upgrade" UI — confirmed zero exist
- [ ] Platform fee only ever applied automatically at trade settlement, never shown as a separate app-usage charge
- [ ] No ad SDKs, no in-app-purchase SDKs in `package.json`

**Functional — all four roles, full P1 scope (`01-SRS.md` §8)**
- [ ] Admin: onboarding, no-code fee/settings control, dispute queue, one-click resolve
- [ ] Manufacturer: catalog listing, production pool contribution, live pool progress
- [ ] Company: onboarding, brand registration, manufacturer sourcing, marketplace listing, trade schemes
- [ ] Stockist: onboarding, molecule search (typed + voice), camera basket scan, cheapest-offer checkout, UPI payment link, batch-scan delivery confirmation
- [ ] One full order lifecycle actually run, live, inside the app: onboarding → compliance verification → brand + listing → search → basket → checkout (UPI link generated) → manual payment-received mark → batch-scan confirmation → `SETTLED`
- [ ] Production pool reaches `locked` status with 2+ real contributions
- [ ] A dispute is raised (batch mismatch), appears in the Admin queue, and is resolved

**Backend correctness**
- [ ] Every Edge Function in `04-API-SPEC.md` §2 implemented and re-validates price/fee/discount server-side — never trusts client input
- [ ] RLS verified with an actual adversarial test: a Stockist-role session querying `manufacturer_catalog` returns zero rows
- [ ] Every `orders` state change writes an `audit_log` row
- [ ] Manual-payment mode clearly commented in code and documented in `PROGRESS.md`, never misrepresented to the user as escrow

**Frontend quality**
- [ ] Typed React Navigation throughout — zero `useNavigation<any>()` anywhere
- [ ] Loading, disabled, and error states on every async action; no double-submit bugs
- [ ] Three-color status system, camera-before-keyboard, one primary action per screen, icon+number before paragraphs (`01-SRS.md` §5)
- [ ] All user-facing strings through `i18next`, zero hardcoded UI text
- [ ] Tested on two different screen sizes
- [ ] Offline basket composition tested in real airplane mode, confirmed to sync on reconnect

**Cost audit**
- [ ] Every external service/SDK used in the final build listed in `PROGRESS.md`, each individually confirmed to have zero cost at this app's scale, no paid tier or billing anywhere in the dependency tree

**Release**
- [ ] TypeScript strict mode, zero errors, zero unexplained `any`
- [ ] EAS release build produced, signed APK generated
- [ ] APK actually installed on a device/emulator and smoke-tested for real — app launches, auth works, at least one full order lifecycle completes inside the running APK

---

## HOW YOU WORK

- Fix priority order: backend correctness/security → functional completeness → frontend quality/edge cases → final docs/cost-audit pass. Don't polish a screen whose backend flow underneath it is still broken or incomplete.
- Every fix is verified by actually running it and observing the result — never close an item on "should work" or "typecheck passed."
- If you hit genuine ambiguity where two reasonable implementations diverge, take the interpretation closest to the literal text of the SRS, log the assumption in `PROGRESS.md`, and keep moving — do not stop to ask.
- Never weaken the Manufacturer/Company/Stockist data isolation (`01-SRS.md` §1.2) for any fix, for any reason, ever.
- Keep `PROGRESS.md` current continuously — what's built, what's verified and how, every deviation from spec and why — not just at the end.

---

**Begin now.** Audit the current state of the codebase against both constraints and the full checklist above. Fix everything unchecked, in priority order, continuously, without stopping, without summarizing and waiting, without offering me a list of next steps to approve — until every box is checked and a verified, signed, installable APK exists. Go.
