# Provider limitations (separate from product acceptance)

These are **not** “Partial forever” labels. They are precise dependencies that keep a journey from product-acceptance Pass until the named provider integration is available and tested in sandbox.

| ID | Journey | Dependency | What was proven instead | Acceptance impact |
|----|---------|------------|-------------------------|-------------------|
| PL-01 | J15 release / transfer / payout | Stripe Connect (or equivalent) transfer/payout to influencer bank/external account must be executed and attested in TEST/sandbox with livemode=false | Internal `sim_sandbox_ledger_hold:*` release only (`providerE2eComplete=false`) | **Partial** — provider payout **unproven pending provider integration/testing**. Simulation must never be counted as payout Pass. |
| PL-02 | J16 annual (price object) | Stripe TEST catalog must include an active Price with `recurring.interval=year` bound via `billing.annualOffers` / admin | Monthly Plus Price exists; year checkout refused before charge | Product Fail for annual (also see product config). Provider side: no year Price in this TEST account. |
| PL-03 | Hosted Checkout card UI | Headless automation often cannot expand Stripe Card accordion; headed/computerUse required | J13/J16-month/J20 paid via computerUse or confirm path | Test-execution note only — not a product Fail when headed path succeeds |

## Rules

1. Do not invent commercial rates or create live Prices as “audit fixes.”  
2. Do not claim payout Pass from simulation.  
3. When only simulation is available, record **Partial** with this dependency table — not “Partial forever.”
