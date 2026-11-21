# Package 1 — Implementation backlog (tasks only)

No code in this design phase. Tasks for after Ola accepts Package 1.

| ID | Task | Touchpoints (hints) | Depends | Acceptance |
|----|------|---------------------|---------|------------|
| P1-T1 | Invitation projections: *waiting for your reply* (turn = invitee, incl. business replied) and *open* (marketplace + team) per master-spec §1 | `loadCreatorHome`, hub `applicationIsInvitation`, team members, `sidebar-badges` | — | DB1 |
| P1-T2 | Six-state payout readiness resolver (independent of earnings emptiness) used by earnings, home, hub, badge; saved account ≠ Ready; last-known fallback; “Status unavailable” when no history; no unsupported timing/email copy | `payout-readiness.ts`, `receive-payments-checklist.ts` (today 3 states), Earnings badge | — | DB2, DB2a–e |
| P1-T3 | Single active-collaboration filter home ↔ hub | Home Active card; hub Active | — | DB3 |
| P1-T4 | Invitation popup states + actions per master-spec §2.2/§4 (marketplace + team); remove dead-end copy pair | `invitation-review.tsx`, `/collaboration/team/[id]` | — | DB4, DB4a |
| P1-T5 | Clear attention/badge/action-required on persisted transition (notices kept, read state unchanged); timeout → “couldn't confirm” + **idempotency record lookup** (saved / rejected / processing / unable to confirm); one key per logical submission bound to actor + invitation + payload hash; draft locked until saved or rejected; same key only for retries of an unresolved submission; concurrent withdrawal; no optimistic decrement | `actionRespondToInvitation`, `actionRespondTeamProposal`, notification centre | P1-T4 | DB4, DB4b |
| P1-T6 | Preserve unread-open → bell; action-required independent | Notification centre | — | DB5 |
| P1-T7 | Regression: refresh / re-login / viewport | account-shell badges | T1–T3 | DB6 |
| P1-T8 | Mobile fixed four-slot nav bar + More drawer (both roles); no horizontal scroll | `account-shell` mobile | — | MOB1 |
| P1-T9 | Complete business dashboard (attention popups, summaries, recent collaborations, side cards, states); Contracts badge | `/business/home`, BUSINESS_NAV badges | — | DB7 |
| P1-T10 | Tests: projections equal across surfaces; six payout states; invitation transitions incl. concurrent withdrawal | Playwright + unit | T1–T5, T9 | DB1–DB7 |
| P1-T11 | Destinations explain their badges | Hub, Earnings, Contracts | T1–T2 | badge explainability |
| P1-T12 | Action inbox dedupe by task identity; completion keeps notice history and read state | `action-inbox-load`, notice aggregation | — | INB1 |
| **P1-D1** | **Defect:** persist `turn` (invitee / business / none), `interestRecorded` and `openQuestion` per invitation, changed only by actions, never by reads; server enforces the master-spec §2.2b action matrix (incl. follow-up exception); business answer sets turn = invitee only when interest isn't recorded; add NEGOTIATING → RESPONDED (interest after an answer) without accepting work | `APPLICATION_TRANSITIONS`, `inviteeResponsePlan`, invitation projections | — | DB4a, DB4c, DB4d |
| P1-T13 | Customer terminology “Influencer” in member nav/CTAs/placeholders | `account-shell` BUSINESS_NAV, search placeholder | — | TERM1 |
| P1-T14 | Home card uses live `InfluencerCardView`, proportional scaling, full content on mobile | `/creator` card column | — | CARD1 |
| P1-T15 | Visual parity check: no serif, tokens/icons per master-spec §0 | shared components | — | VIS1 |

Release itself (frozen allocations, two legs, partial success, idempotency, ledger) is **not** Package 1: see master-spec §13 (payment remediation / Package 5).

### From the IPS-44 isolated test run (#539 `execution/r5-isolated-package1-results.md`)

