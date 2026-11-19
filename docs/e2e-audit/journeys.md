# Journeys — J18/J20 completion matrix

Harness: local dedicated Postgres + Mailpit + `@example.com` + `sk_test_` + sandbox ledger hold. Remediation **PAUSED**.

## Two lenses

| Lens | Values |
|------|--------|
| **Coverage** | Required-step outcomes — Complete / Incomplete. **≠ acceptance.** |
| **Acceptance** | Pass / Fail / Partial |

## Matrix

| ID | Coverage | Acceptance | Notes |
|----|----------|------------|-------|
| J01–J02 | Complete | Pass | |
| J03 | Complete | Partial | COR-13 |
| J04–J14 | Complete | Pass | |
| J15 | Complete | Partial | PL-01 |
| J16 | Complete | Partial | year Fail COR-03 |
| J17 | Complete | Partial | COR-07 |
| **J18** | **Complete** | **Pass** | Monthly Apply→pay→redeem Pass (`AUDITPRO15MAC4C`); annual Apply Fail COR-04 preserved |
| J19 | Complete | Pass | |
| **J20** | **Complete** | **Pass** | Same txn: UI quote→Stripe TEST→invoice/PDF 2900/−435/+203=2668 |
| J21–J24 | Complete | Pass | |
| J25 | Complete | Partial | COR-14 |
| J26 | Complete | Pass | edit→save→reload |
| J27 | Complete | Partial | COR-15 |
| J28 | Complete | Partial | COR-10 |
| J29 | Complete | Pass | |
| J30 | Complete | Partial | COR-09 + COR-18 |

## Counts

- Acceptance Pass: **22**  
- Acceptance Partial: **8**  
- Coverage Incomplete: **0**  

Evidence: [j18-j20-complete-results.json](./j18-j20-complete-results.json), [final-coverage-report.md](./final-coverage-report.md).
