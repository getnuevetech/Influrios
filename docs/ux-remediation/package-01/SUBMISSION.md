# Package 1 — submission for final visual approval and focused implementation

**Submitted:** 2026-11-21 · **Branch:** `cursor/ux-pkg1-design-boards-9268` (PR #540)
**Asks Ola for:** (1) final visual approval of the boards below; (2) go-ahead to start the focused implementation slices. Nothing is implemented yet.

## 1. What to approve

| Board | Desktop | Mobile | Notes |
|-------|---------|--------|-------|
| [Influencer home](./designs/influencer-home.html) | [PNG](../../../media/ux-remediation/package-01/influencer-home-desktop.png) | [PNG](../../../media/ux-remediation/package-01/influencer-home-mobile.png) | Original card; counts; §2.2c states |
| [Collaborations hub](./designs/collaborations-hub.html) | [PNG](../../../media/ux-remediation/package-01/collaborations-hub-desktop.png) | [PNG](../../../media/ux-remediation/package-01/collaborations-hub-mobile.png) | Includes team invitation |
| [Payout readiness](./designs/earnings-payout.html) | [PNG](../../../media/ux-remediation/package-01/earnings-payout-desktop.png) | [PNG](../../../media/ux-remediation/package-01/earnings-payout-mobile.png) | Six states + no history |
| [Invitation transitions](./designs/team-invite-respond.html) | [PNG](../../../media/ux-remediation/package-01/team-invite-respond-desktop.png) | [PNG](../../../media/ux-remediation/package-01/team-invite-respond-mobile.png) | Matrix cases, timeout outcomes, post-acceptance |
| [Notifications](./designs/notifications.html) | [PNG](../../../media/ux-remediation/package-01/notifications-desktop.png) | [PNG](../../../media/ux-remediation/package-01/notifications-mobile.png) | |
| [Business dashboard](./designs/business-dashboard.html) | [PNG](../../../media/ux-remediation/package-01/business-dashboard-desktop.png) · [popup](../../../media/ux-remediation/package-01/business-dashboard-desktop-popup.png) | [PNG](../../../media/ux-remediation/package-01/business-dashboard-mobile.png) · [sheet](../../../media/ux-remediation/package-01/business-dashboard-mobile-popup.png) | |
| [Action inbox](./designs/action-inbox.html) | [PNG](../../../media/ux-remediation/package-01/action-inbox-desktop.png) | [PNG](../../../media/ux-remediation/package-01/action-inbox-mobile.png) | |
| [Mobile navigation](./designs/mobile-auth-nav.html) | — | [influencer](../../../media/ux-remediation/package-01/mobile-auth-nav-mobile.png) · [business](../../../media/ux-remediation/package-01/mobile-auth-nav-mobile-business.png) | |
| [Sidebar badges](./designs/sidebar-badges.html) · [States](./designs/states.html) · [Admin note](./designs/admin-shared-note.html) | full boards | [states](../../../media/ux-remediation/package-01/states-mobile.png) | |

Review record: [visual-review.md](./visual-review.md). Rules: [master-spec](../master-spec.md) §0–§9 (+ §12–§13 for Package 5 / R6 boundaries). Flows: [flows.md](./flows.md).

## 2. Focused implementation — proposed slices (after approval)

Each slice ships behind its acceptance anchors and is retested on the isolated host with the #539 harness (`scripts/e2e-audit/r5-iso/`). No slice touches live deposits or the release path.

| Slice | Backlog | Acceptance | Retest rows (#539) |
|-------|---------|------------|--------------------|
| S1 Invitation projections + turn tracking + action matrix | P1-T1, P1-T4, P1-D1, P1-AUD-10 | DB1, DB4, DB4a–d | INV-DC-001, INV-DC-015, INV-A-045, INV-A-029 |
| S2 Invitation lifecycle: deadline expiry, withdrawal/expiry notices, team listing, closed proposals | P1-AUD-01…05 | AUD1, DB1, DB4 | INV-DC-013, INV-DC-014, INV-A-048 |
| S3 Response reliability (idempotency, timeout outcomes) | P1-T5 | DB4b | new timeout checks |
| S4 Notices + inbox: in-app notice per action-required event, dedupe, subject names, stale bell | P1-T6, P1-T12, P1-AUD-06/07/12 | DB5, INB1 | INV-N-015T, INV-N-017T, INV-P-019 |
| S5 Payout readiness six states | P1-T2, P1-T11 | DB2, DB2a–e | INV-DC-002, INV-C-014, INV-N-004 |
| S6 Approval separate from release | P1-AUD-08 | AUD2 | INV-N-016T (approval half) |
| S7 Next steps after acceptance/signature | P1-AUD-11 | DB8 | INV-A-045, INV-N-010T (next-step half) |
| S8 Business dashboard + badges | P1-T9, P1-AUD-09 | DB7 | INV-N-013T badge |
| S9 Shell: mobile nav, terminology, card, visual parity | P1-T8, P1-T13–T15 | MOB1, TERM1, CARD1, VIS1 | INV-DC-030–033 |
| S10 Active count + stability regression | P1-T3, P1-T7, P1-T10 | DB3, DB6 | INV-DC-006 |

## 3. Not in Package 1 (owners in #539 remediation plan, defect register)

Request wizard (AUD-WIZ-01) → Pkg 2 · fee-label mismatch and discount rejection (AUD-FEE-01/02) → Pkg 3 + Pkg 4 · unreachable actions and missing entry points (AUD-R2-01a–d, AUD-R2-03) → Pkg 2 / Pkg 5 · media kit export, opening redirect (AUD-R2-04, AUD-R2-08) → Pkg 4 · admin invitation/opening forms (AUD-INV-01, AUD-ADM-01) → Pkg 5 · release, ledger, reconciliation (MS1–MS8) → R6 / Pkg 5.

## 4. Audit position (unchanged by this submission)

#539 matrix: **502 rows · 398 Pass · 40 Fail · 54 Blocked · 0 Not tested · 10 deferred**. Every remaining Blocked row names its gate (deposits closed, R6, Stripe test subscription, AI provider). This is not a completed platform audit.
