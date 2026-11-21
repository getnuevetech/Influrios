# Coverage & blocker report — latest position

**Status:** **PROVISIONAL** — not platform-wide completion. No audit restart.
**As of:** 2026-11-21 · matrix revision IPS-43 (hidden gaps split into tracked rows)
**Host:** https://influrios.com · live collaboration deposits **closed** · Agency **Explicitly deferred**
**Authoritative sources:** [coverage-matrix.md](./coverage-matrix.md) · [blocked-register.md](./blocked-register.md) · [coverage-status.md](./coverage-status.md) · [remediation-plan.md](./remediation-plan.md)

This page is the single summary of what is still open. It does not change any matrix row; counts below were recomputed directly from the matrix Status column.

---

## 1. Matrix position (recomputed)

| Status | Rows | Recomputed from matrix | Matches header |
|--------|-----:|------------------------|:--------------:|
| Pass | 378 | yes | ✅ |
| **Fail** | **24** | 24 rows with Status `Fail` | ✅ |
| **Blocked** | **84** | 84 rows with Status `Blocked` (+4 IPS-43) | ✅ |
| **Not tested** | **6** | INV-J-010, INV-D-007E, INV-N-013T/015T/016T/017T | ✅ |
| Explicitly deferred | 10 | Agency only | ✅ |
| **Total** | **502** | | ✅ |

**Open = 114 rows** (24 Fail + 84 Blocked + 6 Not tested). The former hidden partials (§4) are now counted rows.

---

## 2. Fail rows (24) → root cause → package

