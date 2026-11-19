# Blockers (revision r3.4)

## Resolved for TEST collection (not live)

### Was: BLK-J13-COLLABORATION-COLLECTION-GATE
- **#535 merged:** sandbox-only `sandbox_ledger_hold` when `COLLABORATION_SANDBOX_LEDGER_HOLD=1` + trusted localhost + `sk_test_`.
- **r3.4 evidence:** Stripe TEST checkout paid → funding **held** (J13 Pass).
- **Still true:** Live collaboration deposits closed; capability probe does not set `providerE2eComplete`.

## Open — provider / product

### BLK-J15-PROVIDER-PAYOUT-UNPROVEN
- Simulated release `sim_sandbox_ledger_hold:mkt_release_…` with `providerE2eComplete:false`.
- **Does not** satisfy original J15 provider transfer/payout Pass.
- **Smallest Ola action:** Prove Connect/bank payout in provider sandbox, or accept Partial until Payment Standard payout E2E exists.

### BLK-J16-ANNUAL-PLAN
- `startCheckout` year → “Annual billing is not available for this plan.”
- Monthly Plus TEST Subscribe Pass.

### BLK-J16-HOSTED-CHECKOUT-HEADLESS
- Headless Playwright often cannot fill Stripe Card accordion; computerUse/headed succeeds (J13 + J16 month).

### BLK-J18-DISCOUNT-APPLY-UI
- Server eligibility proven; Apply control not reached from pricing panel in this build.

## Environment

- Fresh boot secrets: `STRIPE_SECRET_KEY` (`sk_test_`) + `STRIPE_WEBHOOK_SECRET` present.
- Harness: Postgres `influrios_audit`, Mailpit, `APP_URL=http://127.0.0.1:3000`, `COLLABORATION_SANDBOX_LEDGER_HOLD=1`.
