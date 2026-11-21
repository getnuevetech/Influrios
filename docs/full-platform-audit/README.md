# Full-platform audit — Influrios

**Phase:** A complete. Phase B + IPS-25 + IPS-29 + IPS-30 + IPS-31/40 + **IPS-42 evidence reconcile** + **IPS-43 hidden-gap split**. **Not** platform-wide complete (**39 Fail** / **57 Blocked** / **0 Not tested** / **396 Pass** (IPS-45)). Phase C remediation plan (IPS-20) remains **PROVISIONAL**.  
**Coverage status (user-facing):** [coverage-status.md](./coverage-status.md) — Fail (24), Blocked (80), Not tested (1), Pass (378); IPS-30 acceptance + IPS-31/40 Mailpit + IPS-42 reconcile.  
**NT chase:** [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md) (IPS-25).  
**Dashboard consistency:** [execution/dashboard-consistency-results.md](./execution/dashboard-consistency-results.md) (IPS-29 · INV-DC-* · **RC-DASHBOARD**).  
**Mail-sink restore:** [execution/mail-sink-restore-results.md](./execution/mail-sink-restore-results.md) (IPS-31 · isolated Mailpit; deposit+mail rows stay Blocked).  
**IPS-45 round 2 (37 remaining ready rows):** [execution/r5-isolated-round2-results.md](./execution/r5-isolated-round2-results.md)  
**IPS-44 results (10 Package 1 checks, isolated host):** [execution/r5-isolated-package1-results.md](./execution/r5-isolated-package1-results.md)  
**Runner handoff (every open check → runner + next action):** [check-handoff.md](./check-handoff.md)  
**Latest open-items summary:** [coverage-blocker-report.md](./coverage-blocker-report.md) (Fail / Blocked / Not tested / hidden partials).  
**Audit-continue + reconcile:** [execution/audit-continue-alongside-design-results.md](./execution/audit-continue-alongside-design-results.md) (IPS-40/42).  
**Remediation plan (provisional):** [remediation-plan.md](./remediation-plan.md) — **24 Fail → 9 root causes** (incl. **RC-JOBS**, **RC-DASHBOARD**); blocked deps mapped. **Not** remediated; no new product PRs from this plan.  
**Code baseline:** execution evidence @ live `40b6288` (#536); #537 COR-SEC-01 **merged** `5a5f4c0` (live redeploy + rotation unconfirmed — RC-SEC stays open). IPS-31/40 mail proof on isolated local host.  
**Constraints:** Live collaboration deposits closed (`journey_funding`). Agency product deferred. No platform-wide completion language. Do **not** mark deposit+mail rows Pass. Do **not** endorse blanket IPS-40 24/24 Pass. Prior **287** / **296** / **285** / **355** / **379** Pass aggregates are superseded.  
**Prior evidence retained:** [docs/e2e-audit/](../e2e-audit/), [docs/remediation-pack/](../remediation-pack/). Historical freeze `db64224` is not complete platform coverage.

## Deliverables

| Doc | Purpose |
|-----|---------|
| [coverage-status.md](./coverage-status.md) | **IPS-26** (+ IPS-29/30/31/40/42): tested / Fail / retests / unresolved limitations + **Acceptance criteria** |
| [**remediation-plan.md**](./remediation-plan.md) | **IPS-20 provisional** plan: 24 Fail + blocked deps → evidence, flow, d/m design, scope, acceptance |
| [inventory.md](./inventory.md) | Every route, menu, tab, popup, form/action, job, notification, integration, downloadable (incl. hidden/conditional) |
| [process-map.md](./process-map.md) | End-to-end processes: roles → prerequisites → actions → records → notifications → destinations → terminal outcomes |
| [coverage-matrix.md](./coverage-matrix.md) | IPS-19 row statuses (Pass / Fail / Blocked / Not tested / Explicitly deferred) |
| [**blocked-register.md**](./blocked-register.md) | **IPS-28** Blocked rows (**80** after IPS-40); Mailpit/`MAIL_SINK` restore |
| [execution/](./execution/) | Slice results: auth, collab, billing, admin, nt-chase, dashboard-consistency, [mail-sink-restore-results.md](./execution/mail-sink-restore-results.md), [audit-continue-alongside-design-results.md](./execution/audit-continue-alongside-design-results.md) |
| [media/INDEX.md](./media/INDEX.md) | Evidence catalog (incl. `dashboard-consistency/`, `mail-sink/`, `audit-continue/`) |

## Counts (matrix post IPS-45 isolated round 2)

| Metric | Count |
|--------|------:|
| Matrix rows | 502 |
| Pass | **396** |
| Fail | **39** *(24 + IPS-44: 5 + IPS-45: 10)* |
| Blocked | **57** |
| Not tested | **0** |
| Explicitly deferred (Agency) | 10 |
| Page routes (`src/app/**/page.tsx`) | 128 |
| Mapped processes (P-01…P-28) | 28 |
| Admin config sub-workflows (P-27a…x) | 24 |
| Email catalog templates (INV-E-*) | 79 |

**IPS-30 demotions from Pass:** INV-C-014, INV-N-004 → **Fail**; INV-A-008, INV-A-019, INV-A-027, INV-D-007, INV-J-006, INV-J-010, INV-J-011, INV-J-015, INV-J-017 → **Not tested** (later partially re-cleared).  
**IPS-31 mail-sink:** +70 Pass / −70 Blocked (isolated Mailpit). Deposit+mail rows remain Blocked.  
**IPS-40 audit-continue:** claim draft + notify isolation + demoted NT actions/jobs (pre-reconcile 379 Pass / 0 NT).  
**IPS-42 reconcile:** INV-J-010 → **Not tested**; INV-D-007 View Pass / Export NT; INV-N-010…017/027 Pass narrowed to delivery isolation. Prior **287** / **296** / **285** / **355** / **379** Pass counts are superseded.

Phase A seed baseline (historical): 465 Not tested / 11 Explicitly deferred before Phase B execution. Pre–IPS-25 execution snapshot: Pass 233 / Fail 15 / Blocked 129 / Not tested 89.

## Method

- Primary: live codebase on `main` (routes, nav constants, server actions, jobs, webhooks, email catalog, product switches).
- Phase B: live https://influrios.com against AUDIT fixtures; desktop + mobile where required; no live deposits opened.
- **IPS-31/40:** isolated local Mailpit + local app for sink interception (not live host Mailpit UI).
- Cross-check: prior [route-inventory.csv](../e2e-audit/route-inventory.csv), [action-inventory.csv](../e2e-audit/action-inventory.csv), [navigation-map.md](../ux-design-package/navigation-map.md).
- **Pass acceptance (IPS-30):** visibility/cues alone ≠ Pass; action rows need execute→persist→inspect; annual purchase stays Fail until purchasable; cron needs scheduler + behavior proof; security steps stay separate until rotation completes.
- **IPS-42:** empty auto-approval sweep ≠ behavior Pass; media-kit View ≠ Export; direct notify invoke ≠ originating business-action emission.

## Tracker

- IPS-18 — inventory + process map (complete)
- IPS-19 — matrix execution (slices + IPS-25 NT chase + IPS-29 DC + IPS-30 corrections + IPS-31 mail-sink + IPS-40/42)
- IPS-25 — chase remaining Not tested ([not-tested-chase-results.md](./execution/not-tested-chase-results.md)); IPS-30 reopened 9 visibility/listing rows
- IPS-26 — coverage completion status ([coverage-status.md](./coverage-status.md); refreshed post IPS-42)
- IPS-20 — [provisional remediation plan](./remediation-plan.md) (Phase C; **PROVISIONAL**; no new product PRs)
- IPS-28 — [blocked-check register](./blocked-register.md) (**80** Blocked after IPS-40; no live deposits to clear counts)
- IPS-29 — dashboard consistency ([dashboard-consistency-results.md](./execution/dashboard-consistency-results.md); **RC-DASHBOARD**)
- IPS-30 — Pass acceptance corrections
- IPS-31 — mail-sink restore ([mail-sink-restore-results.md](./execution/mail-sink-restore-results.md))
- IPS-40 — audit-continue ([audit-continue-alongside-design-results.md](./execution/audit-continue-alongside-design-results.md))
- IPS-42 — evidence reconcile (INV-J-010 / INV-D-007 / INV-N-* scope)
- COR-SEC-01 — [#537](https://github.com/getnuevetech/Influrios/pull/537) **merged** `5a5f4c0`; live redeploy + rotation still open
- Audit package GitHub — [#539](https://github.com/getnuevetech/Influrios/pull/539)

## Status language

Do **not** describe the platform as fully audited, fully remediated, or platform-wide complete while Fail, Blocked, or Not tested rows remain. Prior Pass/Partial journey results remain evidence under `docs/e2e-audit/` and do not close this reopen. See [coverage-status.md](./coverage-status.md). The remediation plan is **provisional** and does **not** authorize new product implementation by itself. Live deposits stay closed. Design Package 1 PR is **not** held for this reconcile.
