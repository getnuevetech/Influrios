# Coverage (revision r3.3 — non-funding continuation)

**Verdict: Audit incomplete with remaining blockers** — Stripe test secrets present on fresh boot. Collaboration card funding still product-gated (`collaborationCollectionGate`). Non-funding journeys J18/J19/J22 executed; Partials deepened without inflating Pass.

**Route-open Pass ≠ journey Pass.** Completed journeys below are dual-account / DB / Mailpit evidenced on `http://127.0.0.1:3000` + Mailpit + Postgres `influrios_audit`.

## Denominators

| Bucket | Count | Notes |
|--------|------:|-------|
| All result rows | 190+ | inventory + journey + visual + r3.3 deepen |
| Journey-kind rows | 55+ | includes public stubs + local |
| Local dedicated journey Passes (completion) | 17 | strict (prior 15 + J19 + J22) |
| Required journeys J01–J30 | 30 | see matrix |

## Completed journeys (local-dedicated, dual-party / DB / Mailpit)

- **J01–J12, J23** — prior local evidence retained
- **J19** — Tax rule saved via admin UI (`TaxPolicyVersion` `US · All subscription plans · 8.25%`, rateBps=825); screenshots `j19c-*`; launch approvals mutated
- **J22** — Dual-party messages: business + influencer on draft contract; DB +2 `ContractMessage`; Mailpit Δ+2; unrelated denied

## Partial (deepened, not inflated)

- **J18** — DiscountOffer create/activate + server eligibility (month blocked / year allowed / expired blocked; quote 3420¢) — Checkout Apply UI unreachable
- **J03** — Shortlist mutate DB row for `audit-r3mrvlgh-a`
- **J21** — Workspace + shortlist entity reconcile
- **J24–J30** — Denial / admin mutate-light / matching intro / independent visual+a11y — still Partial

## Blocked / missing resources (exact) — r3.3

| ID | Missing resource | Attempted resolution | Smallest Ola action |
|----|------------------|----------------------|---------------------|
| J13 | Proven Stripe allocated-funds / Treasury capability (or product decision to allow ordinary card deposit) | Secrets present; dual-party `awaiting_provider` seeded; `startFundingDeposit(card)` hits hardcoded `collaborationCollectionGate(false,false)` | **Product decision** — audit will **not** silent-fix |
| J14 | Funded collaboration after J13 | Upstream blocked | Unblock J13 |
| J15 | Funded (`held`) collaboration after J13 | Upstream blocked | Unblock J13 then hold → approve → `payout.released` |
| J17 | Funded deal for retry/failure money paths | Upstream J13 | Unblock J13 |
| J20 | Payout/withdrawal after funded deal | Upstream J13 | Unblock J13 |
| J16 | Headless completion of Stripe hosted Checkout card form | `cs_test_` + sandbox UI; API related proof | Optional headed confirm / accept Partial |

## J01–J30 matrix

| ID | Status | Notes |
|----|--------|-------|
| J01 | Pass | signup + Mailpit |
| J02 | Pass | admin reconfirm |
| J03 | Partial | shortlist mutate + discover inventory |
| J04 | Pass | briefs |
| J05 | Pass | applications |
| J06 | Pass | active/signed |
| J07 | Pass | draft delete |
| J08 | Pass | withdraw |
| J09 | Pass | signed delete blocked |
| J10 | Pass | contract send |
| J11 | Pass | dual sign |
| J12 | Pass | signed status |
| J13 | Blocked | product `collaborationCollectionGate` — await Ola |
| J14 | Blocked | depends on J13 |
| J15 | Blocked | upstream J13 |
| J16 | Partial | Checkout open; card confirm incomplete |
| J17 | Blocked | needs funded deal |
| J18 | Partial | admin+server eligibility; Checkout Apply UI blocked |
| J19 | Pass | tax UI save + launch approvals |
| J20 | Blocked | needs payout after J13 |
| J21 | Partial | business shell + entity |
| J22 | Pass | dual-party messages + Mailpit + denial |
| J23 | Pass | Mailpit |
| J24 | Partial | denial samples |
| J25 | Partial | accounts phone mutate (DB) |
| J26 | Partial | plans inventory |
| J27 | Partial | jobs/CMS inventory |
| J28 | Partial | ManagedIntro create (draft) |
| J29 | Partial | public visual |
| J30 | Partial | visual/a11y smoke |
| AGENCY | N/A | Deferred |

## Status counts (matrix)

- Pass: **14**
- Partial: **11**
- Blocked: **5** (J13/J14/J15/J17/J20 — all funding-dependent; gate not silent-fixed)
