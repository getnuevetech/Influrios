# Isolation evidence (revision r3)

## Proof (technical — no secrets)

| Check | Evidence |
|-------|----------|
| App bind | `http://127.0.0.1:3000` health `ok` with local DB |
| DB | Postgres `influrios_audit` on `127.0.0.1:5432` — separate from production |
| Mail sink | Mailpit `127.0.0.1:1025` / `8025` — invitation + sign + signup messages captured |
| Fixtures | `audit.r3mrvlgh.*@example.com` synthetic accounts only |
| Live five accounts | **Not mutated**; not treated as disposable |
| Payment routing | Jurisdiction US protected payments; marketplace `primary` synthetic enabled for readiness; Stripe Connect still disabled without test keys |
| Signing | Influrios in-app signing provider enabled; DocuSign off |

## Residual (not attestation checkboxes)

- Stripe test keys absent → funding/checkout/payout journeys Blocked (see blockers.md)
- Local admin login Fail tracked as separate P0

Operator checkbox attestation is **not required** to continue local journey execution.
