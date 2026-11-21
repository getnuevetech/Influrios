# Dashboard consistency contradiction coverage (IPS-29 / P-28 deep)

**Date:** 2026-11-20  
**Baseline:** live `https://influrios.com` · AUDIT influencer + business (Agency deferred)  
**Viewports:** desktop 1440×900 + mobile 390×844  
**Constraint:** Live deposits closed — no new funding/Stripe charge; withdraw/expire/accept paths exercised only where UI allowed without mutating funded fixtures  
**Evidence root:** `media/dashboard-consistency/`  
**Machine summaries:** `results.json` (broad harness) · `reverify.json` (focused contradiction pass)

## Verdict

Explicit contradiction coverage found **5 Fail** defects where payout readiness, invitation counts, and/or destination pages disagree for the same influencer account. Business role sidebar↔attention was consistent. Refresh/re-login core badges held. Opening a true **Unread** notice clears the bell; opening an already-Read notice does not (by design). Completing invitation action-required is **broken** for the live “Free Tech Support” coordinated invite (pending copy + “No further action needed” + no respond controls).

## Surfaces compared (same account, same session)

| Surface | Influencer | Business |
|---------|------------|----------|
| Role dashboard | `/creator` | `/business/home` |
| Collaborations destination | `/collaboration/hub?view=collaborations` | `/collaboration/business` |
| Money / payout | `/creator/earnings` (+ `#payouts`) | `/payments` |
| Action inbox | `/collaboration/inbox` | `/collaboration/inbox` |
| Notification centre | `/creator/notifications` | `/notifications` |
| Sidebar badges | Collaborations, Earnings & Payouts, Contracts | Collaborations, Collaboration Payments |
| Bell unread | `aria-label="Notifications, N unread"` | same |

Code reference for badge math: `src/lib/sidebar-badges.ts` + `src/components/account-shell.tsx` (creator: invites+work → Collaborations; `!payoutReady && activeCollabs>0` → Earnings badge `1`).

## Matrix outcomes (new INV-DC-* rows)

| ID | Cases | Status | Defect |
|----|-------|--------|--------|
| INV-DC-001 | Invitation counts: home / banner / attention vs hub destination vs Collaborations badge (d+m) | **Fail** | DC-INVITE-MISMATCH |
| INV-DC-002 | Payout readiness: home setup banner vs hub “Payment readiness” vs earnings “Payout Setup” vs Earnings badge (d+m) | **Fail** | DC-PAYOUT-MISMATCH |
| INV-DC-003 | Sidebar badge numbers stable across home/hub/earnings|payments | Pass | — |
| INV-DC-004 | Bell unread count matches Unread rows in notification centre | Pass | — |
| INV-DC-005 | Centre copy: unread ≠ action-required; Action required filter separate | Pass | — |
| INV-DC-006 | Active collaboration count: home vs hub (d+m) | **Fail** | DC-ACTIVE-MISMATCH |
| INV-DC-010 | Business create invitation for lifecycle fixture | Blocked | Composer send not completed (demo/picker) |
| INV-DC-011 | View invitation from dashboard attention CTA | Pass | — |
| INV-DC-012 | Completing required invitation action clears action-required; home/hub/badge agree after | **Fail** | DC-ACTION-STUCK |
| INV-DC-013 | Business withdraw pending invite → counts agree | Blocked | No Withdraw on current list; funded fixtures not mutated |
| INV-DC-014 | Expire invite (deadline/sweep) → counts agree | Blocked | `marketplace_application_expire_sweep` listed; no pending invite expired this pass |
| INV-DC-015 | Team invite destination self-consistency (pending vs no-action) | **Fail** | DC-TEAM-INVITE-DEADEND |
| INV-DC-020 | Opening an Unread notice clears unread bell (influencer); action-required unchanged by read alone | Pass | — |
| INV-DC-030 | Influencer refresh badge stability | Pass | — |
| INV-DC-031 | Influencer re-login Collaborations/Earnings badge stability | Pass | — |
| INV-DC-032 | Business refresh badge stability | Pass | — |
| INV-DC-033 | Business re-login Collaborations badge stability | Pass | — |

**Counts added:** 17 rows · **Fail 5** · **Pass 9** · **Blocked 3**

## Fail detail (with evidence)

### DC-INVITE-MISMATCH — INV-DC-001

| Surface | Observed (influencer) |
|---------|------------------------|
| `/creator` | Banner **“1 new invitation”**; card **Invitations = 1**; Needs attention **Free Tech Support** → Review invitation |
| Sidebar Collaborations | Badge **1** (agrees with home) |
| `/collaboration/hub` | Status **Invitations = 0**; copy **“No invitations are waiting.”** |

