# Process map

> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

**Phase A · IPS-18** · Code `main` @ `40b6288`  
Each process: **start → roles → prerequisites → actions → records → notifications → destinations → terminal outcome**.  
Linked inventory: [inventory.md](./inventory.md). Matrix seed: [coverage-matrix.md](./coverage-matrix.md).

**Global constraints:** Live collab deposits closed (`journey_funding` / INV-C-001). Agency product Explicitly deferred (INV-AG-*, INV-A-080/081); exposed destinations still checked in Phase B. Desktop **and** mobile required for UI processes in Phase B.

---

## P-01 Signup (influencer / member)

| Field | Detail |
|-------|--------|
| Start | Guest opens `/signup` or `/register` or Join→`/claim` |
| Roles | Public → new CREATOR (or generic member) |
| Prerequisites | Valid email; not locked out |
| Actions | INV-A-001 register → optional claim draft path INV-A-012…015 |
| Records | `User` / account; claim draft if claim flow |
| Notifications | INV-E account.verify / claim verify; INV-J-002/003 |
| Destinations | `/account/verify` or claim verify → home via `accountDestination` |
| Terminal | Account created; email unverified until P-02 |

## P-02 Email verification & password recovery

| Field | Detail |
|-------|--------|
| Start | Post-signup prompt or `/account/verify`; forgot password `/account/reset` |
| Roles | Account holder |
| Prerequisites | Pending verification code / reset token |
| Actions | INV-A-004 verify/resend; INV-A-005 reset; INV-A-006 set password |
| Records | Verified flag; password hash; invitation/reset events |
| Notifications | account.verify, account.reset, account.password_changed |
| Destinations | Dashboard / intended `next` |
| Terminal | Verified session **or** password updated |

## P-03 Business signup & terms

| Field | Detail |
|-------|--------|
| Start | `/business` CTA → business register |
| Roles | Public → BUSINESS |
| Prerequisites | Company details; accept business terms (INV-A-011) |
| Actions | INV-A-010 register business |
| Records | Business account + workspace |
| Notifications | account.welcome_business |
| Destinations | `/business/home` |
| Terminal | Business account active; terms accepted |

## P-04 Onboarding & setup reminders

| Field | Detail |
|-------|--------|
| Start | First login to `/creator` or `/business/home` |
| Roles | Influencer / Business |
| Prerequisites | Authenticated |
| Actions | Follow INV-M-018 reminders: verify, publish, social, payout |
| Records | Profile completeness flags |
| Notifications | In-app reminders only until actions fire other emails |
| Destinations | `/account/verify`, `/dashboard`, `/dashboard/social`, `/creator/earnings#payouts` |
| Terminal | Reminders cleared when each task complete |

## P-05 Profiles (influencer & business)

| Field | Detail |
|-------|--------|
| Start | Influencer: `/dashboard` tabs; Business: `/business/profile` |
| Roles | CREATOR / BUSINESS |
| Prerequisites | Session; optional KYC for trust features |
| Actions | INV-A-016…019, 023–024; specialties, facets, media, publish |
| Records | Creator profile / business profile; public card when published |
| Notifications | None required on every save |
| Destinations | Public `/c/[slug]` when published; Discover listing |
| Terminal | Profile saved; published or unpublished |

## P-06 Social connections

| Field | Detail |
|-------|--------|
| Start | `/dashboard/social` or `/settings/connections` |
| Roles | Influencer |
| Prerequisites | Social providers configured in `/admin/social` |
| Actions | INV-A-020 connect/refresh/disconnect; OAuth INV-I-005; Meta webhook INV-I-004 |
| Records | Social connection rows; sync metrics |
| Notifications | Ops/errors in UI |
| Destinations | Return to social panel |
| Terminal | Connected network listed **or** disconnected |

## P-07 Discovery & shortlist

