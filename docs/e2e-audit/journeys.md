# Journeys (revision r3.4 — original defs restored; #535 sandbox path)

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
| J01 | Signup + verify | Pass | prior local evidence |
| J02 | Login members + admin | Pass | admin harness reconfirm |
| J03 | Discover / card | Partial | shortlist mutate + inventory; not full discover Pass |
| J04 | Brief create/send | Pass | prior |
| J05 | Applications | Pass | prior |
| J06 | Active collaboration | Pass | prior |
| J07 | Draft delete | Pass | prior |
| J08 | Withdraw application | Pass | prior |
| J09 | Signed delete blocked | Pass | prior |
| J10 | Contract send | Pass | prior |
| J11 | Dual sign | Pass | prior |
| J12 | Signed status / version | Pass | prior |
| J13 | Business collaboration checkout | **Pass** | Stripe TEST `cs_test_…XX` paid → funding **held** under `sandbox_ledger_hold` (not allocated-funds/Treasury). Media `j13r34-paid-success.png` |
| J14 | Deliver → revise → approve | Partial | Milestone submitted→revision_requested→approved (×2 revisions); dual-party UI workroom depth incomplete |
| J15 | Release / transfer / payout | Partial | **Simulated** release `sim_sandbox_ledger_hold:mkt_release_…` (`providerE2eComplete=false`). **Provider payout UNPROVEN** — not Pass |
| J16 | New user monthly + annual purchases | Partial* | **Month Pass:** Stripe TEST Subscribe $19 → `SubscriptionState` active (`j16r34-month-paid-success.png`). **Year:** product refuses annual for Plus — still open |
| J17 | Existing subscriber changes | Partial | Billing Change-plan UI; no paid sub proration confirm yet |
| J18 | Discount eligibility + Apply | Partial | Server eligibility/quote proven; Apply UI not reached |
| J19 | Configure tax by country/charge | Pass | prior UI save `TaxPolicyVersion` US · All subscription plans · 8.25% |
| J20 | Quote through final charge | Partial | Tax calc 8.25% on PLUS base; checkout/invoice/receipt chain incomplete |
| J21 | Business shell / entities | Partial | prior deepen |
| J22 | Two-party messaging | Pass | prior dual-party + Mailpit |
| J23 | Notifications / Mailpit | Pass | prior |
| J24 | Access restrictions | Partial | denial samples |
| J25 | Admin accounts | Partial | phone mutate evidence |
| J26 | Admin plans | Partial | inventory |
| J27 | Admin jobs/CMS | Partial | inventory |
| J28 | Matching lifecycle | Partial | intro draft; lifecycle incomplete |
| J29 | Public/marketing | Partial | visual inventory |
| J30 | Visual / a11y / popups | Partial | expanded `vis34-*` desktop/mobile; full checklist open |
| AGENCY | — | N/A | Deferred |

## Status counts (J01–J30)

- Pass: **16** (J13 + J16-month + prior Passes; J16 overall Partial until annual)
- Partial: **13**
- Blocked: **0** for product gate (sandbox path open); payout remains **unproven** inside J15 Partial
- Not tested: **0**

\*J16 counted Partial in matrix until annual also Pass; monthly Stripe TEST checkout is Pass evidence.