| Root cause | Fail rows | Remediation / design home | Gate before retest |
|------------|-----------|---------------------------|--------------------|
| RC-SEC (P0) | INV-R-074 | R0 — #537 merged `5a5f4c0` | Live redeploy **and** authorized credential/session rotation, each evidenced separately |
| RC-CATALOG | INV-R-006, INV-A-070, INV-A-072, INV-A-073 | R2 · UX Package 3 | Ola-approved annual/upgrade prices (do not invent amounts) |
| RC-PORTAL | INV-A-074, INV-C-004 | R2 · UX Package 3 | Same |
| RC-INVOICE | INV-D-006 | R2 · UX Package 3 | In-app invoice download action designed + retested |
| RC-DISCOVERY | INV-P-001, INV-A-035, INV-C-008 | R4 · UX Package 4 (card preserved) | Live profiles / `public_pages_live` decision |
| RC-MAIL | INV-R-119 | R5 · UX Package 5 | Mail failure triage surface |
| RC-JOBS | INV-J-020, INV-J-021 | R5 · UX Package 5 | Isolated cron host; scheduler **and** behaviour proven separately |
| RC-EXPORT | INV-D-003, INV-I-014, INV-A-102 | R5 · UX Package 5 | Download + file inspection |
| RC-DASHBOARD | INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-012, INV-DC-015, INV-C-014, INV-N-004 | R4b · **UX Package 1 ([#540](https://github.com/getnuevetech/Influrios/pull/540))** | Package 1 design corrections accepted → implementation → retest DB1–DB6 / MOB1 |

None of the 24 is closed. Package 1 design acceptance does **not** close RC-DASHBOARD rows; only post-implementation retest does.

---

## 3. Not tested (6)

| Row | Why | What closes it |
|-----|-----|----------------|
| INV-J-010 auto-approval sweep | IPS-42: sweep `scanned:0` / `approved:0` | Isolated due submission; sweep approves ≥1; no duplicate on rerun |
| INV-D-007E media-kit export | Split from INV-D-007 (IPS-43) | Execute export → downloaded file → contents inspected |
| INV-N-013T milestone_submitted trigger | Linked INV-A-058 proved the action, not the emitted notice | Re-run INV-A-058 fixture; inspect notice to business |
| INV-N-015T revision_requested trigger | Linked INV-A-059 | Re-run; inspect notice to influencer |
| INV-N-016T milestone_approved trigger | Linked INV-A-060 | Re-run; inspect notices |
| INV-N-017T review-period-ended trigger | Depends on INV-J-010 | Closes with INV-J-010 |

---

## 4. Hidden gaps — now tracked (IPS-43)

| Former hidden gap | Now |
|-------------------|-----|
| INV-D-007 Export inside a Pass row | **INV-D-007E** (Not tested); INV-D-007 = View (Pass) |
| INV-N-010…017, 027 originating triggers | Delivery rows stay Pass. Trigger rows **INV-N-0xxT**: 010T/011T/012T/027T Blocked (linked INV-A-050 / 057 / 066), 013T/015T/016T/017T Not tested (linked INV-A-058/059/060, INV-J-010) |
| INV-N-014 trigger | **No new row.** Already proven by INV-J-011 (review_deadline_sweep emits review_deadline_approaching; notified=1, no duplicate) |
| Deposit+mail combo (14) | Unchanged: stays Blocked |

Trigger rows link to the existing action checks and reuse their fixtures, so no check is duplicated.

---

## 5. Blocked rows (84) by blocker cluster

Source: [blocked-register.md](./blocked-register.md) (accounts for all 84; match = YES).

| Cluster | Rows | Unblock path | Can design proceed? |
|---------|-----:|--------------|---------------------|
| UI_FIXTURE_GAP | 20 | Seed fixture state on isolated host | Yes |
| DEPOSITS_CLOSED_AND_MAIL_SINK | 14 | Deposits stay closed → remains Blocked | Yes (no money reopen) |
| DEPOSITS_CLOSED | 15 | R6 provider sandbox plan (separate approval) | Yes, design only |
| EVENT_NOT_FIREABLE | 10 | Dispute/ops/ledger fixture (incl. `ledger_mismatch`) | Yes — see ledger/reconciliation scope on #540 master spec |
| DEEP_LINK_FIXTURE | 5 | Fixture ids | Yes |
| DASHBOARD_CONSISTENCY_FIXTURE | 3 | INV-DC-010 / 013 / 014 fixtures | Yes (Package 1 / 2) |
| FEATURE_GATE | 2 | Admin product switches | Yes |
| INQUIRY_FIXTURE | 2 | Fixture | Yes |
| PENDING_SIGN_FIXTURE | 3 | Fixture | Yes (Package 4) |
| PROVIDER_OAUTH | 2 | Meta / social OAuth | Out of Fail set |
| DEMO_GATE · DESTRUCTIVE_FIXTURE · JOB_NOT_ENQUEUED · NO_TRIGGER · PAYOUT_RISK · SHARED_HOST_ISOLATION · SMS_PROVIDER · TOKEN_FIXTURE | 1 each (8) | Per register | Per register |
| **Total** | **84** | | |

By prefix: INV-A 28 · INV-N 21 · INV-E 14 · INV-R 5 · INV-P 4 · INV-DC 3 · INV-J 3 · INV-C 2 · INV-I 2 · INV-T 2.

---

## 6. Package inconsistencies to correct (found while compiling this report)

| File | Says | Should say |
|------|------|-----------|
| [remediation-plan.md](./remediation-plan.md) "What this document claims" | Blocked rows "(95 after IPS-31)" | 80 (post IPS-40/42); 95 was the intermediate IPS-31 figure |
| [remediation-plan.md](./remediation-plan.md) Blocked dependency map header | "80 Blocked post IPS-40; **NT cleared**" | NT = 1 after IPS-42 (INV-J-010) |
| [blocked-register.md](./blocked-register.md) header | "Blocked = 80; IPS-40" | Count unchanged by IPS-42; add "IPS-42 verified" |

The first two are corrected in this commit. Counts are unaffected.

---

## 7. What this report does not claim

- That the platform is fully audited or remediated
- That any Fail row is closed by design work on #540 or #533
- That Blocked rows may become Pass without the stated gate
- That live deposits should be reopened to clear counts
