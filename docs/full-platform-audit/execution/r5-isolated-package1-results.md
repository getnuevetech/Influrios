# r5 — Package 1 gating checks on an isolated host (IPS-44)

> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

**When:** 2026-11-21 · **Runner:** Claude Code session (local isolated host, built because the earlier isolated runner wasn't reachable)
**Code under test:** `main` @ `5a5f4c0` (production build, `next start`)
**Host:** `http://127.0.0.1:3000` only. Not influrios.com. Live deposits untouched.
**Data:** local Postgres 16 `influrios_audit` (127.0.0.1:5433) · `seed-local-fixtures.ts` run `r5iso01` (synthetic `@example.com` members) · local SMTP sink 127.0.0.1:1025 with JSON API :8025 (`scripts/e2e-audit/r5-iso/mailsink.js`)
**Harness:** `scripts/e2e-audit/r5-iso/` (Playwright; actions through the UI) · **Evidence:** `media/full-platform-audit/r5-iso/<check>/` (screenshots + page text + `result.json`; superseded attempts keep text/JSON under `_attempts/`)

Baseline testing only: known defects stay **Fail** until fixed. Nothing here is a fix.

## Method

Each check performs the real action in the browser, then records: the persisted DB state, the influencer counts (home banner, Invitations stat, Needs your attention, hub Invitations card + “No invitations” copy, Collaborations badge, bell, action inbox open tasks), the business view, a **reload**, and a **390 px mobile** pass. Fixtures that can't be produced through the UI are marked **FIXTURE** below; clock changes are marked **TIME-TRAVEL** (DB timestamp moved because the clock can't be advanced).

## Results

| Check | Result | Evidence | What happened |
|-------|--------|----------|---------------|
| **INV-DC-010** business creates invitation → counts agree | **Pass** | `r5-iso/INV-DC-010/` | Business sent an invitation from the influencer profile dialog. Influencer surfaces moved 0 → 1 together (banner, stat, attention, hub card, Collaborations badge, inbox “1 open task”, bell). Same after reload and on mobile. FIXTURE: the request was published via `upsertBusinessRequest` (no brief), so it doesn't appear in the business requests panel; later checks used the real wizard. |
| **INV-DC-013** business withdraws pending invite | **Fail** | `r5-iso/INV-DC-013/` | Wizard invite → influencer counts 1 → business “Withdraw participation” → status WITHDRAWN. Home, hub, badge and inbox dropped 1 → 0 (reload + mobile agree). **Defects:** (1) the notification centre still lists the original invitation under **Action required (1)**; (2) the withdrawal sends the **`invite.collaboration` email** (“…invited you to collaborate”) instead of a withdrawal notice (`actionWithdrawParticipation`, business/actions.ts); (3) no in-app withdrawal notice, although the business sees “The influencer was notified”. |
| **INV-DC-014** invitation expires → counts agree | **Fail** | `r5-iso/INV-DC-014/` | Two paths. **Deadline path (TIME-TRAVEL `responseDeadline` = now−1h):** the expire sweep ran but the invitation stayed REQUESTED; it still counted everywhere as waiting, and clicking “Interested” returned “This invitation has expired” (dead end). Cause: `sweepExpiredMarketplaceApplications` is off by default and expires by **age** (`createdAt + afterDays`), not by the Respond-by deadline. **Admin auto-expire path** (admin set Auto · 1 day with password step-up; TIME-TRAVEL `createdAt` = now−2d): status EXPIRED, one event, rerun no duplicate; home, hub, badge, inbox dropped 1 → 0 (reload + mobile agree), but the notification centre still shows **Action required (2)** and no expiry notice is sent. |
| **INV-A-031** decline on token page | **Pass** | `r5-iso/INV-A-031/` | Admin queued + sent a claim invitation (UI); invitee opened `/invite/[token]` and declined. Status `declined`, events `opened → declined`; “This invitation was declined” after reload and on mobile; admin pipeline shows declined. The invitee has no account, so no member task counts apply. FIXTURE: one unclaimed profile + Instagram account. **Observations:** decline is labelled “This isn't my profile” (no honest “No thanks”); a profile without a social account shows no decline at all; after SMTP delivery the admin row still says QUEUED. |
| **INV-A-048** team proposal send/respond | **Fail** | `r5-iso/INV-A-048/` | Business sent a team proposal to two influencers. Team page shows “Pending your response” + Accept/Decline (no dead-end copy). Accept and Decline persist (reload) and the member's counts drop. **Defects:** (1) hub Invitations card/tab = 1 while the list says “No invitations are waiting” (team invites not listed; same class as INV-DC-001); (2) action inbox “0 open tasks” while home attention = 1; (3) after a teammate declined (proposal closed), the accepted member still reads “This team agreement opens after every teammate accepts.” |
| **INV-N-013T** submit → business notified | **Pass** | `r5-iso/INV-N-0xxT-workroom/` | Influencer submitted M1 and M2 through the workroom dialog. Business got “Ready for review” emails (one per milestone), an in-app Work notice and a Needs-your-attention row; inbox shows **2 open tasks** (distinct milestones kept separate). FIXTURE: held workroom (`r5-fixture-workroom.ts`, sandbox ledger hold). Observation: business Collaborations badge = 1 while 2 review tasks are open. |
| **INV-N-015T** request changes → influencer notified | **Fail** | same folder | Business “Request changes” persisted (M1 back to pending) and the “Revision requested” email reached the influencer. **Defects:** no in-app notice (centre “Work (0)”), and the influencer's home attention and Collaborations badge show 0 while the inbox shows 1 open task. |
| **INV-N-016T** approve → influencer notified | **Blocked** | `r5-iso/INV-N-016T-approve/` + `_attempts/` | Approval is coupled to release: it was refused for payout setup (“Work was not approved. Payout setup still needs attention”), then for a missing signed total, then for a missing frozen milestone allocation; next it would call the provider release (R6 money path). **Defect observed:** the approve dialog says approval doesn't pay until release is confirmed, but approval itself is blocked by the influencer's payout setup (`payments/standard-actions.ts`). |
| **INV-J-010** auto-approval sweep | **Pass** | `r5-iso/INV-J-010/` + `_attempts/INV-J-010-attempt2/` | Admin enabled “Automatic milestone approval” (UI, with reason). TIME-TRAVEL M2 `autoApproveAt` = now−1h. Sweep 1: M2 submitted → `release_scheduled`, one `milestone_auto_approved` log (0 before). Sweep 2: still one log, no duplicate. Scheduler + behaviour + idempotency proven. |
| **INV-N-017T** review period ended → notices | **Fail** | `r5-iso/INV-J-010/` | Sweep sent “Approved: AUDIT r5 Milestone 2” to business and influencer, once each. **Defects:** no in-app notice for either party; the business inbox keeps a stale “Review delivery v1” task for the auto-approved milestone; inbox rows don't name the milestone, so two distinct tasks read only “v1”/“v2”. |

