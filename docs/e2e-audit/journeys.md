# Journeys — AUDIT_20261118170047

Build: `ada9c7f5d90d4d61e78627da2765cbe14004cbc4` · Base: https://influrios.com

## Verdict inputs

Critical mutating journeys (J04–J15, J16 checkout, J22–J23 delivery) are **Blocked** pending isolation/mail-sink confirmation. Read-only navigation, login, pricing visual, and centered-popup checks ran against the live deployment.

## Journey status

| ID | Title | Functional | Integration | Notes |
|----|-------|------------|-------------|-------|
| J01 | Signup + email verification | Blocked | — | BLK-MAIL-SINK; public signup route captured |
| J02 | Login / reset / session | Partial Pass | L2 | Role logins Pass; invalid login Pass; reset mail Blocked |
| J03 | Profile / discovery | Pass (read-only) | L1/L2 | Dashboard/discover/card routes captured |
| J04 | Create/edit/publish request | Blocked | — | BLK-ISOLATION; list+New Request popup geometry Pass |
| J05 | Invite/accept | Blocked | — | BLK-MAIL-SINK |
| J06 | Response review | Blocked | — | BLK-ISOLATION |
| J07 | Delete unaccepted | Blocked | — | BLK-ISOLATION |
| J08 | Withdraw accepted | Blocked | — | BLK-ISOLATION |
| J09 | Protect signed/funded | Blocked | — | BLK-ISOLATION |
| J10 | Prepare agreement | Blocked (mutating) | L1 | Contracts lists captured |
| J11 | Dual sign | Blocked | — | In-app signing primary (admin copy); mutating Blocked |
| J12 | Signing failures | Blocked | — | |
| J13 | Collab checkout | Blocked | — | Stripe Sandbox labeled in admin |
| J14 | Milestone revise/approve | Blocked | — | |
| J15 | Payout release | Blocked | — | Airwallex disabled; Stripe Collaboration enabled |
| J16 | Sub purchases | Blocked (mutating) | L1 | Pricing Monthly/Annual visual Pass; existing AUDIT subs visible |
| J17 | Subscriber changes | Blocked | — | |
| J18 | Discounts | Blocked (mutating) | L1 | Admin discounts surface opened |
| J19 | Tax config | Blocked (mutating) | L1 | Tax edit popup centered Pass |
| J20 | Quote→charge | Blocked | — | |
| J21 | Cross-screen consistency | Pass (limited) | L2 | Business shell surfaces captured; no main-journey entity IDs |
| J22 | Messaging | Blocked (send) | L1 | Messages route opened |
| J23 | Notifications lifecycle | Blocked | — | BLK-MAIL-SINK; SMTP Ready |
| J24 | Permissions | Not tested (fixture gap) | — | No business contract deep link on list |
| J25 | Admin accounts/access | Pass (read-only) | L1/L2 | Accounts/access routes + view popup centered |
| J26 | Plans/config | Pass (read-only) | L1 | Plans edit popup centered |
| J27 | CMS/queues | Pass (read-only) | L1 | Homepage + jobs opened; retry not executed |
| J28 | AI/matching | Pass (inventory) | L1 | Admin AI + matching pages opened |
| J29 | Remaining routes | Pass (inventory opens) | L1 | Public+role inventories |
| J30 | Visual popup checklist | Pass (sampled) | L1 | Business/admin/influencer dialogs centered desktop; business mobile full-bleed |
| AGENCY | Agency workflow | N/A | — | Deferred; /agency + admin/agency inventoried |

## Recordings

| File | Role |
|------|------|
| recordings/admin-desktop-nav.webm | admin-desktop-nav.webm |
| recordings/business-desktop-nav.webm | business-desktop-nav.webm |
| recordings/influencer-desktop-nav.webm | influencer-desktop-nav.webm |

Screenshot alone ≠ completed mutating journey. Blocked rows are intentional.
