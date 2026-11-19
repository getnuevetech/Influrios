# Prioritized correction register (r3.5)

Evidence-backed product/UX issues from local dedicated audit. Not a silent Pass list. Audit **NOT** complete.

| ID | Priority | Area | Finding | Evidence | Suggested direction |
|----|----------|------|---------|----------|---------------------|
| COR-01 | P0 | J15 payout | Simulated `sim_sandbox_ledger_hold:*` release must never be counted as provider payout Pass | `local-journey-r35-results.json` J15; `providerE2eComplete:false` | Keep Payment Standard hold→release→bank payout as separate proof |
| COR-02 | P0 | J16 hosted pay | Headless Playwright often fails Stripe Card accordion; computerUse succeeds | J13/J16-month prior | Document headed/computerUse path for hosted Checkout |
| COR-03 | P1 | J16 annual | Annual unavailable: empty `billing.annualOffers` + no Stripe year Price in TEST | r3.5 RCA in journeys.md; only month `price_1UdKNn…` | Admin: save annual offer + create Stripe year Price; or hide Annual CTA |
| COR-04 | P1 | J18 Apply UI | Discount Apply unreachable while annual Plus gated | J18 r35; server year-ok / month-reject | Unlock annual first; expose discount field on annual Checkout panel |
| COR-05 | P2 | Plan availability (historical) | “temporarily unavailable” from missing country tax rule | Mitigated: US subscription 8.25% rule present; Pro month checkout opens | Keep tax-rule gate; admin empty-state → tax config |
| COR-06 | P3 | J14 workroom entry | Workroom deep-links work; hub CTAs still easy to miss | J14 Pass via `?focus=` | Clearer hub → workroom entry |
| COR-07 | P1 | J17 proration | Active Plus confirmed; Customer Portal / `subscription.update` proration not completed | J17 r35 Pro hosted open; annual blocked | Finish portal cancel/resume + proration screenshots after annual/Pro prices exist |
| COR-08 | P1 | J20 receipt chain | Tax quote 8.25% OK; Stripe invoice tax often 0 without `taxRateId`/automatic_tax | J20 r35 calcOk; invoice list | Attach exclusive tax rate or automatic_tax on Subscribe; capture receipt |
| COR-09 | P1 | Visual/nav | **Admin dual chrome:** public Home/Discover/Pricing nav above admin ops (`vis35-admin-home-desk.png`). **Terminology:** “Top Creator Categories” / Creator wording persists alongside Influencer | `vis35-*`; visual-review.md | Strip public marketing nav from `/admin/*`; standardize Influencer label |
| COR-10 | P2 | Matching | ManagedIntro inventory only; fee/advance lifecycle open | J28 Partial | Continue intro advance/fee without funding dependency |
| COR-11 | P2 | Billing price IDs | `billing.prices` + `STRIPE_PRICE_*` empty; monthly relies on Checkout amount fallback | `listBillingPriceIds()` | Persist price IDs in admin payment settings for Plus/Pro/Business |

## Label legend (money journeys)

1. **Stripe TEST checkout** — real `cs_test_` / `sk_test_` / `livemode=false` payment confirmed.
2. **Simulated internal release** — `sim_sandbox_ledger_hold:*`, `providerE2eComplete=false`.
3. **Provider payout UNPROVEN** — Connect/bank payout not executed; simulation ≠ Pass.
