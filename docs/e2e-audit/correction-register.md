# Correction register (phase 1 consolidated — evidence-linked)

Single register for #534. Separates **product defects**, **provider dependencies**, and **audit-label corrections**. Remediation PRs are **out of scope** for phase 1.

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
| COR-11 | P2 | product | Billing prices | `billing.prices` + `STRIPE_PRICE_*` empty; monthly uses Checkout amount fallback | Blocks J17 tier change; does not void J16/J20 month Pass | `listBillingPriceIds()` | Persist Plus/Pro price IDs in admin |
| COR-12 | P2 | product | J17 portal | No Manage/portal control when `stripeCustomerId` unset at complete | J17 Partial (portal untested) | r36 J17 `portalAttempt` | Set customer on checkout complete |
| COR-10 | P1 | product | J28 matching fee | No active `CollaborationFeeRule` for `serviceLevel=managed_intro` | J28 **Partial** — lifecycle advanced; fee quote blocked | r36 J28 `feeQuote` / `introRules=0` | Admin/seed managed_intro fee rule |
| COR-09a | P1 | ux | Admin chrome | Public Home/Discover/Pricing nav appears with admin ops chrome | J30 acceptance **Partial** (A-ADMIN-CHROME-01 Fail) | `vis36-admin-dual-chrome.png`; ISSUE-VIS-ADMIN-DUAL-CHROME | Separate admin shell |
| COR-09b | P1 | ux | Terminology | “Creator” / “Discover Creators” / “Top Creator Categories” vs Influencer | J30 acceptance **Partial** (A-TERM-CREATOR-001 Fail) | `vis35-*` / `vis36-*`; ISSUE-VIS-TERM-CREATORS | Rename copy |
| COR-13 | P2 | product | J03 shortlist | Discover demo profiles: “cannot be booked”; no Shortlist control on card | J03 demoted **Partial** | `j03p1-*`; body copy sample directory | Live profiles + shortlist CTA |
| COR-14 | P2 | audit-label | J25 mutate | Prior Pass used DB `UPDATE` phone; admin View/Edit UI did not expose editable phone in phase-1 probe | J25 demoted **Partial** (inventory Pass) | r35 DB mutate; `j25p1-view-account.png` / edit probe | Prove Edit account field save in UI |
| COR-15 | P2 | audit-label | J27 jobs/CMS | Prior Pass = route reachable only; no job run / CMS publish evidence | J27 demoted **Partial** | `j27r35-*` | Exercise create/publish/run |
| COR-16 | P2 | audit-label | J30 Pass overstated | Visual coverage expanded but acceptance checklist still Fails COR-09a/b | J30 demoted **Partial** | `visual-review.md`; vis36 | Fix chrome/terminology then retest |
| COR-04 | P3 | product | J18 annual Apply | Annual discount codes still gated by COR-03 | J18 month Apply **Pass**; annual Apply blocked | J18 r36/p1 | Unlock annual first |
| COR-08 | — | closed | J20 | Quote→tax→invoice Pass retained | Pass | `j20r36-*`; invoice tax=239 | — |
| COR-17 | P3 | test-exec | Hosted Checkout headless | Headless Card accordion unreliable | Use headed/computerUse | COR-02 / PL-03 | Document harness only |

## Closed / retained Pass (not demoted)

| Journey | Why Pass still supported |
|---------|--------------------------|
| J01–J02, J04–J14, J19, J22–J24, J26, J29 | Local evidence cases with screenshots / DB assertions (see `local-journey-results.json`, r34/r35) |
| J16 month | Stripe TEST Subscribe + `SubscriptionState` active |
| J18 | Apply UI + year-on-month reject + Stripe Checkout shows `AUDITPRO15M` discount (`j18p1-us-checkout.png`) |
| J20 | Paid Pro+tax; invoice tax=239; hosted+PDF |

## Label legend (money)

1. **Stripe TEST checkout** — real paid `cs_test_` / `sk_test_` / livemode=false  
2. **Simulated internal release** — `sim_sandbox_ledger_hold:*`, `providerE2eComplete=false`  
3. **Provider payout UNPROVEN** — pending provider integration/testing (PL-01)
