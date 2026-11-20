# Journeys — #534 matrix (reviewability revision)

Harness: local dedicated Postgres + Mailpit + `@example.com` + `sk_test_` + sandbox ledger hold. Remediation **PAUSED**.

**Historical freeze:** `db64224` — not complete platform coverage.  
**Expanded aggregate:** **20 Pass / 10 Partial**.

## Two lenses

| Lens | Values |
|------|--------|
| **Coverage** | Required-step outcomes on the **stated checklist**. Old-checklist Incomplete **0** @ `db64224` ≠ expanded upload/review/reply completeness. |
| **Acceptance** | Pass / Fail / Partial — publish **subtest** and **aggregate** when they differ. |

## Matrix

| ID | Old-checklist coverage | Aggregate acceptance | Subtests / notes |
|----|------------------------|----------------------|------------------|
| J01–J02 | Complete | Pass | |
| J03 | Complete | Partial | COR-13 |
| J04–J13 | Complete | Pass | |
| **J14** | Complete (note path) | **Partial** | Note-submission **Pass**; file upload + biz Approve/Request-changes UI **not executed** (COR-21, COR-23); COR-20/22 |
| J15 | Complete | Partial | PL-01 |
| J16 | Complete | Partial | year Fail COR-03 |
| J17 | Complete | Partial | COR-07 |
| **J18** | Complete (monthly) | **Partial** | Monthly Apply→pay→redeem **Pass**; annual Fail COR-04 |
| J19 | Complete | Pass | |
| **J20** | Complete | **Pass** | Hosted invoice/PDF; COR-24 = separate in-app download **not executed** |
| J21 | Complete | Pass | |
| **J22** | Complete | **Pass** | Two-party send; COR-25 = depth/retry **not executed** (no demotion) |
| J23–J24 | Complete | Pass | |
| J25 | Complete | Partial | COR-14 |
| J26 | Complete | Pass | |
| J27 | Complete | Partial | COR-15 |
| J28 | Complete | Partial | COR-10 |
| J29 | Complete | Pass | |
| J30 | Complete | Partial | COR-09 + COR-18 |

## Counts (expanded aggregate)

- Acceptance Pass: **20**  
- Acceptance Partial: **10**  
- Old-checklist Coverage Incomplete (`db64224`): **0**  
- Expanded unexecuted edges: upload E2E, biz review UI, reply depth, in-app invoice download  

Evidence: [final-coverage-report.md](./final-coverage-report.md), [correction-register.md](./correction-register.md), [docs/remediation-pack/](../remediation-pack/).