Desktop: `re-inf-home.png` · `re-inf-hub.png` · also `before-influencer-desktop-home.png` / `before-influencer-desktop-collab.png`  
Mobile: `re-inf-mobile-home.png` · `re-inf-mobile-hub.png`

### DC-PAYOUT-MISMATCH — INV-DC-002

| Surface | Observed |
|---------|----------|
| `/creator` | **“Complete payout setup”** reminder banner |
| `/collaboration/hub` | **Payment readiness: Not ready** — “No verified payout method (primary or secondary).” |
| `/creator/earnings` | **Payout Setup: Ready** — “You're set up to receive collaboration payments.” Identity verified + payout account on file |
| Sidebar Earnings & Payouts | Badge **1** (matches “not ready” / setup reminder, **contradicts** earnings Ready) |

Evidence: `re-inf-home.png` · `re-inf-hub.png` · `re-inf-earnings.png` (+ mobile trio). Prior hub shot in collab pack already showed Not ready beside Invitations 0.

### DC-ACTIVE-MISMATCH — INV-DC-006

| Surface | Active count |
|---------|-------------:|
| `/creator` “Active collaborations” | **3** |
| Hub “Active” status card | **2** |

Evidence: same home/hub shots as INV-DC-001.

### DC-TEAM-INVITE-DEADEND + DC-ACTION-STUCK — INV-DC-015 / INV-DC-012

Opening attention CTA → `/collaboration/team/cmv84byp900eatf01qjcxgkof` (“Free Tech Support” coordinated invitation):

- Shows **“Your response: Pending your response”** and member line **PENDING YOUR RESPONSE**
- Same card footer: **“No further action needed from you on this invitation.”**
- **No** Decline / Interested / Accept / Respond controls

So the dashboard advertises action-required that the destination cannot complete → action-required indicator cannot be cleared via the required action. Evidence: `re-inf-invitation-open.png` · `re-inf-team-invite-detail.png`

### Business role (contrast)

- Collaborations sidebar badge **2** stable home↔hub; Needs-your-attention lists response-to-review + submission review (matches badge scale).  
- INV-DC-001/002 style invitation/payout splits **not** reproduced on business AUDIT account this pass.  
- Evidence: `re-biz-home.png` · `re-biz-collab.png`

## Lifecycle before/after (Ola checklist)

| Event | Executed? | Consistency after |
|-------|-----------|-------------------|
| Viewing (invitation / notice) | Yes — attention CTA + notification `?open=` | View Pass; invite destination self-contradicts (INV-DC-015) |
| Accepting | No dedicated Accept on team invite; invitee popup uses interested≠accept | Blocked / N/A on fixture |
| Declining | Controls absent on team invite detail | Blocked → filed under INV-DC-012 Fail (cannot clear) |
| Withdrawing | No Withdraw on business list; funded not mutated | Blocked INV-DC-013 |
| Expiring | Admin jobs lists expire sweep; no invite expired in-session | Blocked INV-DC-014 |
| Refreshing | Yes both roles | Pass INV-DC-030/032 |
| Signing in again | Yes both roles | Pass INV-DC-031/033 |
| Open clears unread | Yes — open **Unread** notice `?open=` → bell 2→1→0 | Pass INV-DC-020 (`re-inf-home-bell-after-1.png`, `re-inf-home-bell-after-2.png`) |
| Complete action clears action-required | Cannot — dead-end destination | Fail INV-DC-012 |

Note: first unread harness attempt opened an already-**Read** row (bell stayed 2). Product behaviour: only marking an Unread notice reduces the bell. Centre subtitle correctly states unread ≠ action-required.

## Related non-Fail observations

- Notification centre **Action required (9)** / **Invitations (6)** ≫ sidebar Collaborations **1** — filters count historical notice kinds; sidebar uses live attention projection. Documented under INV-DC-005 Pass (distinct systems) rather than Fail, given product copy.
- Messages card “Unread messages 2” vs Messages sidebar (no badge) — out of badge contract in `sidebar-badges.ts` (messages never badged).
- Business re-login false Fail in broad harness was session/login race (landed on `/login`); reverify Pass.

## Remediation feed

Patch for plan owner: [dashboard-consistency-remediation-patch.md](./dashboard-consistency-remediation-patch.md) → root cause **RC-DASHBOARD** (merge into [remediation-plan.md](../remediation-plan.md)).

## Method

Playwright Chromium against live AUDIT secrets (values not recorded). Scripts: `/tmp/dashboard-consistency/run.mjs`, `reverify.mjs`. No product PRs from this task.
