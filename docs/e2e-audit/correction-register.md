# Correction register (phase 1 + bounded closure — evidence-linked)

Single register for #534. Separates **product defects**, **provider dependencies**, and **audit-label corrections**. Remediation PRs are **PAUSED** for this bounded closure.

## Legend

| Column | Meaning |
|--------|---------|
| Kind | `product` · `provider` · `audit-label` · `ux` · `security` |
| Acceptance | How the related journey should be scored until fixed |
| Evidence | Pack path / case id |

## Register

| ID | Pri | Kind | Area | Finding | Acceptance | Evidence | Later remediation (not this phase) |
|----|-----|------|------|---------|------------|----------|--------------------------------------|
| COR-SEC-01 | P0 | security | Admin login | Public `/admin/login` can render bootstrap credential hints | Tracked issue; interrupt if still live on customer hosts | `issues.json` ISSUE-P0-ADMIN-LOGIN-DEFAULT-CREDS; `admin-login-root-cause.md` | Remove concrete credential rendering |
| COR-01 | P0 | provider | J15 payout | Simulated `sim_sandbox_ledger_hold:*` ≠ provider payout | J15 **Partial** — payout unproven pending provider integration/testing | `local-journey-r36-results.json` J15; `provider-limitations.md` PL-01 | Prove Connect/bank payout in provider sandbox |
| COR-03 | P1 | product | J16 annual | Empty `billing.annualOffers` + no Stripe year Price → year checkout refused | J16 year **Fail**; J16 overall **Partial** (month Pass) | r36 J16 Fail RCA; Stripe prices.list | Admin annual offer + year Price; or hide Annual CTA |
| COR-07 | P1 | product | J17 proration | `SubscriptionState.externalId` stored as `cs_test_` not `sub_`; `billing.prices` empty → no proration preview | J17 **Partial** | r36 J17 `previewNative` / `previewAfterRepair` | Persist `sub_`; save price IDs; portal when customer set |
| COR-11 | P2 | product | Billing prices | `billing.prices` + `STRIPE_PRICE_*` empty; monthly uses Checkout amount fallback | Blocks J17 tier change; does not void J16 month Pass | `listBillingPriceIds()` | Persist Plus/Pro price IDs in admin |
| COR-12 | P2 | product | J17 portal | No Manage/portal control when `stripeCustomerId` unset at complete | J17 Partial (portal untested) | r36 J17 `portalAttempt` | Set customer on checkout complete |
| COR-10 | P1 | product | J28 matching fee | No active `CollaborationFeeRule` for `serviceLevel=managed_intro` | J28 **Partial** — lifecycle advanced; fee quote blocked | r36 J28 `feeQuote` / `introRules=0` | Admin/seed managed_intro fee rule |
| COR-09a | P1 | ux | Admin chrome | Public Home/Discover/Pricing nav appears with admin ops chrome | J30 acceptance **Partial** (A-ADMIN-CHROME-01 Fail) | `vis36-admin-dual-chrome.png`; ISSUE-VIS-ADMIN-DUAL-CHROME | Separate admin shell |
| COR-09b | P1 | ux | Terminology | “Creator” / “Discover Creators” / “Top Creator Categories” vs Influencer | J30 acceptance **Partial** (A-TERM-CREATOR-001 Fail) | `vis35-*` / `vis36-*`; ISSUE-VIS-TERM-CREATORS | Rename copy |
| COR-18 | P1 | ux | Mobile admin accounts | `/admin/accounts` at 390×844: persistent sidebar + table width ~658px clips into overflow (tab “Admin users —” truncated; account rows clipped) | J30 **Partial** (defect documented; Partial alone ≠ documenting) | `j30c-admin-accounts-mob-overflow.png`; metrics in `phase1-bounded-closure-results.json` | Collapse admin nav on narrow viewports; horizontal scroll container or responsive table |
| COR-13 | P2 | product | J03 shortlist | Discover demo profiles: “cannot be booked”; no Shortlist control on card | J03 demoted **Partial** | `j03p1-*`; body copy sample directory | Live profiles + shortlist CTA |
| COR-14 | P2 | audit-label | J25 mutate | Prior Pass used DB `UPDATE` phone; admin View/Edit UI did not expose editable phone in phase-1 probe | J25 demoted **Partial** (inventory Pass) | r35 DB mutate; `j25p1-view-account.png` / edit probe | Prove Edit account field save in UI |
| COR-15 | P2 | audit-label / harness | J27 jobs/CMS | Banners + homepage Save executed successfully; jobs Retry **blocked** (no failed row); `/admin/cms` + `/admin/content` **404** — publish path is banners/homepage | J27 **Partial** | `j27c-banners-saved.png`; `j27c-homepage-saved.png`; `j27c-jobs.png`; `j27c-_admin_cms.png` | Failed-job fixture for Retry; document canonical CMS routes |
| COR-16 | P2 | audit-label | J30 Pass overstated | Visual coverage expanded but acceptance checklist still Fails COR-09a/b (+ COR-18) | J30 demoted **Partial** | `visual-review.md`; vis36; j30c | Fix chrome/terminology/overflow then retest |
| COR-04 | P3 | product | J18 annual Apply | Annual discount codes still gated by COR-03 | J18 Apply-to-Stripe **Pass**; annual Apply **Fail/Unresolved** | `j18c-annual-apply.png`; COR-03 | Unlock annual first |
| COR-19 | P2 | audit-label | J18 redemption | Hosted Checkout coupon line ≠ completed discounted payment / Influrios redemption | Journey acceptance **Partial**; redemption step **not_executed** / Unresolved | `j18c2-stripe-with-coupon.png`; `phase1-bounded-closure-results.json` | Complete paid discounted Checkout + redemption record |
| COR-08 | P2 | audit-label | J20 Pass overstated | Prior Pass used `startCheckout(taxPercent)` / API path; **not** full Influrios UI quote→payment→invoice. UI now opens Stripe; payment blocked PL-03; invoice **not_executed** | J20 demoted **Partial**; coverage **Incomplete** | `j20c2-*`; prior `j20r36-*` retained as subtest only | Headed/computerUse UI payment + invoice proof |
| COR-17 | P3 | test-exec | Hosted Checkout headless | Headless Card accordion unreliable | Use headed/computerUse | COR-02 / PL-03 | Document harness only |

## Closed / retained Pass (not demoted this closure)

| Journey | Why Pass still supported |
|---------|--------------------------|
| J01–J02, J04–J14, J19, J21–J24, J29 | Local evidence cases with screenshots / DB assertions (see `local-journey-results.json`, r34/r35) |
| J16 month | Stripe TEST Subscribe + `SubscriptionState` active |
| J26 | **edit→save→reload** on admin plan meta (`j26c-*`); catalog alone is not Pass |
| J18 Apply-to-Stripe **subtest** | Stripe Checkout shows discount (`j18p1-us-checkout.png`, `j18c2-stripe-with-coupon.png`) — journey overall Partial |

## Label legend (money)

1. **Stripe TEST checkout** — real paid `cs_test_` / `sk_test_` / livemode=false  
2. **Simulated internal release** — `sim_sandbox_ledger_hold:*`, `providerE2eComplete=false`  
3. **Provider payout UNPROVEN** — pending provider integration/testing (PL-01)
