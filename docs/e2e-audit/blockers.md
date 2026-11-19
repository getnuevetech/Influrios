# Blockers (revision r3.5)

## Resolved for TEST collection (not live)

### Was: BLK-J13-COLLABORATION-COLLECTION-GATE
- **#535 merged:** sandbox-only `sandbox_ledger_hold` when `COLLABORATION_SANDBOX_LEDGER_HOLD=1` + trusted localhost + `sk_test_`.
- Stripe TEST checkout paid → funding **held** (J13 Pass).
- **Still true:** Live collaboration deposits closed; capability probe does not set `providerE2eComplete`.

## Open — provider / product

### BLK-J15-PROVIDER-PAYOUT-UNPROVEN
- Simulated release `sim_sandbox_ledger_hold:…` with `providerE2eComplete:false`.
- **Does not** satisfy original J15 provider transfer/payout Pass — keep Partial forever until Connect/bank proof.

### BLK-J16-ANNUAL-PLAN (RCA documented)
1. `PlatformSetting` `billing.annualOffers` empty → `recurringOfferFor(…,'year')` fails.
2. Stripe TEST has only monthly Plus Price (`price_1UdKNn…`); no year interval.
3. Historical Plus/Pro “unavailable” was tax-rule gate — **mitigated** (US subscription 8.25% ready); Pro month checkout opens.

### BLK-J16-HOSTED-CHECKOUT-HEADLESS
- Headless Playwright often cannot fill Stripe Card accordion; computerUse/headed succeeds.

### BLK-J18-DISCOUNT-APPLY-UI
- Server eligibility proven (year accept / month reject); Apply UI blocked until annual plan purchasable.

### BLK-J17-PRORATION / BLK-J20-RECEIPT
- Subscriber change proration + invoice/receipt tax line still open Partials.

### BLK-J28-MATCHING-LIFECYCLE
- Intros inventoried; advance/fee path incomplete.

## Environment

- Fresh boot secrets: `STRIPE_SECRET_KEY` (`sk_test_`) + `STRIPE_WEBHOOK_SECRET` present.
- Harness: Postgres `influrios_audit`, Mailpit, `APP_URL=http://127.0.0.1:3000`, `COLLABORATION_SANDBOX_LEDGER_HOLD=1`.
