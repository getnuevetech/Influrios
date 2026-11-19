# Prioritized correction register (r3.4)

Evidence-backed product/UX issues from local dedicated audit after #535 merge. Not a silent Pass list.

| ID | Priority | Area | Finding | Evidence | Suggested direction |
|----|----------|------|---------|----------|---------------------|
| COR-01 | P0 | J15 payout | Simulated `sim_sandbox_ledger_hold:*` release must never be counted as provider payout Pass | `local-journey-r34-results.json` J15; `providerE2eComplete:false` | Keep Payment Standard hold→release→bank payout as separate proof; audit labels simulation explicitly |
| COR-02 | P0 | J16 hosted pay | Headless Playwright often fails to expand/fill Stripe Card fields; computerUse succeeds | J13 paid via computerUse; J16 month `cs_test_` opened unpaid (`payMethod:no-pi`) | Document headed/computerUse path for hosted Checkout; optional Stripe CLI listener |
| COR-03 | P1 | J16 annual | `startCheckout` year → “Annual billing is not available for this plan” for creator_plus | J16 year Fail actual | Confirm product: enable annual Stripe price for Plus, or surface clearer pricing UX |
| COR-04 | P1 | J18 Apply UI | Discount Apply control not reachable from pricing when upgrade panel/checkout field absent | J18 r34 screenshots; server eligibility Pass | Ensure annual Checkout panel exposes discount field when plans are purchasable |
| COR-05 | P1 | Plan availability | Historical “temporarily unavailable” caused by missing country tax rule (`paidPlanAvailability`) | `country-tax.ts`; tax family rule now present; pricingUnavailable=false in r34 | Keep tax rule required; admin empty-state should point to tax config |
| COR-06 | P2 | J14 workroom | Milestone status can be mutated in DB; dual-party UI workroom recording incomplete | J14 Partial | Product workroom routes for submit/revise/approve need clearer entry from hubs |
| COR-07 | P2 | J17 changes | Influencer on Starter Free — Change plan UI present; no active paid sub for proration proof | J17 billing screenshots | Complete after J16 paid sub exists; exercise upgrade/downgrade/cancel in sandbox |
| COR-08 | P2 | J20 chain | Tax calc 8.25% works; checkout→invoice→receipt reconciliation incomplete | J20 calc ok taxCents=825 | Finish with paid subscription invoice + receipt screenshots |
| COR-09 | P2 | Visual/nav | Expanded desktop/mobile captures; check duplicated public nav in admin + Creator vs Influencer wording | `vis34-*` screenshots; findings in VIS-r34 | Align admin chrome (no public Discover/Plans nav); standardize Influencer terminology |
| COR-10 | P3 | Matching | ManagedIntro draft create Partial earlier; full lifecycle still open | prior J28 Partial | Continue intro advance/fee without funding dependency |

## Label legend (money journeys)

1. **Stripe TEST checkout** — real `cs_test_` / `sk_test_` / `livemode=false` payment confirmed.
2. **Simulated internal release** — `sim_sandbox_ledger_hold:*`, `providerE2eComplete=false`.
3. **Provider payout UNPROVEN** — Connect/bank payout not executed; simulation ≠ Pass.
