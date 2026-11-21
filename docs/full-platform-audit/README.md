# Full-platform audit — Influrios

**Phase:** A complete. Phase B + IPS-25 + **IPS-29** dashboard consistency + **IPS-30** Pass acceptance corrections. **Not** platform-wide complete (**24 Fail** / **165 Blocked** / **9 Not tested**). Phase C remediation plan (IPS-20) remains **PROVISIONAL**.  
**Coverage status (user-facing):** [coverage-status.md](./coverage-status.md) — completed coverage, Fail list (24), retests (#536), Blocked (165), reopened Not tested (9 after IPS-30).  
**NT chase:** [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md) (IPS-25).  
**Dashboard consistency:** [execution/dashboard-consistency-results.md](./execution/dashboard-consistency-results.md) (IPS-29 · INV-DC-* · **RC-DASHBOARD**).  
**Remediation plan (provisional):** [remediation-plan.md](./remediation-plan.md) — **24 Fail → 9 root causes** (incl. **RC-JOBS**, **RC-DASHBOARD**); blocked deps mapped; each Fail has evidence / flow / design / scope / acceptance. **Not** remediated; no new product PRs from this plan.  
**Code baseline:** execution evidence @ live `40b6288` (#536); #537 COR-SEC-01 **merged** `5a5f4c0` (live redeploy + rotation unconfirmed — RC-SEC stays open).  
**Constraints:** Live collaboration deposits closed (`journey_funding`). Agency product deferred. No platform-wide completion language. Do **not** preserve prior **287** / **296** Pass aggregates where evidence was visibility-only.  
**Prior evidence retained:** [docs/e2e-audit/](../e2e-audit/), [docs/remediation-pack/](../remediation-pack/). Historical freeze `db64224` is not complete platform coverage.

## Deliverables

| Doc | Purpose |
|-----|---------|
| [coverage-status.md](./coverage-status.md) | **IPS-26** (+ IPS-29/30 refresh): tested / Fail / retests / unresolved limitations + **Acceptance criteria** |
| [**remediation-plan.md**](./remediation-plan.md) | **IPS-20 provisional** plan: 24 Fail + blocked deps → evidence, flow, d/m design, scope, acceptance |
| [inventory.md](./inventory.md) | Every route, menu, tab, popup, form/action, job, notification, integration, downloadable (incl. hidden/conditional) |
| [process-map.md](./process-map.md) | End-to-end processes: roles → prerequisites → actions → records → notifications → destinations → terminal outcomes |
| [coverage-matrix.md](./coverage-matrix.md) | IPS-19 row statuses (Pass / Fail / Blocked / Not tested / Explicitly deferred) |
| [**blocked-register.md**](./blocked-register.md) | **IPS-28** Blocked rows: blocker, journey, owner, prerequisite, safe method, acceptance; Mailpit/`MAIL_SINK` restore |
| [execution/](./execution/) | Slice results: auth, collab, billing, admin, nt-chase, [dashboard-consistency-results.md](./execution/dashboard-consistency-results.md) |
| [media/INDEX.md](./media/INDEX.md) | Evidence catalog (incl. `dashboard-consistency/`) |

## Counts (matrix post IPS-29 + IPS-30)

| Metric | Count |
|--------|------:|
| Matrix rows | 493 |
| Pass | **285** |
| Fail | **24** *(17 prior + 5 INV-DC-* + INV-C-014 + INV-N-004)* |
| Blocked | 165 |
| Not tested | **9** *(IPS-30 reopened visibility-only / listing-only rows)* |
| Explicitly deferred (Agency) | 10 |
| Page routes (`src/app/**/page.tsx`) | 128 |
| Mapped processes (P-01…P-28) | 28 |
| Admin config sub-workflows (P-27a…x) | 24 |
| Email catalog templates (INV-E-*) | 79 |

**IPS-30 demotions from Pass:** INV-C-014, INV-N-004 → **Fail**; INV-A-008, INV-A-019, INV-A-027, INV-D-007, INV-J-006, INV-J-010, INV-J-011, INV-J-015, INV-J-017 → **Not tested**. Prior **287** / post–IPS-29 **296** Pass counts are superseded.

Phase A seed baseline (historical): 465 Not tested / 11 Explicitly deferred before Phase B execution. Pre–IPS-25 execution snapshot: Pass 233 / Fail 15 / Blocked 129 / Not tested 89.

## Method

- Primary: live codebase on `main` (routes, nav constants, server actions, jobs, webhooks, email catalog, product switches).
- Phase B: live https://influrios.com against AUDIT fixtures; desktop + mobile where required; no live deposits opened.
- Cross-check: prior [route-inventory.csv](../e2e-audit/route-inventory.csv), [action-inventory.csv](../e2e-audit/action-inventory.csv), [navigation-map.md](../ux-design-package/navigation-map.md).
- **Pass acceptance (IPS-30):** visibility/cues alone ≠ Pass; action rows need execute→persist→inspect; annual purchase stays Fail until purchasable; cron needs scheduler + behavior proof; security steps stay separate until rotation completes.

## Tracker

- IPS-18 — inventory + process map (complete)
- IPS-19 — matrix execution (slices + IPS-25 NT chase + IPS-29 DC + IPS-30 corrections)
- IPS-25 — chase remaining Not tested ([not-tested-chase-results.md](./execution/not-tested-chase-results.md)); IPS-30 reopened 9 visibility/listing rows
- IPS-26 — coverage completion status ([coverage-status.md](./coverage-status.md); refreshed post IPS-29/30)
- IPS-20 — [provisional remediation plan](./remediation-plan.md) (Phase C; **PROVISIONAL**; no new product PRs)
- IPS-28 — [blocked-check register](./blocked-register.md) (Blocked; Mailpit/`MAIL_SINK` restore; no live deposits to clear counts)
- IPS-29 — dashboard consistency ([dashboard-consistency-results.md](./execution/dashboard-consistency-results.md); **RC-DASHBOARD**)
- IPS-30 — Pass acceptance corrections (this revision)
- COR-SEC-01 — [#537](https://github.com/getnuevetech/Influrios/pull/537) **merged** `5a5f4c0`; live redeploy + rotation still open
- Audit package GitHub — [#539](https://github.com/getnuevetech/Influrios/pull/539)

## Status language

Do **not** describe the platform as fully audited, fully remediated, or platform-wide complete while Fail, Blocked, or Not tested rows remain. Prior Pass/Partial journey results remain evidence under `docs/e2e-audit/` and do not close this reopen. See [coverage-status.md](./coverage-status.md). The remediation plan is **provisional** and does **not** authorize new product implementation by itself. Live deposits stay closed.