| ID | Task | Touchpoints | Acceptance |
|----|------|-------------|------------|
| P1-AUD-01 | Clear Action required on notices when an invitation is withdrawn/expired | notification centre filters | DB5, AUD1 |
| P1-AUD-02 | Withdrawal: send withdrawal template (not `invite.collaboration`) + in-app notice | `actionWithdrawParticipation` | AUD1 |
| P1-AUD-03 | Expire at Respond-by deadline; treat past-deadline as expired in projections | `sweepExpiredMarketplaceApplications`, invitation projections | DB1, AUD1 |
| P1-AUD-04 | List team invitations in hub Invitations and action inbox | hub list, `action-inbox-load` | DB1, INB1 |
| P1-AUD-05 | Closed team proposal: all members see “This invitation is closed” | `/collaboration/team/[id]` | DB4 |
| P1-AUD-06 | In-app notice for revision requested / approved / auto-approved; influencer attention + badge include revision tasks | `notifyCollabFundingEvent`, sidebar badges | DB5, AUD1 |
| P1-AUD-07 | Inbox rows name collaboration + milestone; clear on auto-approval | `action-inbox-load` | INB1 |
| P1-AUD-08 | **Decided:** separate delivery approval from release (master-spec §2.2). Approve persists and clears the review task when authorized + valid version + valid state, even with payout setup incomplete; release waits for readiness + payment controls; UI “Approved · payout setup required”; same for auto-approval | `payments/standard-actions.ts`, auto-approval sweep, workroom copy | AUD2 |
| P1-AUD-09 | Business Collaborations badge counts review tasks, not collaborations | `sidebar-badges` | §3 |
| P1-AUD-10 | Invitation **detail page** offers Accept · Decline · Withdraw to the invitee; must follow the same §2.2b matrix as the popup (one rule set per invitation, server-enforced) — IPS-45 INV-A-045 | `/collaboration/applications/[id]` | DB4d |
| P1-AUD-11 | Show who acts next after the **business** accepts and after signature, per master-spec §2.2c: influencer “Accepted · {Business} is preparing the agreement” (no task) → “Review and sign agreement” (task) → “Agreement signed. {Business} handles the next step.”; business “Prepare agreement” (task; replaces the response-review task on Accept, count unchanged, clears when sent) → **signer-specific signing tasks: each party with a pending signature has a sign task; a signed party sees “Waiting for {other party} to sign”; a task clears only on that party's own signature** → “Agreement signed” with Fund collaboration only when funding is available, else “Funding isn't available for this collaboration yet”. No payment promises — IPS-45 INV-A-045, INV-N-010T | home, hub, contracts, `/collaboration/applications/[id]` | DB8 |
| P1-T16 | Shared example records as test fixtures (master-spec §3.1): one seed drives home, hub, inbox, notifications, badges and business dashboard tests | e2e seed, Playwright | DB9 |
| P1-T17 | Business Accept persists before agreement preparation; preparation failure → “Accepted · agreement not sent” + Prepare agreement; popup + direct route | `actionAcceptApplication`, agreement draft entry | DB10 |
| P1-T18 | Nav active-item rule (drawer destinations highlight More; Notifications highlights nothing); hub mobile keeps all tabs; Open/Review on mobile rows | `account-shell`, hub, inbox | MOB1 |
| P1-T19 | Signed-out deep link keeps a same-origin return target; wrong role separate | auth middleware, login `next` | §9 |
| P1-T20 | Withdrawal panel shows the recorded reason; team proposal closed after acceptance panel | invitation popup / detail, team proposal page | DB4, AUD1 |
| P1-AUD-12 | Bell count and the notice's Unread label update immediately when a notice is opened and closed (today they stay stale until the next full page load) — IPS-46 INV-P-019 | notification centre, account shell bell | DB5 |

Not in this backlog: live deposit/withdraw/fund paths · Agency · Package 2 field schemas · admin ledger/reconciliation (Package 5) · card redesign.
