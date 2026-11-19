# Blockers (revision r3.6)

## Open — precise product / provider limitations

### BLK-J15-PROVIDER-PAYOUT-UNPROVEN (forever Partial)
- Simulation only; never Pass without Connect/bank payout proof.

### BLK-J16-ANNUAL-PLAN (Fail — RCA)
1. `PlatformSetting` `billing.annualOffers` empty.  
2. Stripe TEST has no active year-interval Price.  
3. Monthly Plus Pass retained.

### BLK-J17-PRORATION-PRODUCT-GAPS (Partial)
1. `SubscriptionState.externalId` stored as Checkout Session id (`cs_test_`), not Subscription id (`sub_`).  
2. `billing.prices` / catalog `offer.priceId` empty → `actionPreviewTierChange` cannot compute amount due.  
3. Portal control absent when `stripeCustomerId` unset at complete.

### BLK-J28-MANAGED-INTRO-FEE-RULE (Partial)
- Lifecycle advances to `in_conversation`.  
- `requestIntroFeeSettlement` fails: no active `CollaborationFeeRule` with `serviceLevel=managed_intro`.

## Closed this revision

- J18 Apply UI (Pro month) — Pass  
- J20 quote→charge→tax→invoice — Pass  

## Environment

- `COLLABORATION_SANDBOX_LEDGER_HOLD=1`, `sk_test_`, Mailpit, `influrios_audit`, `APP_URL=http://127.0.0.1:3000`
