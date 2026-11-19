# Journeys — Bounded closure matrix

Harness: local dedicated Postgres + Mailpit + `@example.com` + `sk_test_` + `COLLABORATION_SANDBOX_LEDGER_HOLD=1` on localhost. Live deposits closed. Agency deferred. Remediation **PAUSED**.

## Two lenses (required)

| Lens | Values |
|------|--------|
| **Coverage** | Required-step outcomes — Complete / Incomplete. **≠ acceptance.** |
| **Acceptance** | Pass / Fail / Partial — product criteria. |

Step statuses: `executed_successfully` · `executed_with_reproducible_failure` · `blocked_by_named_dependency` · `not_executed`.

## Matrix

| ID | Definition | Coverage | Acceptance | Notes |
|----|------------|----------|------------|-------|
| J01 | Signup + verify | Complete | Pass | |
| J02 | Login members + admin | Complete | Pass | |
| J03 | Discover / card / shortlist | Complete | **Partial** | Demo directory; no shortlist UI (COR-13) |
| J04–J12 | Brief → signed | Complete | Pass | |
| J13 | Collab checkout | Complete | Pass | Stripe TEST → held |
| J14 | Deliver → revise → approve | Complete | Pass | Dual-party evidence; ≠ payout |
| J15 | Release / payout | Complete | **Partial** | Sim release; PL-01 |
| J16 | Month + annual purchase | Complete | **Partial** | Month Pass; year **Fail** COR-03 |
| J17 | Subscriber changes | Complete | **Partial** | COR-07 / COR-11 |
| J18 | Discount Apply | **Incomplete** | **Partial** | Apply-to-Stripe **Pass**; annual Fail; redemption **not_executed** |
| J19 | Tax config | Complete | Pass | |
| J20 | Quote → charge / tax / invoice | **Incomplete** | **Partial** | Influrios UI→Stripe ok; UI pay/invoice incomplete; API invoice subtest only |
| J21 | Business shell | Complete | Pass | |
| J22–J23 | Messages / Mailpit | Complete | Pass | |
| J24 | Access restrictions | Complete | Pass | |
| J25 | Admin accounts | Complete | **Partial** | Inventory; UI edit not proven (COR-14) |
| J26 | Admin plans | Complete | **Pass** | edit→save→reload (`j26c-*`) |
| J27 | Admin jobs/CMS | Complete | **Partial** | banners/homepage Save ok; Retry blocked; cms/content 404 |
| J28 | Matching lifecycle | Complete | **Partial** | COR-10 |
| J29 | Public/marketing | Complete | Pass | |
| J30 | Visual / a11y | Complete | **Partial** | COR-09a/b + COR-18 mobile overflow |

## Counts

- Acceptance Pass: **20**  
- Acceptance Partial: **10** (J03, J15, J16, J17, J18, J20, J25, J27, J28, J30)  
- Coverage Incomplete: **2** (J18, J20)  

See [final-coverage-report.md](./final-coverage-report.md), [correction-register.md](./correction-register.md), [phase1-bounded-closure-results.json](./phase1-bounded-closure-results.json).