| Field | Detail |
|-------|--------|
| Start | `/discover`, `/categories`, public card overlay INV-P-001 |
| Roles | Guest, Business, Influencer |
| Prerequisites | `public_pages_live` for live vs demo (INV-C-008); published influencers |
| Actions | Search/filter; open card; business shortlist INV-A-035; save listing INV-A-027 |
| Records | Shortlist / saved listing |
| Notifications | None |
| Destinations | Card modal or `/c/[slug]`; invite/request flows |
| Terminal | Influencer discovered; optional shortlist entry |

## P-08 Invitations (platform & collaboration)

| Field | Detail |
|-------|--------|
| Start | Admin `/admin/invitations` **or** business invite creators INV-A-038 |
| Roles | Admin, Business → Influencer |
| Prerequisites | Email; template; optional expiry |
| Actions | Send invite; influencer INV-A-030/031 accept/decline on `/invite/[token]` or inbox |
| Records | Invitation + events; application/participation |
| Notifications | invite.* emails; INV-J-001; follow-up sweep INV-J-020 |
| Destinations | Claim/login → inbox / hub invitations tab |
| Terminal | Accepted, declined, expired, or follow-up sent |

## P-09 Collaboration requests (business)

| Field | Detail |
|-------|--------|
| Start | `/collaboration/business` Requests tab → New request popup |
| Roles | Business |
| Prerequisites | Terms accepted; `collab_os_v1` for hub UX |
| Actions | INV-A-032–034 create/edit/publish; INV-A-041 close/delete (gated if signed/funded INV-C-015) |
| Records | Campaign brief / marketplace request |
| Notifications | Invite path if influencers invited |
| Destinations | Request detail popup/route; Opportunities for applications |
| Terminal | Draft / Open / Closed / Cancelled |

## P-10 Applications & selection

| Field | Detail |
|-------|--------|
| Start | Influencer applies (INV-A-026/028) or responds to invite |
| Roles | Influencer ↔ Business |
| Prerequisites | Open request |
| Actions | Apply; business transition application INV-A-039/045; withdraw INV-A-040 |
| Records | Application status transitions |
| Notifications | invite.accepted/declined; collab inbox tasks |
| Destinations | `/collaboration/applications/[id]`; Opportunities applications view |
| Terminal | Selected, rejected, withdrawn, or expired (INV-J-017) |

## P-11 Contracts preparation

| Field | Detail |
|-------|--------|
| Start | `/collaboration/contracts` or wizard `/collaboration/contract` |
| Roles | Business (prepare); both parties review |
| Prerequisites | Selected participant; templates; optional AI tailor INV-C-009 |
| Actions | INV-A-049 wizard draft/send; templates view; INV-A-053 discounts on quote |
| Records | Contract draft / quote; commercial snapshot |
| Notifications | contract.sign, contract.progress, contract.quote_expiring |
| Destinations | Agreement dialog INV-P-003; inbox review_contract |
| Terminal | Draft ready to sign **or** quote expired (INV-J-021) |

## P-12 Signing

| Field | Detail |
|-------|--------|
| Start | Agreement detail / dialog “Sign” |
| Roles | Business + Influencer (both sides) |
| Prerequisites | Sent agreement; native or DocuSign provider |
| Actions | INV-A-050 native sign; DocuSign webhook INV-I-003; admin advance INV-A-095 |
| Records | Signature statuses; envelope events |
| Notifications | contract.signed_*, declined, voided, reminder |
| Destinations | Signed agreement; fund CTA |
| Terminal | Fully signed **or** declined/voided |

## P-13 Funding (collaboration deposits)

| Field | Detail |
|-------|--------|
| Start | Fund signed agreement INV-A-052 → `/payments/checkout/[id]` |
| Roles | Business pays; providers confirm |
| Prerequisites | Signed agreement; **`journey_funding` on** for new deposits — **currently closed** |
| Actions | INV-A-056/057 checkout/deposit; webhooks INV-I-001/002 |
| Records | Funding/deal ledger; provider events |
| Notifications | funding.*; funding_required/successful/failed |
| Destinations | Payments panel; workroom when held |
| Terminal | **Blocked/closed** on live for new deposits; sandbox may simulate. Terminal when open: Held / Failed / Expired |

