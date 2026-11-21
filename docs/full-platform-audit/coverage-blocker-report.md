# Coverage & blocker report — latest position

**Status:** **PROVISIONAL** — not platform-wide completion. No audit restart.
**As of:** 2026-11-21 · matrix revision at `ccc4fc3` (IPS-42 reconcile)
**Host:** https://influrios.com · live collaboration deposits **closed** · Agency **Explicitly deferred**
**Authoritative sources:** [coverage-matrix.md](./coverage-matrix.md) · [blocked-register.md](./blocked-register.md) · [coverage-status.md](./coverage-status.md) · [remediation-plan.md](./remediation-plan.md)

This page is the single summary of what is still open. It does not change any matrix row; counts below were recomputed directly from the matrix Status column.

---

## 1. Matrix position (recomputed)

| Status | Rows | Recomputed from matrix | Matches header |
|--------|-----:|------------------------|:--------------:|
| Pass | 378 | yes | ✅ |
| **Fail** | **24** | 24 rows with Status `Fail` | ✅ |
| **Blocked** | **80** | 80 rows with Status `Blocked` | ✅ |
| **Not tested** | **1** | INV-J-010 | ✅ |
| Explicitly deferred | 10 | Agency only | ✅ |
| **Total** | **493** | | ✅ |

**Open = 105 rows** (24 Fail + 80 Blocked + 1 Not tested), plus the hidden partial items in §4.

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

## 3. Not tested (1)

| Row | Why | What closes it |
|-----|-----|----------------|
| INV-J-010 auto-approval sweep | IPS-42 demote: sweep `scanned:0` / `approved:0`; `release_scheduled` provenance unproven | Isolated fixture with a due submission; sweep run shows `scanned ≥1`, `approved ≥1`; resulting state traced to the sweep; rerun produces no duplicate |

---

## 4. Unresolved coverage hidden inside Pass rows

These are **not** counted as Not tested in the header, but are unproven and must stay visible:

| Row | Pass covers | Still unproven | Action |
|-----|-------------|----------------|--------|
| INV-D-007 | Media kit **View** | Media kit **Export** (no downloadable file proven) | Split into its own row (e.g. INV-D-007b, Not tested) at the next matrix revision so the header counts it |
| INV-N-010…017, INV-N-027 | Delivery isolation via direct `notifyCollabFundingEvent` | Emission from the originating business action | Keep narrowed wording; retest from originating action once deposits/fixtures allow |
| INV-E-* deposit+mail combo (14, Blocked) | Mail portion proven on isolated Mailpit | Money event that should trigger the mail | Stays Blocked; do not split into Pass |

---

## 5. Blocked rows (80) by blocker cluster

Source: [blocked-register.md](./blocked-register.md) (accounts for all 80; match = YES).

| Cluster | Rows | Unblock path | Can design proceed? |
|---------|-----:|--------------|---------------------|
| UI_FIXTURE_GAP | 19 | Seed fixture state on isolated host | Yes |
| DEPOSITS_CLOSED_AND_MAIL_SINK | 14 | Deposits stay closed → remains Blocked | Yes (no money reopen) |
| DEPOSITS_CLOSED | 13 | R6 provider sandbox plan (separate approval) | Yes, design only |
| EVENT_NOT_FIREABLE | 10 | Dispute/ops/ledger fixture (incl. `ledger_mismatch`) | Yes — see ledger/reconciliation scope on #540 master spec |
| DEEP_LINK_FIXTURE | 5 | Fixture ids | Yes |
| DASHBOARD_CONSISTENCY_FIXTURE | 3 | INV-DC-010 / 013 / 014 fixtures | Yes (Package 1 / 2) |
| FEATURE_GATE | 2 | Admin product switches | Yes |
| INQUIRY_FIXTURE | 2 | Fixture | Yes |
| PENDING_SIGN_FIXTURE | 2 | Fixture | Yes (Package 4) |
| PROVIDER_OAUTH | 2 | Meta / social OAuth | Out of Fail set |
| DEMO_GATE · DESTRUCTIVE_FIXTURE · JOB_NOT_ENQUEUED · NO_TRIGGER · PAYOUT_RISK · SHARED_HOST_ISOLATION · SMS_PROVIDER · TOKEN_FIXTURE | 1 each (8) | Per register | Per register |
| **Total** | **80** | | |

By prefix: INV-A 28 · INV-N 17 · INV-E 14 · INV-R 5 · INV-P 4 · INV-DC 3 · INV-J 3 · INV-C 2 · INV-I 2 · INV-T 2.

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
