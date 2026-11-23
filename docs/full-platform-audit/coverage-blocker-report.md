# Coverage & blocker report — reconciled

> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

**Status:** PROVISIONAL. Not platform-wide completion. No audit restart.
**As of:** 2026-11-21 · matrix after IPS-48 (Package 1 S1 + S2 retests) · **reconciled:** every count below is recomputed from [coverage-matrix.md](./coverage-matrix.md) and cross-checked against [blocked-register.md](./blocked-register.md) (54 = 54).
**Host:** influrios.com (earlier phases) + local isolated r5 host (IPS-44/45/46 on `main` @ `5a5f4c0`; IPS-47 on S1 code `claude/vigilant-darwin-h4tha4` @ `bd65bb9`; IPS-48 on S2 code `claude/vigilant-darwin-h4tha4-s2` @ `d57e2fa`) · live collaboration deposits **closed** · Agency deferred

## 1. Matrix position

| Status | Rows |
|--------|-----:|
| Pass | 403 |
| **Fail** | **35** |
| **Blocked** | **54** |
| Not tested | 0 |
| Explicitly deferred | 10 |
| **Total** | **502** |

**Open = 89 rows** (35 Fail + 54 Blocked). Run evidence: [IPS-44](./execution/r5-isolated-package1-results.md) · [IPS-45](./execution/r5-isolated-round2-results.md) · [IPS-46](./execution/r5-isolated-round3-results.md) · [IPS-47 S1](./execution/r5-isolated-s1-results.md) · [IPS-48 S2](./execution/r5-isolated-s2-results.md).

## 2. Fail rows (35) → root cause → owning package

| Root cause | Owner | Rows | IDs |
|------------|-------|-----:|-----|
| RC-SEC | R0 | 1 | INV-R-074 |
| RC-CATALOG | Pkg 3 | 4 | INV-R-006, INV-A-070, INV-A-072, INV-A-073 |
| RC-PORTAL | Pkg 3 | 2 | INV-A-074, INV-C-004 |
| RC-INVOICE | Pkg 3 | 1 | INV-D-006 |
| Fee label / discount (AUD-FEE-01) | Pkg 3 + Pkg 4 | 1 | INV-A-053 |
| RC-DISCOVERY | Pkg 4 | 3 | INV-P-001, INV-A-035, INV-C-008 |
| Media kit export (AUD-R2-04) | Pkg 4 | 1 | INV-D-007E |
| RC-DASHBOARD + P1-AUD (invitations, notices, counts) | **Pkg 1** | 7 | INV-DC-002, INV-DC-006, INV-DC-012, INV-C-014, INV-N-004, INV-N-015T, INV-N-017T |
| Unreachable actions (AUD-R2-01a/b/d) | Pkg 2 | 6 | INV-A-034, INV-A-036, INV-A-037, INV-A-042, INV-A-065, INV-A-069 |
| No cancellation entry (AUD-R2-03) | Pkg 2 + R6 | 1 | INV-A-066 |
| Dispute entry / evidence (AUD-R2-01c) | Pkg 5 + R6 | 2 | INV-A-064, INV-A-079 |
| RC-MAIL | Pkg 5 | 1 | INV-R-119 |
| RC-JOBS | Pkg 5 | 2 | INV-J-020, INV-J-021 |
| RC-EXPORT | Pkg 5 | 3 | INV-D-003, INV-I-014, INV-A-102 |

Owners and defect IDs match the remediation-plan defect register. No Fail is closed by design work; only an implementation retest closes it. IPS-47 closed INV-DC-001 and INV-DC-015 (S1 code); IPS-48 closed INV-DC-013, INV-DC-014 and INV-A-048 (S2 code). Neither branch is merged yet.

## 3. Blocked rows (54) by real gate

Provider-credential blockers are kept separate from money-path blockers.

| Gate | Rows | What unblocks it | IDs |
|------|-----:|------------------|-----|
| Live deposits closed — funding creation / deposit | 10 | Deposits stay closed. Retest only after an approved sandbox funding path | INV-R-030, INV-A-052, INV-A-055, INV-A-056, INV-A-057, INV-A-062, INV-A-063, INV-N-010T, INV-N-011T, INV-N-012T |
| R6 release / payout / refund (provider movement) | 27 | Separate R6 approval + provider sandbox; MS1–MS8 apply | INV-A-061, INV-A-067, INV-A-068, INV-J-014, INV-N-016T, INV-N-018, INV-N-019, INV-N-020, INV-N-021, INV-N-022, INV-N-027T, INV-N-028, INV-P-012, INV-E-042, INV-E-043, INV-E-044, INV-E-045, INV-E-046, INV-E-047, INV-E-048, INV-E-049, INV-E-050, INV-E-051, INV-E-052, INV-E-063, INV-E-064, INV-E-065 |
| Dispute / ops / ledger event fixture | 10 | Isolated fixture that emits the event (no live money) | INV-N-023, INV-N-024, INV-N-025, INV-N-026, INV-N-029, INV-N-030, INV-N-031, INV-N-032, INV-N-033, INV-N-034 |
| Provider credentials (kept separate) | 7 | AI provider key (P-004, A-054) · Meta OAuth test app (I-004, I-005) · SMS sandbox (N-103) · Stripe test subscription / Plus plan (R-065, J-022) | INV-P-004, INV-A-054, INV-I-004, INV-I-005, INV-N-103, INV-R-065, INV-J-022 |

None of these may become Pass by reopening live deposits.

## 4. Not tested

0. INV-J-010, INV-D-007E and the IPS-43 trigger rows were executed in IPS-44/45.

## 5. Corrections made while reconciling

| Was | Now |
|-----|-----|
| §2 said 24 Fail rows across 9 root causes | 40 rows at reconciliation, 38 after IPS-47, 35 after IPS-48, grouped above |
| §3 listed INV-D-007E as Not tested | Fail (IPS-45: no export) |
| §5 said 84 Blocked with fixture clusters (UI_FIXTURE_GAP 20, DASHBOARD_CONSISTENCY_FIXTURE 3, TOKEN_FIXTURE 1 …) | 54 Blocked grouped by the gate actually blocking them; former fixture rows either ran (IPS-44/45/46) or are now known to wait on deposits, R6 or provider credentials |
| Earlier INV-C-013 Pass had no published contrast | Replaced by the IPS-46 contrast test |
| Historical notes about “95 Blocked” / “NT cleared” | Superseded by this page |

## 6. Who runs what next

Isolated-host retests follow the Package 1 implementation slices (#540 `SUBMISSION.md`) after Ola's visual approval. Gated rows wait for their gate (table §3). Handoff detail: [check-handoff.md](./check-handoff.md).

## 7. What this report does not claim

- That the platform is fully audited or remediated
- That design work closes any Fail
- That Blocked rows can become Pass without their gate
- That live deposits should be reopened to clear counts
- That MS1–MS8 (milestone release, both the influencer payment and its platform-fee movement) are satisfied: they remain **open** payment acceptance requirements