## P-14 Deliverables submission

| Field | Detail |
|-------|--------|
| Start | Workroom `/collaboration/work/[fundingId]` or inbox submit_delivery |
| Roles | Influencer |
| Prerequisites | Funded/active milestone |
| Actions | INV-A-058 submit + file upload (COR-20–23 retained); INV-A-069 own-milestone path |
| Records | Milestone submitted; deliverable files INV-D-001 |
| Notifications | milestone.submitted; INV-N-013; inbox review_delivery for business |
| Destinations | Workroom review hub |
| Terminal | Submitted awaiting review |

## P-15 Review & approval

| Field | Detail |
|-------|--------|
| Start | Business workroom review |
| Roles | Business → both |
| Prerequisites | Submitted milestone; review window |
| Actions | INV-A-060 approve; INV-A-061 approve+release; auto-approve sweep INV-J-010 |
| Records | Milestone approved; usage rights pending until release rules |
| Notifications | milestone.approved / auto_approved; INV-N-016/017 |
| Destinations | Payments / payout path |
| Terminal | Approved (manual or auto) |

## P-16 Revisions

| Field | Detail |
|-------|--------|
| Start | Business “Request changes” (review=changes) |
| Roles | Business → Influencer |
| Prerequisites | Submitted milestone; revision permitted |
| Actions | INV-A-059 request revision; influencer resubmit P-14 |
| Records | Revision note; milestone back to in-progress/submitted |
| Notifications | milestone.revision; INV-N-015 |
| Destinations | Influencer workroom |
| Terminal | Resubmitted or disputed |

## P-17 Cancellation & settlement

| Field | Detail |
|-------|--------|
| Start | Request cancellation INV-A-066 on payments/work |
| Roles | Business / Influencer / Admin |
| Prerequisites | Funding awaiting/held/payment-risk; jurisdiction allows |
| Actions | Cancellation matrix + settlement proposal; INV-A-067 accept/question/dispute settlement |
| Records | Cancellation case; frozen milestone allocation |
| Notifications | cancellation.*; collaboration_cancelled |
| Destinations | Settlement tab; admin trust if disputed |
| Terminal | Completed cancellation **or** waiting payout / disputed |

## P-18 Withdrawal (participation / prefund)

| Field | Detail |
|-------|--------|
| Start | Business withdraw participant INV-A-040 **or** cancel prefund INV-A-063 |
| Roles | Business |
| Prerequisites | Pre-sign or prefund rules; not protected signed/funded delete |
| Actions | Withdraw / cancel prefund |
| Records | Participation withdrawn; funding cancelled |
| Notifications | Context-specific collab emails |
| Destinations | Business collaborations lists |
| Terminal | Participant removed **or** prefund cancelled |

## P-19 Refunds

| Field | Detail |
|-------|--------|
| Start | Approved refund execution INV-A-068; dispute resolution may trigger |
| Roles | Admin / system after settlement |
| Prerequisites | Provider-confirmed refundable balance |
| Actions | Execute refund; ledger advance |
| Records | Refund entries; provider events |
| Notifications | refund.*; INV-N-028 |
| Destinations | Admin marketplace/finance; party payments |
| Terminal | Refund completed (business/influencer notices) |

## P-20 Payouts

| Field | Detail |
|-------|--------|
| Start | After approval/release; influencer payout setup |
| Roles | Influencer, Admin, providers |
| Prerequisites | Payout method / Connect (INV-C-005); release rules |
| Actions | Release via marketplace; retries INV-J-014; Connect INV-A-075 |
| Records | Payout ledger; earnings panel |
| Notifications | payout.*; INV-N-018…022; payout.ready |
| Destinations | `/creator/earnings`, `/payments`, admin marketplace |
| Terminal | Payout completed, failed, returned, or retrying |

