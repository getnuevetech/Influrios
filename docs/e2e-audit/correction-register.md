# Correction register (#534)

Remediation PRs remain **PAUSED**.  
Pack is **NOT** complete verified UI/UX remediation. Deliverable gaps **IN SCOPE** (design/register only).

**Historical evidence freeze:** `db64224` — do **not** present that checklist as complete platform coverage.  
**In-repo pack:** [`docs/remediation-pack/`](../remediation-pack/).

## Legend

| Column | Meaning |
|--------|---------|
| Kind | `product` · `provider` · `audit-label` · `ux` · `security` · `harness` · `test-exec` · `evidence` |
| Ev | Evidence class: `reproduced` · `code-observed` · `user-reported` · `not-executed` |
| Acceptance | Subtest vs **aggregate** journey score |

## Scoring (expanded aggregate)

| Lens | Count | Notes |
|------|------:|-------|
| **Pass** | **20** | J01–J02, J04–J13, J19–J24, J26, J29 |
| **Partial** | **10** | J03, **J14**, J15–**J18**, J25, J27, J28, J30 |
| Old-checklist Coverage Incomplete | **0** | Scoped to **`db64224` checklist only** |
| Expanded upload / biz review UI / reply-depth / in-app invoice download | — | Remain **not executed** — not implied by that zero |

**Subtests vs aggregate**

| Journey | Subtest | Aggregate |
|---------|---------|-----------|
| J14 | Note-submission **Pass** | **Partial** (file upload + business Approve/Request-changes UI unproven) |
| J18 | Monthly Apply→pay→redeem **Pass** | **Partial** (annual Fail COR-04) |

## Register

| ID | Pri | Kind | Ev | Area | Finding | Acceptance | Evidence | Later remediation |
|----|-----|------|----|------|---------|------------|----------|-------------------|
| COR-SEC-01 | P0 | security | reproduced | Admin login | Public `/admin/login` can render bootstrap credential hints | Tracked issue | `issues.json`; `admin-login-root-cause.md` | Remove concrete credential rendering |
| COR-01 | P0 | provider | reproduced | J15 payout | Simulated release ≠ provider payout | J15 **Partial** | r36 J15; PL-01 | Prove Connect/bank payout |
| COR-03 | P1 | product | reproduced | J16 annual | Empty `billing.annualOffers` + no year Price | J16 year **Fail**; journey Partial | r36 J16 | Annual offer + year Price |
| COR-07 | P1 | product | reproduced | J17 proration | `externalId` as `cs_test_`; empty `billing.prices` | J17 **Partial** | r36 J17 | Persist `sub_` + price IDs |
| COR-11 | P2 | product | reproduced | Billing prices | Empty price IDs | Blocks J17 | `listBillingPriceIds()` | Persist Plus/Pro price IDs |
| COR-12 | P2 | product | reproduced | J17 portal | No portal without customer | J17 Partial | r36 J17 | Set customer on complete |
| COR-10 | P1 | product | reproduced | J28 matching fee | No `managed_intro` fee rule | J28 **Partial** | r36 J28 | Seed fee rule |
| COR-09a | P1 | ux | reproduced | Admin chrome | Public nav + admin chrome | J30 Partial | vis36 | Separate admin shell |
| COR-09b | P1 | ux | reproduced | Terminology | Creator vs Influencer | J30 Partial | vis35/36 | Rename copy |
| COR-18 | P1 | ux | reproduced | Mobile admin accounts | Clipped overflow at 390px | J30 Partial | `j30c-admin-accounts-mob-overflow.png` | Responsive admin nav/table |
| COR-13 | P2 | product | reproduced | J03 shortlist | Demo directory; no Shortlist CTA | J03 Partial | `j03p1-*` | Live profiles + CTA |
| COR-14 | P2 | audit-label | reproduced | J25 mutate | Prior SQL mutate ≠ admin Edit UI | J25 Partial | `j25p1-*` | Prove Edit save UI |
| COR-15 | P2 | harness | reproduced | J27 jobs/CMS | banners/homepage Save ok; Retry blocked; cms/content 404 | J27 Partial | `j27c-*` | Failed-job fixture |
| COR-16 | P2 | audit-label | reproduced | J30 | Coverage ≠ acceptance for visual Failures | J30 Partial | visual-review | Fix then retest |
| COR-04 | P3 | product | reproduced | J18 annual Apply | Annual codes gated by COR-03 | Monthly subtest Pass; **aggregate Partial** | `j18c-annual-apply.png` | Unlock annual first |
| COR-08 | — | **closed** | reproduced | J20 | UI quote→pay→**hosted** invoice/PDF reconcile 2900/−435/+203=2668 | J20 **Pass** | `j18-j20-complete-results.json`; `j20-invoice-*` | — |
| COR-19 | — | **closed** | reproduced | J18 redemption | Monthly discounted pay + reservation consumed | Monthly **Pass** (aggregate Partial via COR-04) | `j18-j20-postpay-probe.json` | Annual remains COR-04 |
| COR-17 | P3 | test-exec | reproduced | Hosted Checkout headless | Card accordion unreliable headless | computerUse used | PL-03 | Harness note |
| **COR-20** | **P1** | product/ux | **code-observed** | Deliverables | Errors `fail()` → `/payments`; closes popup; inputs lost | Drives J14 aggregate Partial | `payments/actions.ts`; `docs/remediation-pack/addenda/COR-20-*.md`; boards `preserved-input-errors.html` | Stay in popup; inline error; preserve; Retry |
| **COR-21** | **P1** | product/ux | **not-executed** path; Attach **reproduced** | Deliverables | File upload E2E unproven; progress/remove/fail UX thin | Drives J14 aggregate Partial | j14 Attach control; no file assert; `COR-21-*.md`; boards `upload-*.html` | Full path + failure boards |
| **COR-22** | **P1** | product/ux | **code-observed** | Deliverables | Literal `https://` required; bare domains rejected | Track link UX | `milestone-delivery.ts`; `payment-route.test.ts`; `COR-22-*.md`; `normalized-links.html` | Normalize bare domain; reject unsafe inline |
| **COR-23** | **P2** | audit-label | **not-executed** UI; lib **reproduced** | J14 review UI | `uiRevise=false`, `uiApprove=false` | Drives J14 aggregate Partial | `local-journey-r35-results.json`; `business-review-actions.html` | Prove Request changes + Approve in popup |
| **COR-24** | **P2** | product | **not-executed** | Billing history | In-app `/billing` View invoice / Download PDF **not** proven | **Does not demote J20** (hosted Stripe invoice Pass stands) | Spec §1; `j18j20-billing-after-pay.png` shows history without in-app download proof | Add in-app actions + retest (R2) |
| **COR-25** | **P2** | evidence | **not-executed** (depth) | Messages | Attachment fail/retry + workroom composer depth thin | **Does not demote J22** two-party send Pass (`J22-local-two-party-messaging`) | nonfunding J22; MSG-REPLY-001 staging gap | Depth/retry evidence; keep J22 Pass |

## Retained Pass (aggregate)

J01–J02, J04–J13, J19–J24, J26, J29.

## Pack (in-repo)

- [`docs/remediation-pack/README.md`](../remediation-pack/README.md)  
- [`docs/remediation-pack/ADDENDUM-v1.1-deliverables.md`](../remediation-pack/ADDENDUM-v1.1-deliverables.md)  
- [`docs/remediation-pack/addenda/`](../remediation-pack/addenda/)  
- [`docs/remediation-pack/design-boards/`](../remediation-pack/design-boards/)
