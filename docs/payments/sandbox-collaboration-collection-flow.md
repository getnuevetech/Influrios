# Sandbox collaboration collection flow

**PR scope:** sandbox-only collaboration collection routing for E2E testing.  
**Not in scope:** silently enabling live collaboration deposits or changing the Influrios Payment Standard topologies (`connect_allocated_funds` / `treasury_financial_accounts`) without proven provider access.

## Capability probe (this Stripe account)

Retrieved via `GET /v1/account` with `STRIPE_SECRET_KEY` (`sk_test_…`):

| Capability | Result |
| --- | --- |
| `card_payments` | active |
| `transfers` | active |
| `us_bank_account_ach_payments` | active |
| **allocated funds** (`allocated_funds` / Connect allocated-funds preview) | **unavailable** |
| **Treasury** (`treasury` / financial accounts) | **unavailable** (`GET /v1/treasury/financial_accounts` → not onboarded) |

**Precise limitation:** Stripe allocated funds and Treasury financial accounts are unavailable on this account. Provider collaboration E2E (allocated/Treasury hold → release → bank payout) is **not** complete.

## Routing / verification design

Call sites no longer hardcode `collaborationCollectionGate({ allocatedFunds: false, treasury: false })`.

1. **`verifyCollaborationCollectionAccess`** (`src/lib/collaboration-collection-access.ts`)  
   - Loads Stripe credentials (`sk_test` / `sk_live` classification).  
   - Probes `/v1/account` (and Treasury FA list when a treasury capability flag is present).  
   - Passes real probe booleans into **`resolveCollaborationCollectionRoute`**.

2. **`resolveCollaborationCollectionRoute`** (`src/lib/payment-account-routing.ts`)  
   - **Live key or live environment:** open only if probe proves allocated funds **or** Treasury; otherwise refuse. Never opens `sandbox_ledger_hold`.  
   - **`sk_live` + sandbox label:** refuse (live credentials cannot open the sandbox path).  
   - **`sk_test` + live environment:** refuse.  
   - **`sk_test` + sandbox + live product host (`influrios.com`):** refuse (sandbox path cannot enable live collection).  
   - **`sk_test` + sandbox + non-prod host + no allocated/Treasury:** open **`sandbox_ledger_hold`** with `simulation: true`, `providerE2eComplete: false`, and an explicit limitation string. Does **not** set `allocatedFunds`/`treasury` to true.

## Sandbox flow under test (collection → holding → release → payout)

```
[sandbox only: sk_test + non-prod host]
  Business starts card/ACH deposit (funding-checkout)
    → verifyCollaborationCollectionAccess
    → topology = sandbox_ledger_hold (SIMULATION)
    → Stripe Checkout Session (mode=payment, livemode=false)
  Business pays with test card
    → webhook / confirmGatewayDeposit
    → marketplace funding.held  (Influrios ledger hold)
  Milestone approve
    → settlement executor
    → SIMULATION transferRef = sim_sandbox_ledger_hold:<settlementId>
    → reconciliation case records capability limitation
  Influencer “payout”
    → app may show released balance / withdrawal UI against ledger
    → Stripe allocated-funds release / Treasury outbound payment is NOT executed
```

Notifications for local E2E stay on Mailpit / local SMTP (`SMTP_HOST`); fixtures use synthetic `@example.com` addresses. No customer notices on live.

## Intended production flow (difference)

| Step | Production (Payment Standard) | Sandbox ledger-hold (this PR) |
| --- | --- | --- |
| Collection | Stripe allocated-funds charge **or** Treasury FA credit | Ordinary Checkout PaymentIntent to platform balance |
| Holding | Provider-side allocated / FA balance | **Influrios marketplace ledger** `held` only |
| Release | Allocated release / Treasury outbound with application fee | **Labelled simulation** transfer ref; no provider movement |
| Payout | Connect / bank payout on proven manual-payout control | App-ledger only; not claimed as provider E2E |

Production collaboration deposits remain **closed** until allocated funds or Treasury is proven on the live account.

## After merge / review

Re-run audit journeys **J13–J15 / J17 / J20** (and related) against this routing. Do **not** mark audit Pass boxes from an unreviewed change.

## Code anchors

- Routing: `src/lib/payment-account-routing.ts` (`resolveCollaborationCollectionRoute`, `sandboxLedgerHoldReleaseSimulation`)
- Probe + verify: `src/lib/collaboration-collection-access.ts`
- Deposit open: `src/lib/funding-checkout.ts`
- Adapter / settlement: `src/lib/stripe-payment-adapter.ts`, `src/lib/payment-settlement-executor.ts`
- Tests: `src/lib/collaboration-collection-access.test.ts`, extensions in `payment-account-routing.test.ts`
