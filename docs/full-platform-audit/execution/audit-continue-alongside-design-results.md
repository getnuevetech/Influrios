> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

# IPS-40 — Continue remaining audit checks (alongside UX design)

**When:** 2026-11-21  
**Host:** isolated local `http://127.0.0.1:3000` (not live `influrios.com`)  
**Sink:** Mailpit `v1.34.0` — SMTP `127.0.0.1:1025`, API/UI `127.0.0.1:8025`  
**DB:** local Postgres `influrios_audit` + `seed-local-fixtures.ts` (`r4cont01` `@example.com` AUDIT members)  
**Evidence:** [`media/full-platform-audit/audit-continue/`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit/audit-continue) (evidence branch)  
**Harness:** `scripts/e2e-audit/ips40-audit-continue.ts` (local-only; no product PR)  
**Constraints:** Live deposits **not** reopened. Agency deferred. Design work not blocked. **Not** platform-wide completion.

## IPS-42 evidence reconcile (same day)

Blanket **24/24 Pass** withdrawn. Docs-only reconcile (no retest; no live deposits; design PR not held):

| Issue | Decision |
|-------|----------|
| **INV-J-010** auto-approval | **Demoted → Not tested.** JSON `auto1`/`auto2` both `scanned:0` / `approved:0` while milestone ends `release_scheduled`. Sweep did not approve; transition provenance unproven. |
| **INV-D-007** media kit | **Split:** **View Pass** (HTTP 200 public card). **Export remains Not tested** — no downloadable export proven. |
| **INV-N-010…017, INV-N-027** | **Pass narrowed** to delivery isolation via direct `notifyCollabFundingEvent` invoke → Mailpit. Does **not** prove originating business actions fire the correct notification. |

**Revised matrix counts:** **378 Pass · 24 Fail · 80 Blocked · 1 Not tested · 10 deferred** (was 379 / 0 NT).

## Acceptance summary (post IPS-42)

| Batch | Result |
|-------|--------|
| CLAIM_DRAFT_FIXTURE (6) | **6 Pass** — draftId preview → verify mail → publish → social exercise |
| EVENT_NOT_FIREABLE notify kinds (9) | **9 Pass (narrowed)** — delivery isolation only via `notifyCollabFundingEvent`; not business-action emission |
| IPS-30 demoted NT actions (4) | **3 Pass + INV-D-007 View Pass / Export NT** — prefs / managed-intro / save-listing Pass; media-kit View only |
| IPS-30 demoted NT jobs (5) | **4 Pass + INV-J-010 Not tested** — collab_notification / review-deadline / funding-recon / app-expire Pass; auto-approval unproven |
| DEPOSITS_CLOSED (+ deposit+mail) | **Documented Blocked only** — not retested as Pass |

## Counts delta (store matrix)

| Metric | Before (IPS-31) | After IPS-40 (pre-reconcile) | After IPS-42 reconcile |
|--------|----------------:|-----------------------------:|-----------------------:|
| Pass | 355 | 379 | **378** |
| Fail | 24 | 24 | 24 |
| Blocked | 95 | 80 | 80 |
| Not tested | 9 | 0 | **1** |
| Explicitly deferred | 10 | 10 | 10 |
| Rows | 493 | 493 | 493 |

## Row results (24 executed; statuses post IPS-42)

| ID | Status | Actual (short) |
|----|--------|----------------|
| INV-R-017 | Pass | Preview `draftId` on isolated host |
| INV-R-018 | Pass | `/claim/verify/{draftId}` after claimDraft |
| INV-R-019 | Pass | `stage=published` |
| INV-A-013 | Pass | Mailpit claim verify code received + used |
| INV-A-014 | Pass | Publish action → published |
| INV-A-015 | Pass | Claim social path exercised (Starter 1-link; second → upgrade limit) |
| INV-N-010…017, INV-N-027 | Pass (narrowed) | Kind emails via direct invoke + Mailpit; **not** originating business-action proof |
| INV-J-006 | Pass | `collab_notification` SUCCEEDED |
| INV-J-010 | **Not tested** | Sweep `approved:0` both runs; `release_scheduled` provenance unproven |
| INV-J-011 | Pass | Review-deadline notified once; rerun 0; no duplicate mail |
| INV-J-015 | Pass | Funding recon flagged stale once; rerun 0 |
| INV-J-017 | Pass | App expire auto mode expired once; rerun 0 |
| INV-A-008 | Pass | Email prefs persist after reload |
| INV-A-019 | Pass | `openToManaged=true` persist |
| INV-A-027 | Pass | Save → reload → unsave |
| INV-D-007 | Pass (View only) | Public card HTTP 200; **Export NT** |

Full machine results: `media/full-platform-audit/audit-continue/results.json`.

## DEPOSITS_CLOSED (documented only)

Left **Blocked**. Policy unchanged: do not reopen `journey_funding` / live deposits for audit counts. Includes deposit-only money paths and `DEPOSITS_CLOSED_AND_MAIL_SINK` payout/refund journey emails (catalog Send-test already proven in IPS-31; money event still closed). See `media/full-platform-audit/audit-continue/deposits-closed-documented.json`.

## Still open (not claimed complete)

- **80 Blocked** remain (fixture gaps, deposit+mail, OAuth, SMS, shared-host cron, remaining EVENT_NOT_FIREABLE ops kinds, etc.)
- **24 Fail** remain (dashboard consistency, annual purchase, invitation/quote sweep Fail rows, etc.)
- **1 Not tested** — INV-J-010 auto-approval behavior
- Agency Explicitly deferred
- Live production Mailpit still absent
- Remediation plan stays **PROVISIONAL**
- Notify-kind **state-change emission** still unproven (isolation Pass only)
- Media-kit **Export** still Not tested

## Claim boundary

- **Claimed:** Isolated-host retests above with Mailpit + fixture evidence; matrix/register/status updated in store; IPS-42 reconcile applied.
- **Not claimed:** Live host completion; deposit/money journeys; Agency; platform-wide audit or remediation completion; auto-approval sweep causation; media-kit export; notify kinds fired by originating business actions.

## Fold note

Reconciled batch for #539 docs/evidence fold (matrix Pass **378** / Blocked **80** / NT **1**). Design Package 1 PR not held.
