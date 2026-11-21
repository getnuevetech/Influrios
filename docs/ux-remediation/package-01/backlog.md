# Package 1 — Implementation backlog (tasks only)

No code in this design phase. Tasks for after Ola accepts Package 1.

| ID | Task | Touchpoints (hints) | Depends | Acceptance |
|----|------|---------------------|---------|------------|
| P1-T1 | Invitation projections: *waiting for your reply* and *open* (marketplace + team) | `loadCreatorHome`, hub `applicationIsInvitation`, team members, `sidebar-badges` | — | DB1 |
| P1-T2 | Six-state payout readiness resolver used by earnings, home, hub, badge; saved account ≠ Ready; last-known fallback | `payout-readiness.ts`, `receive-payments-checklist.ts` (today 3 states), Earnings badge | — | DB2, DB2a–c |
| P1-T3 | Single active-collaboration filter home ↔ hub | Home Active card; hub Active | — | DB3 |
| P1-T4 | Invitation popup states + actions per master-spec §2.2/§4 (marketplace + team); remove dead-end copy pair | `invitation-review.tsx`, `/collaboration/team/[id]` | — | DB4, DB4a |
| P1-T5 | Clear attention/badge/notice on persisted transition; failure + concurrent-withdrawal handling; no optimistic decrement | `actionRespondToInvitation`, `actionRespondTeamProposal`, notification centre | P1-T4 | DB4, DB4b |
| P1-T6 | Preserve unread-open → bell; action-required independent | Notification centre | — | DB5 |
| P1-T7 | Regression: refresh / re-login / viewport | account-shell badges | T1–T3 | DB6 |
| P1-T8 | Mobile chips + More drawer (both roles) | `account-shell` mobile | — | MOB1 |
| P1-T9 | Complete business dashboard (attention popups, summaries, recent collaborations, side cards, states); Contracts badge | `/business/home`, BUSINESS_NAV badges | — | DB7 |
| P1-T10 | Tests: projections equal across surfaces; six payout states; invitation transitions incl. concurrent withdrawal | Playwright + unit | T1–T5, T9 | DB1–DB7 |
| P1-T11 | Destinations explain their badges | Hub, Earnings, Contracts | T1–T2 | badge explainability |
| P1-T12 | Action inbox dedupe by task identity | `action-inbox-load`, notice aggregation | — | INB1 |
| P1-T13 | Customer terminology “Influencer” in member nav/CTAs/placeholders | `account-shell` BUSINESS_NAV, search placeholder | — | TERM1 |
| P1-T14 | Home card uses live `InfluencerCardView`, proportional scaling, full content on mobile | `/creator` card column | — | CARD1 |
| P1-T15 | Visual parity check: no serif, tokens/icons per master-spec §0 | shared components | — | VIS1 |

Not in this backlog: live deposit/withdraw/fund paths · Agency · Package 2 field schemas · admin ledger/reconciliation (Package 5) · card redesign.
