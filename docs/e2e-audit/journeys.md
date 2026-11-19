# Journeys — Phase 1 corrective matrix

Harness: local dedicated Postgres + Mailpit + `@example.com` + `sk_test_` + `COLLABORATION_SANDBOX_LEDGER_HOLD=1` on localhost. Live deposits closed. Agency deferred.

## Two lenses (required)

| Lens | Values |
|------|--------|
| **Coverage** | Complete / Incomplete — was the check executed with retained evidence? |
| **Acceptance** | Pass / Fail / Partial — product criteria. Provider payout: Partial + `provider-limitations.md` (never “Partial forever”; never Pass from simulation) |

## Money labels

| Label | Original Pass? |
|-------|----------------|
| Stripe TEST checkout | Yes for checkout steps |
| Simulated internal release | **No** for J15 payout |
| Provider payout UNPROVEN pending provider integration/testing | **No** |

## Matrix

| ID | Definition | Coverage | Acceptance | Notes |
|----|------------|----------|------------|-------|
| J01 | Signup + verify | Complete | Pass | |
| J02 | Login members + admin | Complete | Pass | |
| J03 | Discover / card / shortlist | Complete | **Partial** | Demo directory; no shortlist UI (COR-13) |
| J04–J12 | Brief → signed | Complete | Pass | |
| J13 | Collab checkout | Complete | Pass | Stripe TEST → held |
| J14 | Deliver → revise → approve | Complete | Pass | Dual-party evidence; ≠ payout |
| J15 | Release / payout | Complete | **Partial** | Sim release only; payout unproven **pending provider integration/testing** (PL-01) |
| J16 | Month + annual purchase | Complete | **Partial** | Month Pass; year **Fail** COR-03 |
| J17 | Subscriber changes | Complete | **Partial** | COR-07 / COR-11 |
| J18 | Discount Apply | Complete | Pass | Apply + Stripe coupon line `j18p1-us-checkout.png` |
| J19 | Tax config | Complete | Pass | |
| J20 | Quote → charge / tax / invoice | Complete | Pass | tax=239 on invoice |
| J21 | Business shell | Complete | Pass | |
| J22–J23 | Messages / Mailpit | Complete | Pass | |
| J24 | Access restrictions | Complete | Pass | |
| J25 | Admin accounts | Complete | **Partial** | Inventory; UI edit not proven (COR-14) |
| J26 | Admin plans | Complete | Pass | |
| J27 | Admin jobs/CMS | Complete | **Partial** | Routes only (COR-15) |
| J28 | Matching lifecycle | Complete | **Partial** | Advanced; fee rule missing (COR-10) |
| J29 | Public/marketing | Complete | Pass | |
| J30 | Visual / a11y | Complete | **Partial** | Dual chrome + Creator terminology (COR-09) |

## Counts

- Acceptance Pass: **22**  
- Acceptance Partial: **8** (J03, J15, J16, J17, J25, J27, J28, J30)  
- Coverage Incomplete: **0**  
- Phase 1 demotions from prior Pass 26: J03, J25, J27, J30  

See [final-coverage-report.md](./final-coverage-report.md), [correction-register.md](./correction-register.md), [provider-limitations.md](./provider-limitations.md).
