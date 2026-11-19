# Final coverage report — Phase 1 (#534)

**Revision:** phase-1-corrective · **Commit target:** audit pack on `cursor/e2e-audit-pack-2097`  
**Scope:** Finish missing audit coverage, correct overstated Passes, consolidate findings. **No remediation PRs.** Agency deferred.

## How to read this report

| Lens | Meaning |
|------|---------|
| **Coverage** | Was the journey exercised with retained evidence? `Complete` / `Incomplete` |
| **Acceptance** | Product-acceptance result against original criteria: `Pass` / `Fail` / `Partial` / `Untestable*` |
| **\*** Untestable | Only when blocked by **provider dependency** documented in `provider-limitations.md` (not used as a soft Fail dump) |

An audit **may conclude** with documented product Failures. What still blocks *acceptance of the audit pack* is **incomplete coverage** or **unsupported Pass labels** — not merely missing payout.

---

## Executive counts (J01–J30)

| Acceptance | Count | IDs |
|------------|------:|-----|
| Pass | **22** | J01, J02, J04–J14, J18–J20, J21–J24, J26, J29 |
| Fail (product) | **0 whole-journey** | J16 **year** step Fail (journey overall Partial) |
| Partial | **8** | J03, J15, J16, J17, J25, J27, J28, J30 |
| Untestable (provider-only) | **0** | J15 remains Partial with PL-01 dependency (not Untestable — simulation path was exercised) |
| Coverage Incomplete | **0** | All J01–J30 have an evidence row; thin areas demoted rather than left as unsupported Pass |

**Prior overstated matrix claimed Pass 26.** Phase 1 demotes J03, J25, J27, J30 → **Pass 22 / Partial 8**.

---

## Demotions (unsupported or thin Pass → corrected)

| ID | Was | Now | Reason |
|----|-----|-----|--------|
| J03 | Pass | **Partial** | Discover/card evidenced; shortlist UI absent on demo directory (“cannot be booked”); prior shortlist was DB insert | COR-13 |
| J25 | Pass | **Partial** | Accounts inventory + View dialog evidenced; editable phone/save UI not proven (prior mutate was SQL) | COR-14 |
| J27 | Pass | **Partial** | jobs/cms/content routes open only — no publish/run | COR-15 |
| J30 | Pass | **Partial** | Coverage expanded; acceptance Fail on admin dual chrome + Creator terminology | COR-09a/b, COR-16 |
| J15 wording | “Partial forever” | **Partial** | Provider payout unproven **pending provider integration/testing** (PL-01) | COR-01 |

---

## Journey matrix (coverage × acceptance)

| ID | Coverage | Acceptance | Evidence anchors | Notes |
|----|----------|------------|------------------|-------|
| J01 | Complete | Pass | `J01-local-signup-mailpit` | |
| J02 | Complete | Pass | local login + admin reprobe | |
| J03 | Complete | **Partial** | `j03r35-*`, `j03p1-*` | Demo directory; no shortlist CTA |
| J04–J12 | Complete | Pass | `local-journey-results.json` | |
| J13 | Complete | Pass | Stripe TEST → held; `j13r34-*` | sandbox_ledger_hold label |
| J14 | Complete | Pass | `j14r35-*`; submit→revise→approve lineage | Approval ≠ payout |
| J15 | Complete | **Partial** | sim release; PL-01 | Payout unproven pending provider integration/testing |
| J16 | Complete | **Partial** | month Pass (`j16r34-*`); year Fail RCA | Annual product Fail |
| J17 | Complete | **Partial** | r36 product gaps COR-07/11/12 | Proration UI unreachable |
| J18 | Complete | **Pass** | Apply + reject + Stripe shows coupon `j18p1-us-checkout.png` | Annual Apply still gated |
| J19 | Complete | Pass | TaxPolicyVersion US 8.25% | |
| J20 | Complete | **Pass** | Pro+$tax paid; invoice tax=239; `j20r36-*` | |
| J21 | Complete | Pass | shell routes + BusinessProfile | |
| J22–J23 | Complete | Pass | dual-party + Mailpit | |
| J24 | Complete | Pass | unrelated 404; admin login gate | |
| J25 | Complete | **Partial** | inventory; UI edit not proven | COR-14 |
| J26 | Complete | Pass | EntitlementPlan catalog | |
| J27 | Complete | **Partial** | route inventory only | COR-15 |
| J28 | Complete | **Partial** | advanced to in_conversation; fee blocked | COR-10 |
| J29 | Complete | Pass | public pages captured | |
| J30 | Complete | **Partial** | vis35/vis36; checklist Fail COR-09 | |

AGENCY: **Deferred** (out of scope).

---

## Completed checks (high confidence)

- Local dedicated harness: signup/login, brief→sign, messaging/Mailpit  
- Collaboration Stripe TEST collection → funding **held** (sandbox path)  
- Deliver/revise/approve lineage with dual-party screenshots  
- Subscription month checkout (Plus) + Pro+tax invoice chain  
- Discount Apply UI through Stripe Checkout line items (Pro month)  
- Access denials, admin plan catalog, public marketing reachability  

## Reproducible failures (product)

| Failure | Repro | Result |
|---------|-------|--------|
| Annual Subscribe | `startCheckout(..., interval:"year")` | Error: annual not available; empty `billing.annualOffers`; no year Price |
| Proration preview | active Plus with stored `cs_test_` externalId | Stripe subscription read fails; empty `priceId` |
| Managed intro fee | `requestIntroFeeSettlement` after advance | “No active fee rule matched” / no `managed_intro` rule |
| Admin dual chrome | Open `/admin` | Public Discover/Pricing nav + admin sidebar |
| Creator terminology | Business/admin surfaces | “Discover Creators” / Creator categories |

## Genuinely untestable / provider-pending

| Item | Why not Pass | Classification |
|------|--------------|----------------|
| J15 bank/Connect payout | No provider payout integration exercised; only sim release | **Partial** + PL-01 (not Untestable — sim path tested) |
| Live collaboration deposits | Closed by design on non-sandbox hosts | Out of scope for this pack |

---

## What still blocks audit-pack acceptance

1. ~~Unsupported Pass labels~~ → corrected this phase (demotions above).  
2. ~~Missing coverage rows~~ → all J01–J30 have evidence; Partials named.  
3. Remaining **Partial/Fail** are **documented product/provider outcomes** — allowed for an audit conclusion.  
4. **Remediation** (annual offers, `sub_`/prices, UI/UX, managed_intro fees, Connect payout) is **Phase 2+** — focused PRs later, not this turn.

## Pack artifacts

- This report: `docs/e2e-audit/final-coverage-report.md`  
- Matrix: `docs/e2e-audit/journeys.md`  
- Register: `docs/e2e-audit/correction-register.md`  
- Provider deps: `docs/e2e-audit/provider-limitations.md`  
- Results: `local-journey-r3{4,5,6}-results.json`, `phase1-acceptance-matrix.json`  
- Media: `/cursor/stores/self/media/e2e-audit/`
