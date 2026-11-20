# Full-platform audit — Influrios

**Phase:** A complete. Phase B + IPS-25 matrix chase complete (**0 Not tested**); **not** platform-wide complete (17 Fail / 162 Blocked). Phase C remediation plan (IPS-20) is **provisional** until Ola endorses this GitHub evidence package.  
**Review surface:** this tree on GitHub (store mirror may remain).  
**Coverage status (user-facing):** [coverage-status.md](./coverage-status.md) — completed coverage, Fail list (17), retests (#536), Blocked (162); Not tested = 0 after IPS-25.  
**Evidence INDEX:** [media/INDEX.md](./media/INDEX.md) — 434 committed screenshots / logs / exports under `media/`.  
**NT chase:** [execution/not-tested-chase-results.md](./execution/not-tested-chase-results.md) (IPS-25 complete).  
**Remediation plan (provisional):** [remediation-plan.md](./remediation-plan.md) — **17 Fail → 8 root causes** (incl. **RC-JOBS** INV-J-020/021 + cron stale-alert effects); blocked deps mapped; each Fail has evidence / flow / design / scope / acceptance. **Not** remediated; no new product PRs from this plan.  
**Blocked register:** [blocked-register.md](./blocked-register.md) — all **162** Blocked rows + Mailpit/`MAIL_SINK` restore (supersedes standalone #538).  
**Code baseline:** package on `main` @ `5a5f4c0` (#536 + merged #537); execution evidence @ live `40b6288` (pre–#537 deploy; live redeploy + rotation unconfirmed).  
**Constraints:** Live collaboration deposits closed (`journey_funding`). Agency product deferred. Docs/evidence only — no product behavior changes. No platform-wide completion language.  
**Prior evidence retained:** [docs/e2e-audit/](../e2e-audit/), [docs/remediation-pack/](../remediation-pack/). Historical freeze `db64224` is not complete platform coverage.

## Deliverables

| Doc | Purpose |
|-----|---------|
| [coverage-status.md](./coverage-status.md) | **IPS-26** coverage completion status: tested / Fail / retests / unresolved limitations |
| [**remediation-plan.md**](./remediation-plan.md) | **IPS-20 provisional** plan: 17 Fail + blocked deps → evidence, flow, d/m design, scope, acceptance (commit via Audit package GitHub worker) |
| [inventory.md](./inventory.md) | Every route, menu, tab, popup, form/action, job, notification, integration, downloadable (incl. hidden/conditional) |
| [process-map.md](./process-map.md) | End-to-end processes: roles → prerequisites → actions → records → notifications → destinations → terminal outcomes |
| [coverage-matrix.md](./coverage-matrix.md) | IPS-19 row statuses (Pass / Fail / Blocked / Not tested / Explicitly deferred) |
| [**blocked-register.md**](./blocked-register.md) | **IPS-28** all **162** Blocked rows: blocker, journey, owner, prerequisite, safe method, acceptance; Mailpit/`MAIL_SINK` restore |
| [media/INDEX.md](./media/INDEX.md) | Evidence catalog → committed paths under `media/{admin,auth,billing,collab,nt-chase}/` |
| [execution/](./execution/) | Slice results: auth, collab, billing, admin, [not-tested-chase-results.md](./execution/not-tested-chase-results.md) |

## Counts (matrix post IPS-25 — coverage-status refresh)

| Metric | Count |
|--------|------:|
| Matrix rows | 476 |
| Pass | 287 |
| Fail | 17 *(incl. INV-J-020/021)* |
| Blocked | 162 |
| Not tested | **0** *(IPS-25 complete)* |
| Explicitly deferred (Agency) | 10 |
| Page routes (`src/app/**/page.tsx`) | 128 |
| Mapped processes (P-01…P-28) | 28 |
| Admin config sub-workflows (P-27a…x) | 24 |
| Email catalog templates (INV-E-*) | 79 |

Phase A seed baseline (historical): 465 Not tested / 11 Explicitly deferred before Phase B execution. Pre–IPS-25 execution snapshot: Pass 233 / Fail 15 / Blocked 129 / Not tested 89.

## Method

- Primary: live codebase on `main` (routes, nav constants, server actions, jobs, webhooks, email catalog, product switches).
- Phase B: live https://influrios.com against AUDIT fixtures; desktop + mobile where required; no live deposits opened.
- Cross-check: prior [route-inventory.csv](../e2e-audit/route-inventory.csv), [action-inventory.csv](../e2e-audit/action-inventory.csv), [navigation-map.md](../ux-design-package/navigation-map.md).

## Tracker

- IPS-18 — inventory + process map (complete)
- IPS-19 — matrix execution (slices + IPS-25 NT chase; Not tested = 0; Fail/Blocked remain)
- IPS-25 — chase remaining Not tested (**complete** — [not-tested-chase-results.md](./execution/not-tested-chase-results.md))
- IPS-26 — coverage completion status ([coverage-status.md](./coverage-status.md); refreshed post IPS-25)
- IPS-20 — [provisional remediation plan](./remediation-plan.md) (Phase C; provisional until GitHub evidence package; no new product PRs)
- IPS-28 — [blocked-check register](./blocked-register.md) (162 Blocked; Mailpit/`MAIL_SINK` restore; no live deposits to clear counts)
- COR-SEC-01 — [#537](https://github.com/getnuevetech/Influrios/pull/537) **merged** `5a5f4c0`; live redeploy + rotation still open
- Audit package GitHub — commit **this** plan revision with matrix/status/execution/media + blocked-register

## Status language

Do **not** describe the platform as fully audited, fully remediated, or platform-wide complete while Fail or Blocked rows remain (Not tested is now 0). Prior Pass/Partial journey results remain evidence under `docs/e2e-audit/` and do not close this reopen. See [coverage-status.md](./coverage-status.md). The remediation plan is **provisional** and does **not** authorize new product implementation by itself.
