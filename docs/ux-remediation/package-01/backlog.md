# Package 1 — Implementation backlog (tasks only)

No code in this design phase. Tasks for after Ola accepts Package 1.

| ID | Task | Surfaces / code touchpoints (hints) | Depends | Acceptance |
|----|------|-------------------------------------|---------|------------|
| **P1-T1** | Single open-invitation projection (marketplace + team invited/PENDING) | `loadCreatorHome` attention / `pendingInvitations`; hub `applicationIsInvitation` + team members; Collaborations badge invite portion | — | DB1 |
| **P1-T2** | Single payout-readiness projection; conditional setup reminder | `home.payoutReady`; hub `payout.readiness`; earnings Receive payments; Earnings badge (`!ready && activeCollabs>0`) | — | DB2 · INV-C-014 · INV-N-004 |
| **P1-T3** | Single active-collaboration membership filter home ↔ hub | Home Active card; hub Active status/tab | — | DB3 |
| **P1-T4** | Team invitation detail: respond CTAs when pending; forbid dead-end copy pair | `/collaboration/team/[id]` gating + copy | — | DB4 (INV-DC-015) |
| **P1-T5** | Completing invite response clears attention + invite counts + action-required notice | Home, hub, badges, notification centre | P1-T4 | DB4 (INV-DC-012) |
| **P1-T6** | Preserve unread-open → bell; unread ≠ action-required | Notification centre `?open=`, bell aria-label | — | DB5 |
| **P1-T7** | Regression: refresh + re-login keep agreed counts | account-shell badges | P1-T1…T3 | DB6 |
| **P1-T8** | Authenticated mobile More drawer — full destinations + badges | `account-shell` mobile chrome | — | MOB1 |
| **P1-T9** | Business projection discipline (badge ↔ attention) | BUSINESS_NAV badges; `/business/home`; `/collaboration/business` | — | Business regression |
| **P1-T10** | Tests: home invites === hub invites; Ready ⇒ no setup banner ⇒ badge 0; pending team ⇒ CTAs present | Playwright / unit against projections | T1–T5 | DB1–DB4 |
| **P1-T11** | Docs: destination page explains Collaborations / Earnings badges | Hub Overview widget; Earnings Receive payments | T1–T2 | Badge explainability |

### Explicitly not in this backlog

- Live deposit / withdraw / fund paths  
- Agency product  
- Package 2 popup field schemas  
- Admin job recovery UI depth (Package 5)  
- Redesigning the influencer card
