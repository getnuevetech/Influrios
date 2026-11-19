# Blockers / limitations — Bounded closure

## Provider (see provider-limitations.md)

### PL-01 / J15
- Provider payout **unproven pending provider integration/testing**.  
- Simulation exercised; not Pass.

### PL-03 / J20
- Headless Stripe Card accordion unreliable — blocks UI-path payment completion in this pass.

## Product (acceptance Partial/Fail — documented, not repaired)

- **COR-03** J16 annual unavailable  
- **COR-04** J18 annual Apply gated  
- **COR-07 / COR-11** J17 proration / price IDs  
- **COR-10** J28 managed_intro fee rule missing  
- **COR-09a/b** admin dual chrome + Creator terminology  
- **COR-18** mobile `/admin/accounts` clipped overflow (`j30c-admin-accounts-mob-overflow.png`)  
- **COR-13** J03 demo directory / no shortlist UI  

## Coverage gaps (required steps)

- **J18** completed discounted payment/redemption — `not_executed` (COR-19; hosted ≠ redemption)  
- **J20** UI payment + invoice — blocked / `not_executed` (COR-08)  
- **J27** jobs Retry — `blocked_by_named_dependency` (no failed row); `/admin/cms`+`/content` 404  

## Security (interrupt-class if exposed on customer hosts)

- **COR-SEC-01** admin login credential hint — see `issues.json`

## Explicitly not done this pass

- Product remediation / silent repair  
- Broad journey rerun  
- Remediation PRs  