## Matrix effect (IPS-44)

| Row | Before | After |
|-----|--------|-------|
| INV-DC-010 | Blocked | **Pass** |
| INV-DC-013 | Blocked | **Fail** |
| INV-DC-014 | Blocked | **Fail** |
| INV-A-031 | Blocked | **Pass** |
| INV-A-048 | Blocked | **Fail** |
| INV-N-013T | Not tested | **Pass** |
| INV-N-015T | Not tested | **Fail** |
| INV-N-016T | Not tested | **Blocked** (approve↔release coupling; R6) |
| INV-J-010 | Not tested | **Pass** |
| INV-N-017T | Not tested | **Fail** |

Totals: **502 rows · 382 Pass · 29 Fail · 80 Blocked · 1 Not tested · 10 deferred** (Pass +4, Fail +5, Blocked −4, Not tested −5).

## New defects for Package 1 (feed master spec / backlog)

| ID | Defect | Rows | Package 1 rule it breaks |
|----|--------|------|--------------------------|
| P1-AUD-01 | Withdrawn/expired invitations stay under Action required in the notification centre | DC-013, DC-014 | §5.3 / DB5 |
| P1-AUD-02 | Withdrawal emails the invitee an invitation template; no in-app withdrawal notice | DC-013 | §5 notices |
| P1-AUD-03 | Respond-by deadline doesn't expire invitations; past-deadline invitations still count as waiting but can't be answered | DC-014 | §1 “not expired”, DB4 |
| P1-AUD-04 | Team invitations counted but not listed in hub Invitations; missing from action inbox | A-048 | DB1, INB1 |
| P1-AUD-05 | Accepted team member sees “waiting for teammates” after the proposal closed | A-048 | §2.2 team states |
| P1-AUD-06 | Revision request and auto-approval create no in-app notice; influencer attention/badge miss the revision task | N-015T, N-017T | DB5, §3 |
| P1-AUD-07 | Auto-approved milestone leaves a stale review task; inbox rows omit milestone name | N-017T | INB1 |
| P1-AUD-08 | Delivery approval blocked by influencer payout setup (approve coupled to release) | N-016T | §2.1 (readiness never blocks unrelated actions) — product decision needed |
| P1-AUD-09 | Business Collaborations badge counts collaborations, not review tasks | N-013T | §3 business badge |
| P1-AUD-10 | Request wizard sends invitations on Terms “Next” without the Review step; wizard reopens prefilled | DC-013 setup | Pkg 2 (request composer) |

## Host state left behind (isolated only)

Control plane `applicationExpire` = Auto · 1 day; launch gate automatic milestone approval = on; payout readiness seeded for `audit-r5iso01-*`. One stray public listing “AUDIT r5 DC-013 Withdraw” (no invitations) from a wizard attempt.
