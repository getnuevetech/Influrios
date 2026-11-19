# Blockers (revision r3.3 — product gate held; non-funding advanced)

## Open — product / automation

### BLK-J13-COLLABORATION-COLLECTION-GATE
- **Secrets on this VM:** `STRIPE_SECRET_KEY` (`sk_test_`) + `STRIPE_WEBHOOK_SECRET` (`whsec_`) **PRESENT** (fresh boot `bc-133de653-…`). Stripe `GET /v1/checkout/sessions?limit=1` → 200, `livemode=false`.
- **Attempted:** Seed dual-party `awaiting_provider` funding (`audit.r3mrvlgh.business-a` / `influencer-a`); call `startFundingDeposit({ method: "card" })`.
- **Result:** Blocked by product gate — `collaborationCollectionGate({ allocatedFunds: false, treasury: false })` hardcodes refusal: *“New collaboration funding is disabled until Stripe allocated funds or Treasury access is proven. Nothing was charged.”* (`src/lib/funding-checkout.ts` + `src/lib/payment-account-routing.ts`).
- **Ola notified (r3.3):** Product decision required. **Audit will NOT silent-fix the gate.**
- **Downstream still Blocked until decision:** J14 (milestones), J15 (payout), J17 (retry/failure money), J20 (withdrawal).
- **Smallest Ola action:** Decide whether Payment Standard should keep new collaboration card deposits closed, or wire the gate to proven sandbox capability evidence (product change = separate PR).
- Evidence: [`local-journey-stripe-results.json`](./local-journey-stripe-results.json), [`stripe-secret-probe.json`](./stripe-secret-probe.json)

### Cleared from Blocked this revision (non-funding)
- **J18** → Partial (admin + server eligibility; Checkout Apply UI still missing)
- **J19** → Pass (tax UI + DB)
- **J22** → Pass (dual-party messages + Mailpit)

### BLK-J15-UPSTREAM-J13
- Payout/release after funding not executed — funding never reached `held` because J13 card deposit cannot open.
- Primary marketplace webhook secret seeded for local payout drills; not claimed as J15 Pass.
- **Smallest Ola action:** Unblock J13 collection gate (or approve alternate hold path), then re-run hold → approve milestone → `payout.released`.

### BLK-J16-HOSTED-CHECKOUT-CARD-CONFIRM
- **Not a missing secret.** `startCheckout({ sku: "creator_plus" })` opens `cs_test_` Checkout; sandbox UI shows Influencer Plus $19/mo + synthetic `@example.com` email (screenshots `j16-stripe-checkout.png`).
- Headless Playwright could not complete card accordion → 4242 → Subscribe (form interaction / bot barriers). Session stayed `unpaid`.
- Related sandbox proof (not Checkout UI Pass): API subscription with `pm_card_visa` → `status=active`, invoice paid, `livemode=false`; webhook unsigned → HTTP 400 Missing Stripe-Signature.
- Evidence: [`j16-related-stripe-api-evidence.json`](./j16-related-stripe-api-evidence.json), media `j16-*.png`
- **Smallest Ola action:** Optional — provide Stripe CLI listener or headed Checkout confirm on operator machine; or accept Partial until hosted Checkout automation works.

## Explained / reconfirmed Pass

### J02 local admin
- Root cause (harness `.env.local` / `ADMIN_SUPER_PASSWORD`) documented in [`admin-login-root-cause.md`](./admin-login-root-cause.md).
- **Reconfirm on this boot:** harness `loadEnvLocal()` + `ADMIN_SUPER_PASSWORD` → `/admin` **Pass**; member password fallback stays on `/admin/login`.

## Environment note (2026-11-19 re-probe on long-lived worker)

- Long-lived VM `bc-301bac77-…` re-probed **names only**: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` still **ABSENT** from process env and `.env.local`.
- **Verdict:** this VM **predates binding injection** into the running shell — start a **new worker** if further Stripe harness runs are needed on that lineage.
- Fresh-boot sibling `bc-133de653-…` already saw `sk_test_` + `whsec_` and executed J13→J16→J15 (results retained below / in JSON). Do not treat long-lived ABSENT as undoing that evidence.

## Resolved (prior)

- Stripe secrets missing from prior long-lived VM — **resolved for execution by fresh worker boot** (`bc-133de653-…`); long-lived `bc-301bac77-…` remains blind until restarted.
- Local Postgres + Mailpit + synthetic fixtures for non-money journeys.