## P-21 Subscriptions (plans)

| Field | Detail |
|-------|--------|
| Start | `/pricing` / `/billing` / `/business/billing` / `/business/plans` |
| Roles | Influencer or Business subscriber |
| Prerequisites | Stripe prices configured; tax rules |
| Actions | INV-A-070…075 checkout, interval change, portal |
| Records | Subscription; billing activity |
| Notifications | billing.paid/failed/renewal/cancel_scheduled/ended; INV-J-022 |
| Destinations | success/cancel pages; account billing tab |
| Terminal | Active subscription, scheduled change, or ended |

## P-22 Discounts

| Field | Detail |
|-------|--------|
| Start | Checkout apply code **or** admin `/admin/payment-settings?section=discounts` |
| Roles | Member / Admin |
| Prerequisites | Valid code; interval rules (annual vs monthly) |
| Actions | Apply at billing; admin create/edit codes INV-A-088; collab quote discounts INV-A-053 |
| Records | Discount reservation / redemption |
| Notifications | Reflected in checkout/invoice |
| Destinations | Checkout total; admin discounts list |
| Terminal | Discount applied **or** validation error |

## P-23 Invoices & downloads

| Field | Detail |
|-------|--------|
| Start | After paid subscription or from portal |
| Roles | Subscriber |
| Prerequisites | Stripe invoice exists |
| Actions | Open portal INV-A-074; hosted invoice/PDF INV-D-005; in-app download INV-D-006 (prior gap COR-24) |
| Records | Invoice objects at provider |
| Notifications | billing.paid may include invoice refs |
| Destinations | Stripe hosted page / portal |
| Terminal | Invoice viewed or downloaded |

## P-24 Messages

| Field | Detail |
|-------|--------|
| Start | `/creator/messages` (and collab message surfaces) |
| Roles | Influencer ↔ Business (thread parties) |
| Prerequisites | Thread exists (from collab/inquiry) |
| Actions | INV-A-077 reply + attachment |
| Records | Message thread |
| Notifications | In-app; contract.message when agreement-threaded |
| Destinations | Conversation popup INV-P-010 |
| Terminal | Message delivered; empty/error/retry states in Phase B |

## P-25 Mentorship (adjacent)

| Field | Detail |
|-------|--------|
| Start | `/mentorship` |
| Roles | Mentor / mentee |
| Prerequisites | `paid_mentoring` for paid path INV-C-007 |
| Actions | INV-A-078 become/request/respond/cancel; payment webhooks |
| Records | Mentorship session |
| Notifications | Payment confirmations via billing/marketplace webhooks |
| Destinations | Mentorship page status |
| Terminal | Accepted, cancelled, or paid confirmed |

## P-26 Trust & disputes

| Field | Detail |
|-------|--------|
| Start | Workroom/payments open dispute INV-A-064/079; `/trust`; admin `/admin/trust` |
| Roles | Parties + Admin |
| Prerequisites | Active funding/milestone context |
| Actions | Open dispute; add evidence; SLA sweep INV-J-012; admin ledger |
| Records | Dispute case |
| Notifications | dispute.*; INV-N-025/026/033 |
| Destinations | Trust UI; admin trust |
| Terminal | Resolved, overdue reminder, or escalated |

## P-27 Admin configuration workflows

Map each admin module as a configuration process (same schema). Phase B executes per module.

