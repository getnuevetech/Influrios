# Journeys (revision r3.5 — deepen; audit NOT complete)

Operator attestation checkboxes are **not** a gate. Local dedicated Postgres + Mailpit + synthetic `@example.com` + `sk_test_` only.  
**Live collaboration deposits stay closed.** `COLLABORATION_SANDBOX_LEDGER_HOLD=1` + localhost enables labelled `sandbox_ledger_hold` TEST collection only.

## Money evidence labels (required)

| Label | Meaning | Counts as original Pass? |
|-------|---------|--------------------------|
| Stripe TEST checkout | Real `cs_test_` / `sk_test_` / livemode=false payment confirmed | Yes for collection/checkout steps |
| Simulated internal release | `sim_sandbox_ledger_hold:*`, `providerE2eComplete=false` | **No** for J15 provider payout |
| Provider payout UNPROVEN | Connect/bank payout not executed | **No** |

## Matrix (original acceptance criteria)

| ID | Original definition | Status | Notes |
|----|---------------------|--------|-------|
| J01 | Signup + verify | Pass | prior local evidence |
| J02 | Login members + admin | Pass | admin harness reconfirm |
| J03 | Discover / card | **Pass** | r3.5: discover card open + `BusinessShortlistItem` mutate (`j03r35-*`) |
| J04 | Brief create/send | Pass | prior |
| J05 | Applications | Pass | prior |
| J06 | Active collaboration | Pass | prior |
| J07 | Draft delete | Pass | prior |
| J08 | Withdraw application | Pass | prior |
| J09 | Signed delete blocked | Pass | prior |
| J10 | Contract send | Pass | prior |
| J11 | Dual sign | Pass | prior |
| J12 | Signed status / version | Pass | prior |
| J13 | Business collaboration checkout | **Pass** | Stripe TEST → funding **held** (`sandbox_ledger_hold`) |
| J14 | Deliver → revise → approve | **Pass** | r3.5 dual-party workroom: UI submit v1 → lib revise → v2 → approve → `release_scheduled`; submissions v1 `revision_requested` / v2 `approved`; stale approve blocked; funding stays **held**. Media `j14r35-*`. Approval ≠ payout |
| J15 | Release / transfer / payout | Partial | **Simulated** `sim_sandbox_ledger_hold:…`; **payout UNPROVEN** — never Pass |
| J16 | New user monthly + annual purchases | Partial* | **Month Pass** (r3.4). **Year:** blocked — see RCA below |
| J17 | Existing subscriber changes | Partial | Active Plus on influencerB; Pro upgrade Checkout opened; annual blocked by config; portal/proration confirm incomplete |
| J18 | Discount eligibility + Apply | Partial | Server year-accept / month-reject OK; Apply UI not reached — annual Plus unavailable |
| J19 | Configure tax by country/charge | Pass | prior UI save `TaxPolicyVersion` US · All subscription plans · 8.25% |
| J20 | Quote through final charge | Partial | Tax calc 8.25% on $19 = 157¢ OK; Stripe invoice/receipt tax line incomplete |
| J21 | Business shell / entities | **Pass** | r3.5 hub/account/team/billing + BusinessProfile |
| J22 | Two-party messaging | Pass | prior dual-party + Mailpit |
| J23 | Notifications / Mailpit | Pass | prior |
| J24 | Access restrictions | **Pass** | Unrelated → workroom **404**; member `/admin` → login; other business denied actions (`j24r35-*`) |
| J25 | Admin accounts | **Pass** | inventory + phone mutate |
| J26 | Admin plans | **Pass** | EntitlementPlan catalog + payment-settings |
| J27 | Admin jobs/CMS | **Pass** | jobs/cms/content surfaces reachable |
| J28 | Matching lifecycle | Partial | intros inventoried; advance/fee lifecycle incomplete |
| J29 | Public/marketing | **Pass** | home/pricing/about/faq/login captured |
| J30 | Visual / a11y / popups | **Pass*** | Expanded `vis35-*` desk+mob; findings remain in correction register (dual chrome, terminology) — functional journey Pass on coverage; product UX issues tracked separately |
| AGENCY | — | N/A | Deferred |

## Plus / Pro / annual unavailability — root cause (r3.5)

| Symptom | Root cause | Evidence |
|---------|------------|----------|
| Annual checkout refused | `PlatformSetting` key `billing.annualOffers` **absent/empty** → `recurringOfferFor(sku,'year')` → `ok:false` (“Annual billing is not available…”) | `listAnnualOffers()={}`; year `startCheckout` error |
| No annual Stripe Price | Stripe TEST account has **only** `AUDIT Influencer Plus` **month** `$19` (`price_1UdKNn…`); no `year` interval Price | Stripe `prices.list` |
| Historical Plus/Pro “temporarily unavailable” | `paidPlanAvailability` when **no** matching country tax rule | Mitigated: US `TaxPolicyVersion` ready `subscription` **825 bps** present; Pro month `startCheckout` **ok** |
| Env price IDs empty | `billing.prices` unset + `STRIPE_PRICE_*` empty; monthly still opens via Checkout amount fallback | `listBillingPriceIds()` all `''` |

## Status counts (J01–J30)

- Pass: **24** (incl. J14 dual-party; J16-month evidence retained; J16 overall Partial until annual)
- Partial: **6** (J15, J16, J17, J18, J20, J28)
- Blocked (collection gate): **0** on sandbox path — live deposits stay closed
- Not tested: **0**

\*J16 counted Partial in matrix until annual also Pass; monthly Stripe TEST checkout is Pass evidence.  
\*J30 Pass = expanded visual coverage executed; COR-09 dual chrome / terminology remain open product findings (not silent).

**Audit is NOT complete.** See [local-journey-r35-results.json](./local-journey-r35-results.json).
