# Prioritized correction register (r3.6)

Audit **NOT** complete. Remaining money/lifecycle gaps are product/provider limitations below.

| ID | Priority | Area | Finding | Evidence | Suggested direction |
|----|----------|------|---------|----------|---------------------|
| COR-01 | P0 | J15 payout | Simulation ≠ provider payout Pass | r36 J15; `providerE2eComplete:false` | Prove Connect/bank payout separately |
| COR-03 | P1 | J16 annual | Empty `billing.annualOffers` + no Stripe year Price | J16 r36 Fail RCA | Admin save annual offer + create year Price; or hide Annual CTA |
| COR-07 | P1 | J17 proration | `completeCheckout`/`applyPlanOnce` stores `cs_test_` as `SubscriptionState.externalId` (not `sub_`); `billing.prices` empty so `offer.priceId` blank | J17 r36 `previewNative` fail; repair still blocked on priceId | Persist Stripe `sub_` id; save price IDs in admin; expose portal when `stripeCustomerId` set |
| COR-08 | P3 | J20 | Closed in r3.6 Pass | invoice tax=239 hosted+pdf | — |
| COR-04 | P3 | J18 | Closed for Pro month Apply; annual Apply still gated by COR-03 | J18 r36 Pass screenshots | Unlock annual for annual-code Apply path |
| COR-09 | P1 | Visual/nav | Admin dual chrome + Creator terminology | `vis36-admin-dual-chrome.png` | Strip public nav from `/admin/*`; Influencer labels |
| COR-10 | P1 | J28 matching fee | No `CollaborationFeeRule` for `managed_intro` | J28 r36 feeQuote error | Seed/admin create managed_intro fee rule |
| COR-11 | P2 | Billing price IDs | `billing.prices` + `STRIPE_PRICE_*` empty | listBillingPriceIds all `''` | Persist Plus/Pro price IDs |
| COR-12 | P2 | J17 portal | No portal control when customer id missing | J17 r36 | Set customer on checkout complete; show Manage billing |

## Label legend

1. **Stripe TEST checkout** — real paid `cs_test_` / `sk_test_`  
2. **Simulated internal release** — `sim_sandbox_ledger_hold:*`, `providerE2eComplete=false`  
3. **Provider payout UNPROVEN** — no Connect/bank payout; simulation ≠ Pass