| ID | Module | Entry | Primary actions | Terminal |
|----|--------|-------|-----------------|----------|
| P-27a | CMS content | banners, homepage, landings, FAQ, stats, cards, value-prop | INV-A-100 save/preview | Content live |
| P-27b | Accounts | accounts, business-accounts, admin-users | INV-A-082/083 edit | Account updated |
| P-27c | Access levels | `/admin/access` | INV-A-083 | Permissions saved |
| P-27d | Invitations | `/admin/invitations` | INV-A-084 | Invite sent |
| P-27e | Guest gates | `/admin/guests` | INV-A-101 | Gate saved |
| P-27f | Plans & features | `/admin/plans` | INV-A-086 | Plan/entitlement saved |
| P-27g | Billing activity | `/admin/billing` | INV-A-087 inspect | Viewed |
| P-27h | Payment settings | providers/roles/routes/fees/tax/discounts/audit | INV-A-088/089 | Setting saved |
| P-27i | Marketplace | listings, ledger, settings | INV-A-090 | Ledger ops done |
| P-27j | Matching | `/admin/matching` | INV-A-091 | Match requested/handled |
| P-27k | Collab ops / deals | collaborations, deals, collaboration-ops | INV-A-092 | Status advanced |
| P-27l | Trust | `/admin/trust` | INV-A-093 | Dispute ledger updated |
| P-27m | KYC | `/admin/kyc` | INV-A-094 | KYC reviewed |
| P-27n | Signing | `/admin/signing` | INV-A-095 | Provider saved / status advanced |
| P-27o | Contracts admin | `/admin/contracts` | INV-A-096 | Contract ops |
| P-27p | Social / Search / AI | social, search, ai | INV-A-097 | Integration configured |
| P-27q | Legal | `/admin/legal` | publish + INV-D-004 export | Doc live / CSV |
| P-27r | Short links / referrals | short-links, referrals | INV-A-100 | Link/referral saved |
| P-27s | Mail | mail, templates, health | INV-A-098 | SMTP/test/template published |
| P-27t | Jobs | `/admin/jobs` | INV-A-099 / INV-J-024 | Job succeeded/failed |
| P-27u | Taxonomy | `/admin/taxonomy` | INV-A-100 | Taxonomy saved |
| P-27v | Agency CMS | `/admin/agency` | INV-A-085 | CMS saved (not member Agency product) |
| P-27w | Intelligence / finance | intelligence, finance | INV-A-102 + exports | Report downloaded |
| P-27x | Setup | `/admin/setup` | bootstrap | Setup complete |

## P-28 Consistency surfaces (cross-cutting)

After every state-changing action in Phase B, verify immediately and after reload / navigation / re-login:

| Surface | Inventory |
|---------|-----------|
| Role dashboard | `/creator`, `/business/home` |
| Sidebar badges | Account shell nav |
| Notification bell | INV-M-017 / INV-N-001 |
| Action inbox | INV-R-057 / INV-N-002 |
| Lists & detail popups | Hub, business, contracts, payments |
| Related admin screens | Matching module under P-27* |
| Email sink | Mailpit / delivery log INV-I-019 |

---

## Process count

| Item | Count |
|------|------:|
| Primary processes P-01…P-28 | **28** |
| Admin sub-workflows P-27a…P-27x | **24** |
| Kickoff-required topics covered | signup, onboarding, profiles, social, discovery, invitations, requests, contracts, signing, funding, deliverables, review, revisions, cancellation, withdrawal, refunds, payouts, subscriptions, discounts, invoices, messages, admin configuration |

## Prior journey crosswalk (evidence only)

| Process | Prior J* (e2e-audit) | Note |
|---------|----------------------|------|
| P-01/02 | J01–J02 | Retained Pass |
| P-05 | J03 | Partial COR-13 |
| P-09–11 | J04–J12 | Retained |
| P-13–15 | J13–J15 | Funding/payout caveats; deposits now closed |
| P-14/16 | J14 + #536 | COR-20–23 deliverables — not full platform |
| P-21–23 | J16–J20 | Partial annual/discount edges |
| P-24 | J22 | Depth/retry not fully executed |
| P-27* | J25–J28 | Partial admin |
| — | J29–J30 | Nav/chrome |

Do not treat prior Pass as closing this reopen.
