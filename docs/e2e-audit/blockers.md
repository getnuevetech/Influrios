# Blockers (revision r3)

## Resolved for local mutating journeys

- Dedicated local Postgres `influrios_audit` + Next on `127.0.0.1:3000`
- Mailpit SMTP sink on `127.0.0.1:1025` / UI `8025` — proven
- Synthetic `@example.com` fixtures (not the five live accounts)
- US corridor + marketplace primary provider secrets (synthetic) for agreement readiness
- Fee rules / staged milestones / verified KYC fixtures for contract wizard

## Open blockers

### BLK-STRIPE-TEST-KEYS
- **Missing:** Cloud Agent secrets `STRIPE_SECRET_KEY` (`sk_test_…`) and `STRIPE_WEBHOOK_SECRET`
- **Tried:** Local app boot; marketplace primary route seeded; Checkout/payout not executable without keys
- **Smallest Ola action:** Bind Stripe **test** secrets to the agent environment (no live keys, no customer charges)

### BLK-PAYOUT-SANDBOX
- **Missing:** Payout provider sandbox credentials + webhook reachability after funding
- **Depends on:** J13 funding
- **Smallest Ola action:** Provide test Connect/payout credentials after Stripe test keys

### BLK-ADMIN-LOCAL-LOGIN (separate P0)
- Local admin login Fail in harness; do **not** treat as audit attestation work
- **Smallest Ola action:** Separate hotfix for admin credential/login — outside this audit pack gate

## Not blockers anymore

- Operator isolation/mail attestation checkboxes
- Absence of a disposable public staging mutation lane (local harness is sufficient)
