# Journeys (revision r3.6 — remaining Partials pushed; audit NOT complete)

Operator attestation checkboxes are **not** a gate. Local dedicated Postgres + Mailpit + synthetic `@example.com` + `sk_test_` only.  
**Live collaboration deposits stay closed.** `COLLABORATION_SANDBOX_LEDGER_HOLD=1` + localhost enables labelled `sandbox_ledger_hold` TEST collection only.

## Money evidence labels (required)

| Label | Meaning | Counts as original Pass? |
|-------|---------|--------------------------|
| Stripe TEST checkout | Real `cs_test_` / `sk_test_` / livemode=false payment confirmed | Yes for collection/checkout steps |
| Simulated internal release | `sim_sandbox_ledger_hold:*`, `providerE2eComplete=false` | **No** for J15 provider payout |
| Provider payout UNPROVEN | Connect/bank payout not executed | **No** |

## Matrix (original acceptance criteria)

| ID | Original definition | Status | Notes |
|----|---------------------|--------|-------|
| J01 | Signup + verify | Pass | prior |
| J02 | Login members + admin | Pass | prior |
| J03 | Discover / card | Pass | r3.5 |
| J04–J12 | Brief→signed lifecycle | Pass | prior |
| J13 | Business collaboration checkout | Pass | Stripe TEST → held |
| J14 | Deliver → revise → approve | Pass | r3.5 dual-party workroom |
| J15 | Release / transfer / payout | **Partial forever** | Simulated only; **never Pass** without provider payout |
| J16 | Monthly + annual purchases | Partial* | **Month Pass.** **Year Fail** — product/provider limitation (see RCA) |
| J17 | Existing subscriber changes | **Partial** | **PRODUCT LIMITATION:** `SubscriptionState.externalId` is `cs_test_` not `sub_`; `billing.prices` empty → proration preview impossible |
| J18 | Discount eligibility + Apply | **Pass** | r3.6 Pro month Checkout Apply `AUDITPRO15M` (−$4.35); year code rejected on month; tax preview 8.25% |
| J19 | Configure tax | Pass | prior |
| J20 | Quote through final charge | **Pass** | r3.6 Pro $29 + tax $2.39 = $31.39 Stripe TEST paid; invoice `in_…` tax=239; hosted invoice + PDF |
| J21 | Business shell | Pass | r3.5 |
| J22–J23 | Messaging / Mailpit | Pass | prior |
| J24–J27 | Access / admin surfaces | Pass | r3.5 |
| J28 | Matching lifecycle | **Partial** | Advanced to `in_conversation`; **PRODUCT LIMITATION:** no `managed_intro` `CollaborationFeeRule` → fee quote blocked |
| J29–J30 | Public / visual | Pass | r3.5/r3.6; COR-09 dual chrome/terminology remain open findings |

## Stop state — remaining blocked with precise limitation

| ID | Result | Precise limitation |
|----|--------|-------------------|
| J15 | Partial forever | No Connect/bank payout; simulation `providerE2eComplete=false` |
| J16 year | Fail | Empty `billing.annualOffers` + no Stripe year Price in TEST |
| J17 | Partial | Product stores checkout session id as `externalId`; empty `billing.prices` / `offer.priceId` |
| J28 | Partial | Zero active fee rules for `serviceLevel=managed_intro` |

## Plus / Pro / annual RCA (unchanged)

1. `billing.annualOffers` empty → year checkout refused  
2. Stripe TEST has no `recurring.interval=year` Price  
3. Tax “unavailable” mitigated (US subscription 8.25% ready)

## Status counts (J01–J30)

- Pass: **26**
- Partial: **4** (J15, J16, J17, J28)
- Blocked (collection gate): **0**
- Not tested: **0**

\*J16 overall Partial until annual Pass; monthly Stripe TEST remains Pass evidence.

**Audit is NOT complete.** See [local-journey-r36-results.json](./local-journey-r36-results.json).
