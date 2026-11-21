# Package 1 — desktop/mobile visual review (Dev AI)

**Date:** 2026-11-21 · **Boards at:** this commit · **Reviewer:** Dev AI (self-review against Ola's findings; Ola's sign-off is still required)
**Method:** every rendered frame reviewed on two contact sheets (14 desktop frames at 1280, 13 mobile frames at 390), plus the full boards. Checked against findings F1–F6, round-2 items R2-1…R2-6, consistency rules C1–C7, and the IPS-44 test results.

## Decision

**Ready for Ola's final visual sign-off.** After the four fixes below, the review found no remaining blocking visual issue. Once Ola signs off, implementation can start (backlog P1-T1…T15 + P1-AUD-01…09). P1-AUD-08 is now decided (delivery approval separate from release; master-spec §2.2, acceptance AUD2).

## Per-board result

| Board | Desktop | Mobile | Notes |
|-------|:------:|:------:|-------|
| Influencer home | ✅ | ✅ | Original card proportional, uncropped; counts per shared example records (1 invitation · 3 active · 1 unread message · $0 paid out this month); no internal copy |
| Collaborations hub | ✅ (fixed) | ✅ (fixed) | Fix 1 + Fix 3 |
| Payout readiness (6 + no-history) | ✅ | ✅ | No timing/email promises |
| Invitations — transitions | ✅ | ✅ | Matrix cases 1–6, team, timeout outcomes |
| Notifications | ✅ | ✅ (fixed) | Fix 2 |
| Business dashboard (+ popup/sheet) | ✅ | ✅ | Complete; “Discover Influencers” |
| Action inbox | ✅ | ✅ | Rows name collaboration + milestone (matches P1-AUD-07 rule) |
| Sidebar badges | ✅ | — | Desktop-only legend |
| Mobile navigation | — | ✅ | More fully visible; drawer complete |
| Shared states | — | ✅ | Error copy has no “nothing changed” |
| Admin shared note | ✅ (fixed) | — | Fix 4 |

Visual system across all frames: Plus Jakarta Sans + Sora only, live tokens, `icons.tsx` icons, live shell and dialog. No serif. No engineering text inside app frames.

## Fixes applied in this review

| # | Issue | Fix |
|---|-------|-----|
| 1 | Hub mobile: status pills squeezed titles into one-word columns | Pill moves under the title on mobile |
| 2 | Notifications mobile: title wrapped around the Action required pill | Pill moves under the text on mobile |
| 3 | Hub didn't show a team invitation (runtime defect P1-AUD-04) | Team row added (“Winter Unboxing · Team · Waiting for teammates”); Invitations card 3 open / 1 waiting, so home (1) and badge (1) still agree |
| 4 | Admin board used an invented job name | Uses `marketplace_application_expire_sweep` |

## Board updates after review (round 6, P1-AUD-10/11)

Only the affected boards changed:

| Board | Change |
|-------|--------|
| Invitation transitions | “Accepted” split into “Accepted · agreement not sent” (no influencer action) and “Agreement ready to sign” (task); table updated |
| Influencer home (desktop + mobile) | Holiday Gift Guide now “Waiting for Northwind Studio to sign” with View agreement (no task), matching the business dashboard; mobile list pills moved under titles |
| Business dashboard (desktop + mobile + popups) | Recent collaborations shows a fully signed agreement as “Agreement signed · funding isn't available yet” (no task); mobile list pills under titles |

## Correction pass (round 7, Ola's review of 2771b85)

Visual direction kept. Affected boards re-rendered together.

| # | Ola's item | Change | Boards |
|---|-----------|--------|--------|
| 1 | Counts disagree across boards | One set of example records (master-spec §3.1): Collaborations 3 (invitation + 2 milestones), Contracts 1, attention 4, inbox 4; hub tab badges Invitations 1 + Active 2; scenario labels moved to captions | home, hub, inbox, notifications, badges, mobile nav, invite, payout, states |
| 2 | Notification read state; Holiday Gift Guide contradiction | After-open frame: bell 1, Unread 1, dot removed, Action required 2. Holiday Gift Guide is “you signed, waiting for Northwind” everywhere; its historical notice opens the current state. Inbox sign task is now Studio Tour Shorts | notifications, inbox, home |
| 3 | Accept implied drafting | Popup: Accept · Reply · Not a fit; hint no longer says Accept drafts; outcome panels incl. “Accepted · agreement not sent” + Prepare agreement | business dashboard |
| 4 | Mobile | Inbox highlights More, Notifications highlights nothing; hub keeps Overview and Completed; Open/Review on hub, inbox, attention and recent-collaboration rows; full card kept; 320 and 430 frames added with a note that keyboard/focus and the continuous range are runtime acceptance | hub, inbox, notifications, business, mobile nav, home |
| 5 | Payment wording | “In escrow” removed (Held for milestones · Simulation; funding notice “(simulation)”); “Paid out this month”; “About 5 minutes” removed; unavailable badge = last known everywhere (0 when last confirmed Ready) | payout, home, notifications, badges |
| 6 | Missing panels | Team closed after you accepted · both signatures pending · business signed/you pending · you signed/business pending · all signed, funding unavailable · signed-out with sign-in and return to item · withdrawal with recorded reason | invite, states |

Self-check: every frame re-read after rendering; no “In escrow”, “Accept and draft”, “Accepting drafts”, “About 5 minutes” or “Released this month” in any app frame. Ola's sign-off is still required.

## Spec additions from the IPS-44 test results

Added to [master-spec](../master-spec.md): expiry at the Respond-by deadline (§2.2); team proposal closed for every member (§2.2); in-app notice for every action-required event (§5.6); withdrawal/expiry notices with the right template (§5.7); inbox rows name their subject, tasks clear on any state change, team invites included (§7); acceptance AUD1. P1-AUD-08 decided 2026-11-21: approval separate from release, “Approved · payout setup required”, same for auto-approval (AUD2).
