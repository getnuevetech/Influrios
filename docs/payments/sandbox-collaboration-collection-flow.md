# Sandbox collaboration collection flow

**PR scope:** sandbox-only collaboration collection routing for E2E testing.  
**Not in scope:** enabling live collaboration deposits, claiming allocated-funds/Treasury collection from capability probes, or silently changing the Influrios Payment Standard.

## Capability probe (this Stripe account)

Retrieved via `GET /v1/account` with `STRIPE_SECRET_KEY` (`sk_test_…`):

| Capability | Result |
| --- | --- |
| `card_payments` | active |
| `transfers` | active |
| `us_bank_account_ach_payments` | active |
| **allocated funds** | **unavailable / unproven** |
| **Treasury** | **unavailable / unproven** |

**Precise limitation:** Capability availability is **not** an implemented or proven payment flow. Live collaboration collection stays **closed**. Provider collaboration E2E (allocated/Treasury hold → release → bank payout) is **not** complete.

Failed probes (HTTP 401, timeout, invalid payload) are **verification_failed** — they do **not** open `sandbox_ledger_hold`.

## Routing / verification design

1. **`verifyCollaborationCollectionAccess`** probes Stripe and records `probe.status` (`checked` | `failed`).
2. **`resolveCollaborationCollectionRoute`** gates:
   - **Live key or live environment:** always refuse (`live_closed`). Capability flags never set `providerE2eComplete` or open collection.
   - **Failed probe:** refuse (`verification_failed`).
   - **Empty host / prod host (`influrios.com`):** refuse.
   - **Untrusted deployment** (`NODE_ENV`/`VERCEL_ENV` production, or unset): refuse.
   - **Missing `COLLABORATION_SANDBOX_LEDGER_HOLD=1`:** refuse.
   - **Sandbox gates pass:** open labelled **`sandbox_ledger_hold`** only (`simulation: true`, `providerE2eComplete: false`). Ordinary Checkout is used as a **test collection** — never labelled as allocated-funds/Treasury collection.

3. **Provenance:** On deposit open, funding `routeSnapshotJson.collaborationCollection` and deposit `instructionsJson` persist sandbox provenance. Settlement **and** `createReleaseOrTransfer` use the same `authorizeSandboxLedgerHoldRelease` gate (trusted deployment + enable flag + provenance + non-prod host). Changing the Stripe key later does **not** reclassify existing funding.

4. **Resume:** Returning an existing unpaid Checkout URL requires the same authorize step first (prod host / missing flag refuse). Already-paid reconciliation stays separate.

5. **Probe payload:** HTTP 200 with `{}`, `[]`, or a list object is `verification_failed` — not sandbox_ledger_hold.

6. **Tax fields:** Settlement simulation does **not** overwrite `taxReason`; simulation metadata goes to `commandKey` / audit / reconciliation.

## Sandbox flow under test

```
[sandbox only: sk_test + trusted deployment + COLLABORATION_SANDBOX_LEDGER_HOLD=1 + non-prod host]
  Business starts card/ACH deposit
    → verifyCollaborationCollectionAccess
    → topology = sandbox_ledger_hold (SIMULATION)
    → persist provenance on funding + deposit
    → Stripe Checkout Session (livemode=false)   ← test checkout, not allocated-funds collection
  Pay with test card → funding.held (Influrios ledger)
  Milestone approve → settlement executor
    → requires trusted env + explicit enable + persisted provenance
    → atomic sim transferRef + audit (DB failure ⇒ ok:false)
    → retries keep state=sandbox_simulation, providerE2eComplete=false
  Influencer payout UI may reflect ledger — Stripe allocated/Treasury payout NOT executed
```

## vs intended production

| Step | Production (Payment Standard) | This PR sandbox path |
| --- | --- | --- |
| Collection | Allocated-funds / Treasury | Ordinary Checkout + **simulation** label |
| Holding | Provider-side hold | Influrios ledger `held` |
| Release | Provider release | `sim_sandbox_ledger_hold:*` |
| Payout | Connect / bank payout | Not claimed |

## Audit note (after merge/review)

Re-run journeys distinguishing: **Stripe test checkout** vs **simulated internal release** vs **unproven provider payout**.  
J17 = subscription changes; J20 = quote-to-charge/tax. Do not mark #534 Pass boxes from this PR alone.

## Code anchors

- `src/lib/payment-account-routing.ts`
- `src/lib/collaboration-collection-access.ts`
- `src/lib/funding-checkout.ts`
- `src/lib/payment-settlement-executor.ts`
- `src/lib/stripe-payment-adapter.ts`
- Tests: `collaboration-collection-access.test.ts`, `payment-settlement-executor.test.ts`
