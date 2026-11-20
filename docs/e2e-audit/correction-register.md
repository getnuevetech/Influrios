# Correction register (J18/J20 completion — evidence-linked)

Single register for #534. Remediation PRs remain **PAUSED**.  
**2026-11-20 expansion:** deliverable workflow gaps **IN SCOPE** for design/register only — see store pack `docs/remediation-pack/` (addenda COR-20–22). Pack is **NOT** complete verified UI/UX remediation.

## Legend

| Column | Meaning |
|--------|---------|
| Kind | `product` · `provider` · `audit-label` · `ux` · `security` · `harness` · `test-exec` |
| Acceptance | How the related journey should be scored until fixed |
| Evidence | Pack path / case id |

## Scoring note

Monthly J18 Pass retained. All-required-branches aggregate (annual Fail COR-04 included): **21 Pass / 9 Partial** (not 22/8).

## Register

| ID | Pri | Kind | Area | Finding | Acceptance | Evidence | Later remediation (not this phase) |
|----|-----|------|------|---------|------------|----------|--------------------------------------|
| COR-SEC-01 | P0 | security | Admin login | Public `/admin/login` can render bootstrap credential hints | Tracked issue | `issues.json`; `admin-login-root-cause.md` | Remove concrete credential rendering |
| COR-01 | P0 | provider | J15 payout | Simulated release ≠ provider payout | J15 **Partial** | r36 J15; PL-01 | Prove Connect/bank payout |
| COR-03 | P1 | product | J16 annual | Empty `billing.annualOffers` + no year Price | J16 year **Fail**; journey Partial | r36 J16 | Annual offer + year Price |
| COR-07 | P1 | product | J17 proration | `externalId` as `cs_test_`; empty `billing.prices` | J17 **Partial** | r36 J17 | Persist `sub_` + price IDs |
| COR-11 | P2 | product | Billing prices | Empty price IDs | Blocks J17 | `listBillingPriceIds()` | Persist Plus/Pro price IDs |
| COR-12 | P2 | product | J17 portal | No portal without customer | J17 Partial | r36 J17 | Set customer on complete |
| COR-10 | P1 | product | J28 matching fee | No `managed_intro` fee rule | J28 **Partial** | r36 J28 | Seed fee rule |
| COR-09a | P1 | ux | Admin chrome | Public nav + admin chrome | J30 Partial | vis36 | Separate admin shell |
| COR-09b | P1 | ux | Terminology | Creator vs Influencer | J30 Partial | vis35/36 | Rename copy |
| COR-18 | P1 | ux | Mobile admin accounts | Clipped overflow at 390px | J30 Partial | `j30c-admin-accounts-mob-overflow.png` | Responsive admin nav/table |
| COR-13 | P2 | product | J03 shortlist | Demo directory; no Shortlist CTA | J03 Partial | `j03p1-*` | Live profiles + CTA |
| COR-14 | P2 | audit-label | J25 mutate | Prior SQL mutate ≠ admin Edit UI | J25 Partial | `j25p1-*` | Prove Edit save UI |
| COR-15 | P2 | harness | J27 jobs/CMS | banners/homepage Save ok; Retry blocked; cms/content 404 | J27 Partial | `j27c-*` | Failed-job fixture |
| COR-16 | P2 | audit-label | J30 | Coverage ≠ acceptance for visual Failures | J30 Partial | visual-review | Fix then retest |
| COR-04 | P3 | product | J18 annual Apply | Annual codes gated by COR-03 | **Preserved** — monthly J18 Pass; annual still Fail | `j18c-annual-apply.png` | Unlock annual first |
| COR-08 | — | **closed** | J20 | Influrios UI quote→pay→invoice completed; reconcile 2900/−435/+203=2668 | J20 **Pass** | `j18-j20-complete-results.json`; `j20-invoice-*` | — |
| COR-19 | — | **closed** | J18 redemption | Monthly discounted pay + reservation consumed | J18 **Pass** (monthly) | `j18-j20-postpay-probe.json` | Annual remains COR-04 |
| COR-17 | P3 | test-exec | Hosted Checkout headless | Card accordion unreliable headless | computerUse used | PL-03 | Harness note |
| **COR-20** | **P1** | product/ux | Deliverables | Submit/revise/file errors `fail()` → `/payments` (Collaboration payments); closes milestone popup; inputs lost | Track deliverable error UX; J14 note Pass retained | `payments/actions.ts` `fail()`; pack `addenda/COR-20-*.md`; `j14r35-creator-submit-open.png` | Stay in popup; inline error; preserve inputs; Retry; navigate only on explicit action |
| **COR-21** | **P1** | product/ux | Deliverables | File upload path incomplete/broken UX — select→progress→persist→submit→reopen→business download unproven; failure/retry/remove thin | Track file path; do not treat J14 as file Pass | Attach control in j14 screenshot; no file assert in r35; `deliverable-files.ts`; pack `addenda/COR-21-*.md` | Full path + unsupported/oversize/session failure boards |
| **COR-22** | **P1** | product/ux | Deliverables | Link must literally start with `https://`; bare domains rejected; no normalize | Track link UX | `milestone-delivery.ts` `LINK`; `payment-route.test.ts`; pack `addenda/COR-22-*.md` | Accept bare domain; normalize to https://; reject unsafe inline |
| **COR-23** | **P2** | audit-label | J14 review UI | Business revise/approve **UI** not exercised (`uiRevise=false`, `uiApprove=false`); lib path used | J14 note Pass retained; UI review = gap | `local-journey-r35-results.json` J14 actual | Prove Request changes + Approve in popup |
| **COR-24** | **P2** | product | Billing history | In-app invoice / receipt download not proven on billing history | R2 acceptance gap | Spec §1; j18j20 billing screenshot | Add View invoice / Download PDF actions + retest |
| **COR-25** | **P2** | evidence | Messages | Reply flow still evidence-gap | Partial / gap | MSG-REPLY-001; Spec §12 | Both-party send/reply + attachment failure/retry |

## Retained Pass

J01–J02, J04–J14 (note-based deliverable branch), J18 (monthly), J19–J20, J21–J24, J26, J29 — see journey results JSON files.  
**Do not** imply J14 proved file upload, bare-link accept, or in-popup error recovery.

## Pack pointers (store; design expansion)

- `/cursor/stores/self/docs/remediation-pack/README.md` — IN SCOPE answer  
- `/cursor/stores/self/docs/remediation-pack/ADDENDUM-v1.1-deliverables.md`  
- `/cursor/stores/self/docs/remediation-pack/addenda/deliverables-coverage-gap-matrix.md`  
- `/cursor/stores/self/docs/remediation-pack/addenda/COR-20-error-stay-in-milestone-popup.md`  
- `/cursor/stores/self/docs/remediation-pack/addenda/COR-21-file-upload-path.md`  
- `/cursor/stores/self/docs/remediation-pack/addenda/COR-22-link-normalize.md`
