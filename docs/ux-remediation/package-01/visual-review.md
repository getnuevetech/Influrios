# Package 1 — desktop/mobile visual review (Dev AI)

**Date:** 2026-11-21 · **Boards at:** this commit · **Reviewer:** Dev AI (self-review against Ola's findings; Ola's sign-off is still required)
**Method:** every rendered frame reviewed on two contact sheets (14 desktop frames at 1280, 13 mobile frames at 390), plus the full boards. Checked against findings F1–F6, round-2 items R2-1…R2-6, consistency rules C1–C7, and the IPS-44 test results.

## Decision

**Ready for Ola's final visual sign-off.** After the four fixes below, the review found no remaining blocking visual issue. Once Ola signs off, implementation can start (backlog P1-T1…T15 + P1-AUD-01…09). P1-AUD-08 is now decided (delivery approval separate from release; master-spec §2.2, acceptance AUD2).

## Per-board result

| Board | Desktop | Mobile | Notes |
|-------|:------:|:------:|-------|
| Influencer home | ✅ | ✅ | Original card proportional, uncropped; counts 1/2/2/$0; no internal copy |
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

## Spec additions from the IPS-44 test results

Added to [master-spec](../master-spec.md): expiry at the Respond-by deadline (§2.2); team proposal closed for every member (§2.2); in-app notice for every action-required event (§5.6); withdrawal/expiry notices with the right template (§5.7); inbox rows name their subject, tasks clear on any state change, team invites included (§7); acceptance AUD1. P1-AUD-08 decided 2026-11-21: approval separate from release, “Approved · payout setup required”, same for auto-approval (AUD2).
