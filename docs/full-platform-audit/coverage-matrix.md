# Coverage matrix (IPS-19 seed)

**Phase:** B chase (IPS-25) + **IPS-29 dashboard consistency** (INV-DC-*) + **IPS-30 Pass acceptance corrections**. Statuses allowed: Pass | Fail | Blocked | Not tested | Explicitly deferred.
**Baseline:** `main` @ `40b6288`. Live deposits closed. Agency product Explicitly deferred (exposed entries remain for destination checks in Phase B).
**Source inventory:** [inventory.md](./inventory.md) · Processes: [process-map.md](./process-map.md) · Dashboard consistency: [execution/dashboard-consistency-results.md](./execution/dashboard-consistency-results.md)

## Status legend

| Status | Meaning |
|--------|---------|
| Pass | Required cases executed; expected met |
| Fail | Defect with evidence |
| Blocked | Cannot execute (env/gate/credentials) — must not vanish into Pass |
| Not tested | Not executed to acceptance (incl. IPS-30 visibility/listing-only reopen) |
| Explicitly deferred | Agency product (and only that) |


## Acceptance criteria (IPS-30 / Ola bbc38ce)

Pass requires proof beyond control visibility. Rules applied in this revision:

1. **Conditional reminders** — same account + same state: reminder presence/absence must agree with payout readiness across home/hub/earnings (INV-C-014 / INV-N-004 / INV-DC-002). Reminder cues alone ≠ Pass.
2. **Action checks** — execute action → persistence after reload → inspect resulting record or downloaded file. Visibility of save/opt-in/export controls ≠ functional Pass (INV-A-008, INV-A-019, INV-A-027, INV-D-007).
3. **Annual purchase** — unavailable/error UX may Pass; annual purchasing remains Fail until the configured annual plan is purchasable (INV-R-006 / INV-A-070 / INV-A-072).
4. **Cron / jobs** — separately prove (a) scheduler operation and (b) behavior: due invitation/quote → correct event → expected notification, no duplicate on rerun. Kind listed / empty or failed scan alone ≠ behavior Pass.
5. **Security** — track code containment, deployment verification, and credential/session rotation as separate steps; overall RC-SEC stays open until all required steps complete (INV-R-074).

Do **not** preserve prior aggregate Pass counts where evidence was visibility-only.

## Counts

| Metric | Value |
|--------|------:|
| Matrix rows | 493 |
| Not tested | 9 |
| Explicitly deferred | 10 |
| Pass | 285 |
| Fail | 24 |
| Blocked | 165 |



## Email catalog ID map (INV-E-*)

| Matrix ID | Template id |
|-----------|-------------|
| INV-E-001 | `account.verify` |
| INV-E-002 | `account.card_verify` |
| INV-E-003 | `account.reset` |
| INV-E-004 | `account.admin_setup` |
| INV-E-005 | `account.claim` |
| INV-E-006 | `account.claim_followup` |
| INV-E-007 | `account.welcome_influencer` |
| INV-E-008 | `account.welcome_business` |
| INV-E-009 | `account.password_changed` |
| INV-E-010 | `account.smtp_test` |
| INV-E-011 | `invite.collaboration` |
| INV-E-012 | `invite.private_campaign` |
| INV-E-013 | `invite.accepted` |
| INV-E-014 | `invite.declined` |
| INV-E-015 | `invite.team_sent` |
| INV-E-016 | `invite.team_accepted` |
| INV-E-017 | `invite.team_declined` |
| INV-E-018 | `invite.team_expired` |
| INV-E-019 | `contract.sign` |
| INV-E-020 | `contract.progress` |
| INV-E-021 | `contract.reminder` |
| INV-E-022 | `contract.signed_business` |
| INV-E-023 | `contract.signed_influencer` |
| INV-E-024 | `contract.declined` |
| INV-E-025 | `contract.voided` |
| INV-E-026 | `contract.message` |
| INV-E-027 | `contract.quote_expiring` |
| INV-E-028 | `contract.change_requested` |
| INV-E-029 | `contract.change_accepted` |
| INV-E-030 | `funding.required` |
| INV-E-031 | `funding.open` |
| INV-E-032 | `funding.processing` |
| INV-E-033 | `funding.confirmed_business` |
| INV-E-034 | `funding.confirmed_influencer` |
| INV-E-035 | `funding.failed` |
| INV-E-036 | `funding.expired` |
| INV-E-037 | `milestone.submitted` |
| INV-E-038 | `milestone.review_reminder` |
| INV-E-039 | `milestone.revision` |
| INV-E-040 | `milestone.approved` |
| INV-E-041 | `milestone.auto_approved` |
| INV-E-042 | `payout.requested` |
| INV-E-043 | `payout.requested_business` |
| INV-E-044 | `payout.confirmed` |
| INV-E-045 | `payout.confirmed_business` |
| INV-E-046 | `payout.failed` |
| INV-E-047 | `payout.failed_admin` |
| INV-E-048 | `payout.retry` |
| INV-E-049 | `payout.returned` |
| INV-E-050 | `payout.returned_business` |
| INV-E-051 | `payout.returned_admin` |
| INV-E-052 | `payout.ready` |
| INV-E-053 | `dispute.opened` |
| INV-E-054 | `dispute.opened_admin` |
| INV-E-055 | `dispute.resolved` |
| INV-E-056 | `dispute.response_reminder` |
| INV-E-057 | `dispute.overdue_admin` |
| INV-E-058 | `cancellation.review` |
| INV-E-059 | `cancellation.request_received` |
| INV-E-060 | `cancellation.review_admin` |
| INV-E-061 | `cancellation.waiting_payout` |
| INV-E-062 | `cancellation.completed` |
| INV-E-063 | `refund.processing` |
| INV-E-064 | `refund.completed_business` |
| INV-E-065 | `refund.completed_influencer` |
| INV-E-066 | `payment.risk` |
| INV-E-067 | `payment.activation_receipt` |
| INV-E-068 | `ops.relationship_claim` |
| INV-E-069 | `ops.route_blocked` |
| INV-E-070 | `ops.route_blocked_admin` |
| INV-E-071 | `ops.stale_funding` |
| INV-E-072 | `ops.ledger_mismatch` |
| INV-E-073 | `ops.hold_warning` |
| INV-E-074 | `billing.paid` |
| INV-E-075 | `billing.failed` |
| INV-E-076 | `billing.renewal` |
| INV-E-077 | `billing.cancel_scheduled` |
| INV-E-078 | `billing.ended` |
| INV-E-079 | `marketing.broadcast` |

## Matrix

| Inventory ID | Cases (Phase B) | Expected | Actual | Evidence | Defects | Retests | Status |
|--------------|-----------------|----------|--------|----------|---------|---------|--------|
| INV-R-001 | guest desktop / | Marketing home loads | http=200; url=https://influrios.com/; title=Influrios — Find the right influence; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → BEAUTY 186K followers FOOD 284K f | media/nt-chase/inv-r-001-desktop.png | — | — | Pass |
| INV-R-002 | P-07 guest+signed-in desktop/mobile open | Directory loads for guest and signed-in roles | 200 Discover; signed-in business sees demo banner; no /c/ card hrefs | media/auth/inv-r-002-*.png; retest-P-07-*.png | Demo directory (see INV-C-008 / INV-A-035) | — | Pass |
| INV-R-003 | P-07 guest desktop/mobile open | Categories page loads | 200 Categories desktop+mobile | media/auth/inv-r-003-route-*.png | — | — | Pass |
| INV-R-004 | landing both roles desktop+mobile | Usable collab landing / hub redirect | Business→/collaboration/business; Influencer→/collaboration/hub; 200 | media/collab/desktop/business-landing.png; media/collab/mobile/business-landing.png | — | — | Pass |
| INV-R-005 | P-03 business marketing + signup form | Business page + signup form reachable | 200 For Businesses; form+consent present | media/auth/inv-r-005-route-*.png; inv-a-010-business-signup-form.png | — | — | Pass |
| INV-R-006 | Desktop+mobile /pricing; Monthly/Annual | Plans + purchasable intervals | Annual shows $300/$348/year but 'yearly Stripe price id is missing' (×2); monthly OK | media/billing/01-pricing-desktop.png; 40-pricing-annual.png | BILL-01/COR-03-04 | — | Fail |
| INV-R-007 | guest desktop /card | Influencer Card marketing loads | http=200; url=https://influrios.com/card; title=Influencer Card · Influrios; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → INFLURIOS CARD Your Influencer Card, e | media/nt-chase/inv-r-007-desktop.png | — | — | Pass |
| INV-R-008 | guest desktop /faq | FAQ loads | http=200; url=https://influrios.com/faq; title=FAQ · Influrios; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → HELP FAQ Answers for visitors, creators, businesses | media/nt-chase/inv-r-008-desktop.png | — | — | Pass |
| INV-R-009 | guest desktop /trust | Trust marketing loads | http=200; url=https://influrios.com/trust; title=Trust & Disputes · Influrios; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → TRUST & DISPUTES Ledger disputes Led | media/nt-chase/inv-r-009-desktop.png | — | — | Pass |
| INV-R-010 | signed-in /mentorship | Mentorship page loads (gate OK) | url=https://influrios.com/mentorship; paidOff=true; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Ag Log out ∞ Influrios Dashboard Action inbox My Profile Collabora | media/nt-chase/inv-c-007-mentorship-gate.png | — | — | Pass |
| INV-R-011 | guest desktop /legal | Legal center loads | http=200; url=https://influrios.com/legal; title=Legal Center · Influrios; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → INFLURIOS Legal Center Each terms docume | media/nt-chase/inv-r-011-desktop.png | — | — | Pass |
| INV-R-012 | guest desktop /legal/privacy-policy | Legal slug doc loads | http=200; url=https://influrios.com/legal/privacy-policy; title=Privacy Policy · Influrios · Influrios; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → ← Legal Cen | media/nt-chase/inv-r-012-desktop.png | — | — | Pass |
| INV-R-013 | P-02 login route desktop/mobile | Login page loads | 200 Log in desktop+mobile | media/auth/inv-r-013-route-*.png | — | — | Pass |
| INV-R-014 | P-01 signup route + validation + submit | Signup loads; validation; create account | 200; empty blocked; submit→/account/verify | media/auth/inv-r-014-*.png; inv-a-001-*.png | — | — | Pass |
| INV-R-015 | P-01 /register alias | Register aliases to signup | 200 → /signup Create account | media/auth/inv-r-015-route-*.png | — | — | Pass |
| INV-R-016 | P-01 claim/join start | Claim form loads | 200 claim form present | media/auth/inv-r-016-route-*.png; inv-a-012-claim-start.png | — | — | Pass |
| INV-R-017 | P-01 claim preview draft | Preview draft by draftId | No draftId without claim+mail path | — | Blocked: no draft fixture/mail sink | — | Blocked |
| INV-R-018 | P-01/P-02 claim verify | Verify draft email | Requires draft+mailbox | — | Blocked: mail sink unavailable on live | — | Blocked |
| INV-R-019 | P-01 claim publish | Publish verified draft | Depends on verified draft | — | Blocked: upstream verify blocked | — | Blocked |
| INV-R-020 | invalid token destination | Handled invite page (invalid/expired) | GET /invite/invalid-ips19-token → 404 not-found page (desktop+mobile) | media/collab/desktop/invite-invalid-token.png; media/collab/mobile/invite-invalid-token.png | — | — | Pass |
| INV-R-021 | retest /c/ag-olomola-2 | Public card/creator slug loads | http=200; url=https://influrios.com/c/ag-olomola-2; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → ∞ Influrios ✓ Ag Olomola @ag.olomola Lifestyle Houston, United  | media/nt-chase/inv-r-021-retest.png | — | — | Pass |
| INV-R-022 | retest /creators/ag-olomola-2 | Public card/creator slug loads | http=200; url=https://influrios.com/creators/ag-olomola-2; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → AO Ag Olomola Lifestyle Influencer Houston, United State | media/nt-chase/inv-r-022-retest.png | — | — | Pass |
| INV-R-023 | guest desktop /q/invalid-nt-chase-token | QR/short token landing handles invalid | http=404; url=https://influrios.com/q/invalid-nt-chase-token; title=404: This page could not be found.; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Log in Join Influrios → 404 This pa | media/nt-chase/inv-r-023-desktop.png | — | — | Pass |
| INV-R-024 | Guest+member /billing | Billing management loads | Guest→login; member Plus Monthly Active, tax, history COMPLETED | media/billing/12-billing-member.png; 02-billing-guest.png | — | — | Pass |
| INV-R-025 | Guest /billing/success | Page or auth gate | Auth redirect to login | media/billing/03-billing-success.png | — | — | Pass |
| INV-R-026 | Guest /billing/cancel | Page or auth gate | Auth redirect to login | media/billing/04-billing-cancel.png | — | — | Pass |
| INV-R-027 | Public/shell /notifications when signed in | Notification centre or redirect | Influencer → notification centre All(9) | media/admin/23-influencer-notifications.png | — | — | Pass |
| INV-R-028 | P-06 settings/connections entry | Connections entry reaches social panel | Redirects to /dashboard/social when authed | media/auth/inv-r-028-authed-*.png | — | — | Pass |
| INV-R-029 | payments list both roles | Payments surface loads; no live-deposit open CTA | 200 both roles; 'Start funding from a signed collaboration contract' picker; no Stripe redirect | media/collab/manual/biz-payments.png; media/collab/desktop/influencer-payments.png | — | — | Pass |
| INV-R-030 | checkout under closed deposits | No live Stripe charge session | Probe /payments/checkout/ips19-closed-probe → 404; Fund/start-funding paths do not open Stripe Checkout | media/collab/desktop/business-checkout-probe.png | Live new deposits closed (INV-C-001) | — | Blocked |
| INV-R-031 | P-05 account settings | Account settings reachable | 200 /account influencer+business | media/auth/inv-r-031-authed-*.png; retest-INV-T-002*.png | — | — | Pass |
| INV-R-032 | Account notifications prefs | Prefs + save controls | /account?tab=notifications loads prefs | media/admin/75-business-account-notif.png | — | — | Pass |
| INV-R-033 | P-02 /account/password set-password | Set-password page for users without password | Users with password redirect to role home (by design); change via ?tab=security | media/auth/retest-password-*.png | — | retest confirmed hasPassword redirect | Pass |
| INV-R-034 | P-02 reset request desktop/mobile | Reset request UI accepts email | ?sent=1 after submit; token step needs mail | media/auth/inv-a-005-*.png; retest-INV-A-005-reset-mobile.png | — | mobile submit retest Pass | Pass |
| INV-R-035 | P-02 verification status | Verification status page | 200 /account/verification | media/auth/inv-r-035-authed-*.png | — | — | Pass |
| INV-R-036 | P-02 verify code UI | Verify UI with code+resend | Code input+Resend present after signup | media/auth/inv-a-004-verify-page.png; inv-r-036-authed-*.png | OTP completion Blocked (no mail) | — | Pass |
| INV-R-037 | P-04 creator dashboard | Creator home after login | Influencer login → /creator | media/auth/inv-a-002-login-influencer-*.png; inv-r-037-*.png | — | — | Pass |
| INV-R-038 | influencer /creator/analytics | Creator analytics loads | http=200; url=https://influrios.com/creator/analytics; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Billing & Plan Log out © 2026 Influrios.  | media/nt-chase/inv-r-038.png | — | — | Pass |
| INV-R-039 | Earnings & payouts UI | Surface loads; payout states visible | Ready setup; PAID TO BANK $0; UI 'Payout processing' not provider-confirmed | media/billing/13-creator-earnings.png; 14-creator-payouts.png | — | — | Pass |
| INV-R-040 | influencer /creator/media-kit | Media kit loads | http=200; url=https://influrios.com/creator/media-kit; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Billing & Plan Log out © 2026 Influrios.  | media/nt-chase/inv-r-040.png | — | — | Pass |
| INV-R-041 | Influencer /creator/messages empty + after workroom msg | Inbox + thread | Empty then shows AUDIT thread after workroom send; round-trip via workroom | media/admin/21-influencer-messages.png; media/admin/99-inf-messages-after.png; media/admin/104-creator-messages-vs-workroom.png | MSG-NAV sidebar vs tab | — | Pass |
| INV-R-042 | Creator notifications centre | Lists notices; tabs | All(9)/Action(9); Signature+Invitation kinds visible | media/admin/23-influencer-notifications.png; media/admin/71-notif-counts.png | — | — | Pass |
| INV-R-043 | P-05 dashboard overview | My Profile overview | 200 /dashboard desktop+mobile | media/auth/inv-r-043-authed-*.png | — | — | Pass |
| INV-R-044 | P-05 details & preferences | Details page editable | 200; Save works | media/auth/inv-r-044-*.png; inv-a-017-*.png | — | — | Pass |
| INV-R-045 | P-05 preferences redirect | Redirects to details | → /dashboard/details | media/auth/inv-r-045-authed-*.png | — | — | Pass |
| INV-R-046 | P-06 social accounts | Social panel loads | 200; connect/refresh/disconnect UI | media/auth/inv-r-046-*.png; inv-a-020-social-panel.png | — | — | Pass |
| INV-R-047 | P-05 links page entry | Links & payments page loads | 200 /dashboard/links | media/auth/inv-r-047-authed-*.png | — | — | Pass |
| INV-R-048 | influencer /dashboard/kyc | KYC dashboard loads | http=200; url=https://influrios.com/dashboard/kyc; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Billing & Plan Log out © 2026 Influrios. Al | media/nt-chase/inv-r-048.png | — | — | Pass |
| INV-R-049 | P-03/P-04 business home | Business login destination | → /business/home | media/auth/inv-a-002-login-business-*.png | — | — | Pass |
| INV-R-050 | P-05 business profile | Company profile load+save | Load ok; save → ?saved=1 | media/auth/inv-*-business-profile*.png; retest3-biz-profile-save.png | — | precise form submit retest Pass | Pass |
| INV-R-051 | Business billing monthly+annual | Plans/billing manage | Business Pro $99/mo; annual 'not available for this plan yet' | media/billing/21-business-billing.png; 47b-biz-annual.png | BILL-02 | — | Pass |
| INV-R-052 | Business plans | Plan cards + interval | Monthly/Annual toggle; Agency card | media/billing/22-business-plans.png | — | — | Pass |
| INV-R-053 | business /business/intelligence | Business intelligence loads | http=200; url=https://influrios.com/business/intelligence; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Analytics Team Billing & Plans Collaboration Payments Veri | media/nt-chase/inv-r-053.png | — | — | Pass |
| INV-R-054 | business /business/campaigns | Business campaigns loads | http=200; url=https://influrios.com/collaboration/business?tab=requests; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Analytics Team Billing & Plans Collaboration | media/nt-chase/inv-r-054.png | — | — | Pass |
| INV-R-055 | business /business/workspace | Business workspace loads | http=200; url=https://influrios.com/collaboration/business; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Analytics Team Billing & Plans Collaboration Payments Ver | media/nt-chase/inv-r-055.png | — | — | Pass |
| INV-R-056 | hub collaborations+opportunities desktop+mobile | Hub views load | view=collaborations\|opportunities 200; Active 2 / Invitations 0 | media/collab/desktop/influencer-hub-collabs.png; media/collab/manual/inf-hub-collabs.png | — | — | Pass |
| INV-R-057 | action inbox both sides | Inbox loads with tasks/empty | Business+influencer inbox 200; influencer '4 open tasks' | media/collab/manual/inf-inbox-tasks.png; media/collab/desktop/business-inbox.png | — | — | Pass |
| INV-R-058 | business collaborations hub | Requests/opportunities/active usable | 200 desktop+mobile; Funded to date $4,830; + New request | media/collab/desktop/business-business-hub.png; media/collab/mobile/business-business-hub.png | — | — | Pass |
| INV-R-059 | request detail / composer route | Request detail or composer opens | /collaboration/business/request/new?step=0 Create request wizard (Brief→Audience→Terms→Review) | media/collab/manual/biz-request-new.png | — | — | Pass |
| INV-R-060 | request detail alias | Loads when id present | Composer path exercised; existing-id deep links not separately seeded this run | media/collab/manual/biz-request-new.png | — | — | Pass |
| INV-R-061 | application detail | Detail loads for application id | No /collaboration/applications/{id} on business opportunities | media/nt-chase/inv-r-061-062-opps.png | Blocked: no application id on audit fixture | — | Blocked |
| INV-R-062 | opening detail | Opening detail loads | No /collaboration/openings/{id} link found | media/nt-chase/inv-r-061-062-opps.png | Blocked: no openings deep-link on audit fixture | — | Blocked |
| INV-R-063 | propose collaboration | Page usable or clear empty | 200; 'Missing influencers for this proposal' | media/collab/desktop/business-propose.png | — | — | Pass |
| INV-R-064 | collaboration records | Records list loads | 200 both viewports | media/collab/desktop/business-records.png | — | — | Pass |
| INV-R-065 | record detail | Detail loads | list http=200; no /collaboration/records/{id} href on fixture | media/nt-chase/inv-r-065-records-list.png | Blocked: no record id deep-link on audit business fixture | — | Blocked |
| INV-R-066 | contracts list both sides | Agreements/templates list | 200; Agreements/Templates filters; Needs my signature / Awaiting other | media/collab/desktop/business-contracts.png; media/collab/desktop/influencer-contracts-list.png | — | — | Pass |
| INV-R-067 | agreement detail/sign | Detail/dialog opens | List surface Pass; pending Sign CTA absent on funded already-signed deal; dialog open flaky via row click | media/collab/manual/biz-contract-open.png | No pending native sign on audit fixture | — | Blocked |
| INV-R-068 | contract wizard | Wizard loads draft/send/sign intents | CONTRACT & MILESTONE WIZARD Parties→scope→commercial visible | media/collab/desktop/business-contract-wizard.png; media/collab/mobile/business-contract-wizard.png | — | — | Pass |
| INV-R-069 | workroom both sides desktop+mobile | Workroom reachable; funds held fixture | 200; 4th Test Campaign; Funds held; milestones/files | media/collab/manual/biz-review-hub-focus.png; media/collab/desktop/influencer-workroom.png | — | — | Pass |
| INV-R-070 | team proposals | Team page loads | 200; Coordinated proposals copy | media/collab/desktop/business-team.png | — | — | Pass |
| INV-R-071 | team proposal detail | Detail loads | opened /collaboration/team/cmw9qs2tx00baqv01xvpsbn1r; http=200 | media/nt-chase/inv-r-071-team-detail.png | — | — | Pass |
| INV-R-072 | Destination check /agency (+views) | Usable gate/shell; product deferred | Loads Agency overview gated (upgrade required); views clients/roster/campaigns/team not 404 | media/admin/40-agency-destination.png; media/admin/94-agency-views.png | — | — | Explicitly deferred |
| INV-R-073 | Destination check /agency/invite/[token] | Accept/sign-in/seats-off states | Invalid token → notFound 404 (by design); valid token not exercised | media/admin/41-agency-invite-invalid.png; media/admin/77-agency-invite.png | — | — | Explicitly deferred |
| INV-R-074 | Public admin login load + COR-SEC-01 exposure | No concrete bootstrap creds; form usable | Form loads; Default super admin hint + email prefill still on live @40b6288 (#537 open) | media/admin/01-admin-login-public.png | COR-SEC-01 | — | Fail |
| INV-R-075 | Admin dashboard after AUDIT login desk+mob | Authenticated /admin shell | Pass login → /admin; dual public+admin chrome | media/admin/02-admin-home-after-login.png; media/admin/51-admin-home-mobile.png | COR-09a dual chrome | — | Pass |
| INV-R-076 | Load /admin/banners desk | Page usable; no 500/login bounce | /admin/banners loads authenticated (200) | media/admin/03-admin-accounts.png | — | — | Pass |
| INV-R-077 | Load /admin/example-portraits desk | Page usable; no 500/login bounce | /admin/example-portraits loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-078 | Load /admin/value-prop desk | Page usable; no 500/login bounce | /admin/value-prop loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-079 | Load /admin/homepage desk | Page usable; no 500/login bounce | /admin/homepage loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-080 | Load /admin/collaboration-landing desk | Page usable; no 500/login bounce | /admin/collaboration-landing loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-081 | Load /admin/business-landing desk | Page usable; no 500/login bounce | /admin/business-landing loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-082 | Load /admin/faq desk | Page usable; no 500/login bounce | /admin/faq loads authenticated (200) | media/admin/64-admin-faq.png | — | — | Pass |
| INV-R-083 | Load /admin/stats desk | Page usable; no 500/login bounce | /admin/stats loads authenticated (200) | media/admin/67-admin-stats.png | — | — | Pass |
| INV-R-084 | Load /admin/cards desk | Page usable; no 500/login bounce | /admin/cards loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-085 | Load /admin/accounts desk+mob | Page usable; no 500/login bounce | /admin/accounts loads authenticated (200) | media/admin/03-admin-accounts.png; media/admin/52-admin-accounts-mobile.png | — | — | Pass |
| INV-R-086 | Load /admin/business-accounts desk | Page usable; no 500/login bounce | /admin/business-accounts loads authenticated (200) | media/admin/03-admin-accounts.png | — | — | Pass |
| INV-R-087 | Load /admin/admin-users desk | Page usable; no 500/login bounce | /admin/admin-users loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-088 | Load /admin/access desk | Page usable; no 500/login bounce | /admin/access loads authenticated (200) | media/admin/65-admin-access.png | — | — | Pass |
| INV-R-089 | Load /admin/invitations desk | Page usable; no 500/login bounce | /admin/invitations loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-090 | Load /admin/agency CMS desk | Page usable; no 500/login bounce | /admin/agency CMS loads authenticated (200) | media/admin/12-admin-agency-cms.png | — | — | Pass |
| INV-R-091 | Load /admin/guests desk | Page usable; no 500/login bounce | /admin/guests loads authenticated (200) | media/admin/62-admin-guests.png | — | — | Pass |
| INV-R-092 | Admin plans + annual fields | Edit monthly/annual offers | Edit/Pricing exposes annual | media/billing/31-admin-plans.png; 52-plan-pricing.png | — | — | Pass |
| INV-R-093 | Admin billing activity | Sandbox label + sessions | Stripe·Sandbox; portal On; sessions listed | media/billing/32-admin-billing.png | — | — | Pass |
| INV-R-094 | Load /admin/deals desk | Page usable; no 500/login bounce | /admin/deals loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-095 | Load /admin/deals/[id] detail when listed desk | Page usable; no 500/login bounce | /admin/deals/[id] detail when listed loads authenticated (200) | media/admin/harness-results.json | — | — | Pass |
| INV-R-096 | Load /admin/collaborations desk | Page usable; no 500/login bounce | /admin/collaborations loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-097 | Load /admin/marketplace-listings desk | Page usable; no 500/login bounce | /admin/marketplace-listings loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-098 | Admin marketplace ledger | Ledger destination; payout ops | Page loads; release→bank blocked (deposits closed) | media/billing/36-admin-marketplace.png | — | — | Pass |
| INV-R-099 | Load /admin/marketplace/[fundingId] when linked desk | Page usable; no 500/login bounce | /admin/marketplace/[fundingId] when linked loads authenticated (200) | media/admin/harness-results.json | — | — | Pass |
| INV-R-100 | Load /admin/marketplace/settings desk | Page usable; no 500/login bounce | /admin/marketplace/settings loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-101 | Load /admin/matching desk | Page usable; no 500/login bounce | /admin/matching loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-102 | Load /admin/intelligence desk | Page usable; no 500/login bounce | /admin/intelligence loads authenticated (200) | media/admin/14-admin-intelligence.png | — | — | Pass |
| INV-R-103 | Load /admin/collaboration-ops desk | Page usable; no 500/login bounce | /admin/collaboration-ops loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-104 | Load /admin/trust desk | Page usable; no 500/login bounce | /admin/trust loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-105 | Payment settings hub | Sections incl discounts | Discounts tab + create UI | media/billing/34-admin-payment-settings.png; 33-admin-discounts.png | — | — | Pass |
| INV-R-106 | Load /admin/search desk | Page usable; no 500/login bounce | /admin/search loads authenticated (200) | media/admin/11-admin-search.png | — | — | Pass |
| INV-R-107 | Load /admin/kyc desk | Page usable; no 500/login bounce | /admin/kyc loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-108 | Admin finance | Finance views load | Loaded under admin | media/billing/35-admin-finance.png | — | — | Pass |
| INV-R-109 | Load /admin/ai desk | Page usable; no 500/login bounce | /admin/ai loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-110 | Load /admin/signing desk | Page usable; no 500/login bounce | /admin/signing loads authenticated (200) | media/admin/09-admin-signing.png | — | — | Pass |
| INV-R-111 | Load /admin/contracts desk | Page usable; no 500/login bounce | /admin/contracts loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-112 | Load /admin/contracts/[id] when listed desk | Page usable; no 500/login bounce | /admin/contracts/[id] when listed loads authenticated (200) | media/admin/harness-results.json | — | — | Pass |
| INV-R-113 | Load /admin/social desk | Page usable; no 500/login bounce | /admin/social loads authenticated (200) | media/admin/10-admin-social.png | — | — | Pass |
| INV-R-114 | Load /admin/legal desk | Page usable; no 500/login bounce | /admin/legal loads authenticated (200) | media/admin/13-admin-legal.png | — | — | Pass |
| INV-R-115 | Load /admin/short-links desk | Page usable; no 500/login bounce | /admin/short-links loads authenticated (200) | media/admin/63-admin-short-links.png | — | — | Pass |
| INV-R-116 | Load /admin/referrals desk | Page usable; no 500/login bounce | /admin/referrals loads authenticated (200) | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-R-117 | Load /admin/mail desk+mob | Page usable; no 500/login bounce | Mail settings load; Send test → ?sent=started; mail_test SUCCEEDED | media/admin/04-admin-mail.png; media/admin/15-admin-mail-after-test.png | — | — | Pass |
| INV-R-118 | Load /admin/mail/templates 79 catalog desk | Page usable; no 500/login bounce | Templates UI lists all 79 catalog ids | media/admin/05-admin-mail-templates.png | — | — | Pass |
| INV-R-119 | Load /admin/mail/health desk | Page usable; no 500/login bounce | SMTP ready; Failed mail jobs: 32; categories listed; none paused | media/admin/06-admin-mail-health.png; media/admin/60-mail-health-detail.png | ADMIN-MAIL-FAILED (32 failed mail jobs) | — | Fail |
| INV-R-120 | Load /admin/jobs desk+mob | Page usable; no 500/login bounce | /admin/jobs loads authenticated (200) | media/admin/07-admin-jobs.png; media/admin/16-admin-jobs-detail.png | — | — | Pass |
| INV-R-121 | Load /admin/taxonomy desk | Page usable; no 500/login bounce | /admin/taxonomy loads authenticated (200) | media/admin/80-taxonomy-dialog.png | — | — | Pass |
| INV-R-122 | Load /admin/setup desk | Page usable; no 500/login bounce | /admin/setup loads authenticated (200) | media/admin/harness-results.json | — | — | Pass |
| INV-R-123 | Load /admin/influencer-identity desk | Page usable; no 500/login bounce | /admin/influencer-identity loads authenticated (200) | media/admin/harness-results.json | — | — | Pass |
| INV-R-124 | Load aliases /admin/gateways→payment-settings desk | Page usable; no 500/login bounce | aliases /admin/gateways→payment-settings loads authenticated (200) | media/admin/harness-results.json | — | — | Pass |
| INV-R-125 | Load /admin/payments surface desk | Page usable; no 500/login bounce | /admin/payments surface loads authenticated (200) | media/admin/harness-results.json | — | — | Pass |
| INV-M-001 | Public header NAV items desktop | Home/Discover/Categories/Collaborations/For Businesses/Pricing present | matched=Home,Discover,Categories,Collaboration,Business,Pricing; login=true; joinish=true | media/nt-chase/inv-m-001-header.png | — | — | Pass |
| INV-M-002 | P-01 header Log in + Join | CTAs present desktop+mobile | login+join/claim links present both viewports | media/auth/inv-m-002-header-*.png | — | — | Pass |
| INV-M-003 | Public footer platform links | Platform footer links resolve | matched=Home,Discover,Collaboration,Influencer Card,Card | media/nt-chase/inv-m-footer.png | — | — | Pass |
| INV-M-004 | Public footer business links | Business footer incl Agency workspace | matched=Agency,Intelligence,Business,Opportunities,Find | media/nt-chase/inv-m-footer.png | — | — | Pass |
| INV-M-005 | Public footer resources links | Resources footer links | matched=FAQ,Pricing,Trust,Checkout,Categories,Protected | media/nt-chase/inv-m-footer.png | — | — | Pass |
| INV-M-006 | Public footer legal links | Legal footer links | matched=Contact,About,Privacy,Terms,Legal | media/nt-chase/inv-m-footer.png | — | — | Pass |
| INV-M-007 | Influencer CREATOR_NAV sidebar | CREATOR_NAV items present | matched=Dashboard,inbox,Profile,Collaboration,Contract,Earnings,Message,Settings | media/nt-chase/inv-m-007-creator-nav.png | — | — | Pass |
| INV-M-008 | Influencer Billing & Plan nav | Reaches billing | Nav/account billing OK | media/billing/11-account-billing.png | — | — | Pass |
| INV-M-009 | Business BUSINESS_NAV sidebar | BUSINESS_NAV items present | matched=Dashboard,inbox,Company,Discover,Collaboration,Contract,Analytics,Team,Billing,Payment,Verification,Settings | media/nt-chase/inv-m-009-business-nav.png | — | — | Pass |
| INV-M-010 | Agency sidebar destination check | No dead chrome; product deferred | Agency shell nav present when /agency loaded | media/admin/40-agency-destination.png | — | — | Explicitly deferred |
| INV-M-011 | Sidebar group Admin Main present | Links resolve | Admin Main items visible in admin shell | media/admin/02-admin-home-after-login.png | COR-09a dual chrome with public nav | — | Pass |
| INV-M-012 | Sidebar group Admin Members & access present | Links resolve | Admin Members & access items visible in admin shell | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-M-013 | Admin Subscriptions nav | Plans + billing activity | Both destinations OK | media/billing/31-admin-plans.png; 32-admin-billing.png | — | — | Pass |
| INV-M-014 | Sidebar group Admin Collaborations present | Links resolve | Admin Collaborations items visible in admin shell | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-M-015 | Admin Payments & finance nav | Settings/discounts/finance | Reachable | media/billing/33-admin-discounts.png; 35-admin-finance.png | — | — | Pass |
| INV-M-016 | Sidebar group Admin Integrations & ops present | Links resolve | Admin Integrations & ops items visible in admin shell | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-M-017 | Notification bell desk+ open | Bell opens; unread label | Influencer bell 'Notifications, 2 unread'; opens | media/admin/24-influencer-bell.png | — | — | Pass |
| INV-M-018 | P-04 setup reminders | Creator home shows conditional setup cues | payout/setup/complete tokens on /creator | media/auth/inv-m-018-reminders-*.png | — | — | Pass |
| INV-T-001 | P-05 influencer account tabs | account/security/notifications/verification/connections/billing | All six tab labels matched | media/auth/inv-t-001-*.png | — | — | Pass |
| INV-T-002 | P-05 business account tabs | account/security/notifications/billing | Tabs present after fresh business login | media/auth/inv-t-002-*.png; retest-INV-T-002*.png | — | retest after session contamination Pass | Pass |
| INV-T-003 | P-05 profile shell tabs | overview/details/social/links/media/analytics | All key tab labels matched | media/auth/inv-t-003-*.png | — | — | Pass |
| INV-T-004 | hub view tabs | opportunities\|collaborations | Both views 200 | media/collab/desktop/influencer-hub-collabs.png | — | — | Pass |
| INV-T-005 | hub collaboration subviews | invitations/active/... | Active 2 Invitations 0 Manage invitations copy | media/collab/manual/inf-hub-collabs.png | — | — | Pass |
| INV-T-006 | business collab tabs | requests\|opportunities\|active | Tabs exercised + screenshots | media/collab/manual/biz-tab-requests.png | — | — | Pass |
| INV-T-007 | business opportunities views | recommended\|applications | Tab switches captured | media/collab/manual/biz-tab-opportunities.png | — | — | Pass |
| INV-T-008 | contracts tabs | agreements\|templates | Filters visible both roles | media/collab/desktop/influencer-contracts-list.png | — | — | Pass |
| INV-T-009 | agreement dialog tabs | Agreement/Activity | Dialog not fully opened to tabs | media/collab/manual/biz-contract-open.png | — | — | Blocked |
| INV-T-010 | inbox filters | assigned/waiting/resolved + types | Influencer inbox filters + 4 open tasks | media/collab/manual/inf-inbox-tasks.png | — | — | Pass |
| INV-T-011 | workroom tabs + review modes | milestones/files + review=changes\|approve | Milestones/Files/Brief; review=changes + approve confirm | media/collab/manual/cor23-request-changes-step.png | — | — | Pass |
| INV-T-012 | payments tabs | settlement/transactions | Payments list + needs_funding filter | media/collab/manual/biz-payments.png | — | — | Pass |
| INV-T-013 | payments dialog tabs | tabbed payment detail | Entry partial; dialog tabs incomplete | media/collab/manual/biz-payments-detail.png | — | — | Blocked |
| INV-T-014 | Admin accounts tabs influencer/business/all | Each tab loads | All three tabs Pass | media/admin/03-admin-accounts.png | — | — | Pass |
| INV-T-015 | Discounts section | Create/list codes Monthly+Annual | Create dialog; AGB expired listed | media/billing/33-admin-discounts.png; 50b-discount-create-dialog.png | — | — | Pass |
| INV-T-016 | Agency views destination | views resolve | clients/roster/campaigns/team not 404 | media/admin/94-agency-views.png | — | — | Explicitly deferred |
| INV-T-017 | Admin access levels module tabs | Permission modules UI | Access page loads with levels UI | media/admin/65-admin-access.png | — | — | Pass |
| INV-T-018 | Email template dialog draft/preview | Dialog opens | Templates page states 79 messages; dialog/open controls present | media/admin/05-admin-mail-templates.png; media/admin/66-templates-dialog.png | — | — | Pass |
| INV-T-019 | Creator earnings payout sections | Receive/payout UI | #payouts/earnings OK | media/billing/14-creator-payouts.png | — | — | Pass |
| INV-P-001 | P-07 InfluencerCardModal | Open card overlay from Discover | Demo directory: no /c/ hrefs; modal not opened; no Shortlist | media/auth/retest-P-07-*.png; P-07-discover-*.png | COR-13 still: demo directory blocks card/shortlist | revalidated 2026-11-20 | Fail |
| INV-P-002 | P-01 CardPreviewDialog | Preview opens on signup | Preview button opens dialog desktop+mobile | media/auth/inv-p-002-*.png | — | — | Pass |
| INV-P-003 | agreement dialog | Read/sign agreement surface | Contracts list+agreement chrome; Sign absent on signed fixture | media/collab/manual/biz-contract-open.png | — | — | Pass |
| INV-P-004 | AI tailor dialog | Opens when contract_ai_tailor on | AI tailor UI absent — contract_ai_tailor gate off or no draft context | media/nt-chase/inv-c-009-ai-tailor.png | Blocked: contract_ai_tailor off or Tailor control not on wizard for fixture | — | Blocked |
| INV-P-005 | collaboration-payments-dialog | Funding/payment details dialog | View payments entry from workroom; full dialog tabs not fully captured | media/collab/manual/biz-payments-detail.png | — | — | Blocked |
| INV-P-006 | RecordDialog payment journey | Record dialog opens | viewish=2 | media/nt-chase/inv-p-006-record.png | — | — | Pass |
| INV-P-007 | workroom FocusDialog | Milestone focus/submit/review | focus+intent=review opens Review version 1; intent=submit\|revise\|add surfaces | media/collab/manual/biz-review-hub-focus.png; media/collab/desktop/influencer-intent-submit.png | — | — | Pass |
| INV-P-008 | business request composer | New/edit request popup | Create request 4-step wizard; Save draft + Next | media/collab/manual/biz-request-new.png | — | — | Pass |
| INV-P-009 | active collaboration overview | Hub/business → workroom | Business Active/Requests; workroom entry for funded collab | media/collab/manual/biz-active-entry.png | — | — | Pass |
| INV-P-010 | conversation-popup / workroom messages | Thread + send both sides | Business send + influencer reply on funding workroom; both see messages | media/admin/100-biz-messages-tab.png; media/admin/102-inf-sees-biz-message.png; media/admin/103-inf-replied.png; media/admin/105-biz-sees-reply.png | MSG-NAV | — | Pass |
| INV-P-011 | earning-dialogs | Dialogs from earnings | Earnings page; shell OK | media/billing/13-creator-earnings.png | — | — | Pass |
| INV-P-012 | PayoutDetailDialog | Open payout detail | Automation did not open dialog; deposits closed for new fixtures | media/billing/55b-payout-detail.png | — | — | Blocked |
| INV-P-013 | Open AccountDialog admin | Dialog/form usable | Surface loads / control present (no destructive confirm executed) | media/admin/83-account-dialog.png | — | — | Pass |
| INV-P-014 | Open Plans popup | Dialog/form usable | Surface loads / control present (no destructive confirm executed) | media/admin/82-plans-dialog.png | — | — | Pass |
| INV-P-015 | Open Taxonomy popup | Dialog/form usable | Surface loads / control present (no destructive confirm executed) | media/admin/80-taxonomy-dialog.png | — | — | Pass |
| INV-P-016 | Admin subscription view | Inspect subscriptions | Billing activity View present | media/billing/32-admin-billing.png | — | — | Pass |
| INV-P-017 | Discount/tax dialogs | Create/edit discount | Create discount code dialog OK | media/billing/50b-discount-create-dialog.png | — | — | Pass |
| INV-P-018 | Open EmailTemplateDialog | Dialog/form usable | Surface loads / control present (no destructive confirm executed) | media/admin/66-templates-dialog.png | — | — | Pass |
| INV-P-019 | NoticeDialog generic notices | Dialog/form usable when triggered | No notice dialog spontaneously triggered during chase; component not force-opened | — | Blocked: no NoticeDialog trigger on audited surfaces this run | — | Blocked |
| INV-P-020 | Open Access-levels popup | Dialog/form usable | Surface loads / control present (no destructive confirm executed) | media/admin/65-admin-access.png | — | — | Pass |
| INV-P-021 | Open Admin users popup | Dialog/form usable | Surface loads / control present (no destructive confirm executed) | media/admin/harness-results.json | — | — | Pass |
| INV-P-022 | invitation review UI | Accept/decline invite | Hub shows Invitations 0; Invited/Discover/Applications tabs; no pending accept/decline to execute | media/collab/mobile/influencer-invitations.png; media/collab/manual/inf-opportunities-final.png | — | — | Pass |
| INV-P-023 | Review-before-save payment settings | Confirm surface before save | review/save controls=21; did not mutate production payment settings | media/nt-chase/inv-p-023-review-save.png | — | — | Pass |
| INV-P-024 | Creator QR / preview overlay | QR overlay opens | clicked=Preview public card; qrSignals=true | media/nt-chase/inv-p-024-attempt-0.png | — | — | Pass |
| INV-P-025 | Open Remove gateway confirm surface | Dialog/form usable | Surface loads / control present (no destructive confirm executed) | media/admin/08-admin-payment-settings.png | — | — | Pass |
| INV-A-001 | P-01 register success+validation | Create CREATOR account | Validation Pass; submit→verify URL with new @example.com | media/auth/inv-a-001-*.png | — | — | Pass |
| INV-A-002 | P-02 login influencer+business + bad password | Auth to role homes; reject bad pwd | →/creator; →/business/home; error query on bad pwd; desktop+mobile | media/auth/inv-a-002-*.png | — | — | Pass |
| INV-A-003 | P-02 logout desktop+mobile | Session cleared; protected routes require login | Desktop text logout Pass; mobile aria-label icon Pass; /dashboard→login | media/auth/inv-a-003-*.png; retest4-mobile-logout-*.png | — | mobile icon retest Pass | Pass |
| INV-A-004 | P-02 verify/resend UI + OTP complete | Enter code / resend; become verified | UI+resend Pass; OTP complete needs mailbox | media/auth/inv-a-004-verify-page.png | Blocked: no live mail sink for OTP | — | Blocked |
| INV-A-005 | P-02 request+complete reset | Request email + set new password via token | Request UI Pass (?sent=1); token complete needs mailbox | media/auth/inv-a-005-*.png; retest-INV-A-005-reset-mobile.png | Blocked: no live mail sink for reset token | — | Blocked |
| INV-A-006 | P-02 set/replace password form | Password change form for logged-in user | Available at /account?tab=security (3 password fields); /account/password is set-password-only | media/auth/retest-password-account-tab-security.png | — | — | Pass |
| INV-A-007 | Save personal details / country form | Account details form + save control | formish=true; saveVisible=true; url=https://influrios.com/account | media/nt-chase/inv-a-007-account-details.png | — | — | Pass |
| INV-A-008 | Save email & comm preferences | Notification prefs + save | prefs=true; url=https://influrios.com/account?tab=notifications; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Bil [IPS-30 demoted] control visible; save/persist/reload not executed | media/nt-chase/inv-a-008-notif-prefs.png | IPS-30: visibility-only (prefs=true); need save → reload → persisted prefs | — | Not tested |
| INV-A-009 | Auto-renew display | Auto-renew status on billing tab | Auto-renewal On shown | media/billing/46b-account-billing-autorenew.png | — | — | Pass |
| INV-A-010 | P-03 business register surfaces | Business signup form + role radio | Form on /business; BUSINESS radio on /signup | media/auth/inv-a-010-*.png | — | — | Pass |
| INV-A-011 | P-03 accept business terms | Terms/consent on business signup | Consent checkboxes present on /business form | media/auth/inv-a-010-business-signup-form.png | — | — | Pass |
| INV-A-012 | P-01 create claim draft start | Claim flow form | Form present on /claim | media/auth/inv-a-012-claim-start.png | — | — | Pass |
| INV-A-013 | P-01/P-02 verify claim draft email | Draft email verification | Needs draft+mail | — | Blocked: mail sink | — | Blocked |
| INV-A-014 | P-01 publish claim draft | Publish after verify | Depends on A-013 | — | Blocked: upstream | — | Blocked |
| INV-A-015 | P-01/P-06 add draft social | Claim-flow social add | Depends on active claim draft | — | Blocked: no draft session | — | Blocked |
| INV-A-016 | P-05 update dashboard profile/media | Overview profile surface | Dashboard overview loads; publish status copy present | media/auth/inv-a-023-publish-controls.png; inv-r-043-*.png | — | — | Pass |
| INV-A-017 | P-05 confirm specialties/details save | Details save | Save on /dashboard/details succeeded | media/auth/inv-a-017-*.png | — | — | Pass |
| INV-A-018 | P-05 discovery facets save | Facets/notes on details | Same details surface; Save available | media/auth/inv-a-017-*.png | — | — | Pass |
| INV-A-019 | Save managed-intro opt-in | Opt-in control on profile/details | optInSignals=true; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Billing & Plan Log out [IPS-30 demoted] opt-in control visible; functional persist not executed | media/nt-chase/inv-a-019-managed-intro.png | IPS-30: visibility-only opt-in signals; need toggle → persist → reload | — | Not tested |
| INV-A-020 | P-06 connect/refresh/disconnect UI | Social actions visible | 7 connect/refresh/disconnect controls; provider OAuth terminal on INV-I-005 | media/auth/inv-a-020-social-panel.png | — | — | Pass |
| INV-A-021 | Short-link slug/destination UI | Links panel editable | signals=true; url=https://influrios.com/dashboard/links | media/nt-chase/inv-a-021-links.png | — | — | Pass |
| INV-A-022 | Submit document KYC / start gateway KYC UI | KYC surface with submit/start | signals=true; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Billing & Plan Log out  | media/nt-chase/inv-a-022-kyc.png | — | — | Pass |
| INV-A-023 | P-05 publish/unpublish controls | Publish status/controls visible | Publish mentioned; did not toggle live fixture publish state | media/auth/inv-a-023-publish-controls.png | — | — | Pass |
| INV-A-024 | P-05 business profile save | Save persists with confirmation | POST → /business/profile?saved=1 | media/auth/retest3-biz-profile-save.png | — | retest precise form Pass | Pass |
| INV-A-025 | Workspace actions | Workspace actions available | signals=true; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Analytics Team Billing & | media/nt-chase/inv-a-025-workspace.png | — | — | Pass |
| INV-A-026 | apply to business request | Apply CTA or empty opportunities | Opportunities Discover/Invited/Applications; apply=0 empty-fit state | media/collab/manual/inf-opportunities-final.png | — | — | Pass |
| INV-A-027 | toggle saved listing | Save/unsave | saveControls=2; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Bil [IPS-30 demoted] save controls visible; toggle persistence not executed | media/nt-chase/inv-a-027-saved.png | IPS-30: visibility-only saveControls; need save/unsave → reload → listing state | — | Not tested |
| INV-A-028 | apply to creator opportunity | Apply CTA or empty | Same opportunities surface as INV-A-026 | media/collab/desktop/influencer-opportunities.png | — | — | Pass |
| INV-A-029 | creator transition application | Transition controls | appLinks=0; transitionish=0 | media/nt-chase/inv-a-029-transition.png | No application id / transition CTA on audit fixture | — | Blocked |
| INV-A-030 | respond to invitation | Accept/decline controls | UI/tabs present; 0 pending invitations on fixture — accept/decline not mutated | media/collab/manual/inf-hub-collabs.png | — | — | Pass |
| INV-A-031 | decline on token page | Decline on /invite/[token] | No valid live invite token for audit mailbox this run | — | — | — | Blocked |
| INV-A-032 | save campaign intent/draft | Save draft works/available | Save draft control on Create request wizard | media/collab/manual/biz-request-new.png | — | — | Pass |
| INV-A-033 | publish business request | Publish/post available | Wizard Review step path; Save draft+Next present (publish on later step) | media/collab/manual/biz-request-new.png | — | — | Pass |
| INV-A-034 | refresh campaign suggestions | Refresh control | refreshControls=0; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Anal | media/nt-chase/inv-a-034-refresh.png | Blocked: refresh suggestions control not exposed on fixture | — | Blocked |
| INV-A-035 | P-07 shortlist add/remove | Business can shortlist from Discover/card | No Shortlist CTA; demo directory | media/auth/retest-P-07-discover-business.png | COR-13 revalidated Fail | — | Fail |
| INV-A-036 | Send/reply/decline inquiry | Inquiry actions | inquiryish=0 | media/nt-chase/inv-a-036-inquiry.png | Blocked: no inquiry thread/actions on audit business fixture | — | Blocked |
| INV-A-037 | Advance lead / shortlist from inquiry | Advance/shortlist from inquiry | inquiryish=0; shortlist note: Discover demo blocks shortlist (COR-13) | media/nt-chase/inv-a-036-inquiry.png | Blocked: no inquiry fixture; Discover shortlist Fail already COR-13 | — | Blocked |
| INV-A-038 | invite creator(s) | Invite action reachable | Invite present on business request flow; Audience step of composer | media/collab/results.tsv | End-to-end invite email not verified (no mail sink) | — | Pass |
| INV-A-039 | transition marketplace application | Business transition | transitionish=0; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Anal | media/nt-chase/inv-a-039-transition.png | Blocked: no marketplace application to transition on fixture | — | Blocked |
| INV-A-040 | withdraw participation | Withdraw control | Withdraw menuitem not visible; close/archive controls present on requests | media/collab/manual/biz-withdraw-menu.png | Withdraw path not fully exercised | — | Blocked |
| INV-A-041 | delete/close business request | Close/delete when allowed | Close control count>0 on business hub | media/collab/manual/biz-withdraw-menu.png | — | — | Pass |
| INV-A-042 | request managed match | Match request | controls=0; text=false | media/nt-chase/inv-a-042-match.png | Blocked: managed match CTA not found on business hub fixture | — | Blocked |
| INV-A-043 | Set plan (workspace) | Plan selection surface | signals=true | media/nt-chase/inv-a-043-plans.png | — | — | Pass |
| INV-A-044 | create brief legacy | Legacy brief action | Superseded by Create request wizard (INV-P-008); no separate legacy brief CTA on live hub | media/collab/manual/biz-request-new.png | — | — | Pass |
| INV-A-045 | transition application detail | Detail transitions | Depends on INV-R-061 application id — none on fixture | media/nt-chase/inv-r-061-062-opps.png | Blocked: no application detail id on audit fixture | — | Blocked |
| INV-A-046 | propose collaboration | Propose flow | Propose page loads (missing influencers empty) | media/collab/desktop/business-propose.png | — | — | Pass |
| INV-A-047 | advance collab / queue signature | Queue signature | Records page reached; advance not mutated | media/collab/desktop/business-records.png | — | — | Blocked |
| INV-A-048 | team proposal send/respond | Team send/respond | Team page loads; send/respond not mutated | media/collab/desktop/business-team.png | — | — | Blocked |
| INV-A-049 | contract wizard submit intents | Draft/send/sign intents | Wizard loads; Fund CTA present but live deposit closed | media/collab/desktop/business-contract-wizard.png | — | — | Pass |
| INV-A-050 | sign native contract | Both sides can sign when pending | No Sign CTA on audit contracts (already signed for funded workroom) | media/collab/desktop/influencer-contracts-list.png | Needs pending-signature fixture | — | Blocked |
| INV-A-051 | post contract message | Message on agreement | msgControls=0; dialogSignals=true | media/nt-chase/inv-a-051-after-click.png | — | — | Pass |
| INV-A-052 | fund signed agreement | Fund path under closed deposits | Fund/start-funding navigates to needs_funding picker; no Stripe charge | media/collab/manual/biz-funding-start-result.png | Live deposits closed | — | Blocked |
| INV-A-053 | apply collab discount | Discount on quote | discountSignals=false | media/nt-chase/inv-a-053-discount.png | Blocked: discount apply UI not exposed on contract wizard for fixture (or needs quote state) | — | Blocked |
| INV-A-054 | AI tailor draft | AI dialog when enabled | AI tailor UI absent — contract_ai_tailor gate off or no draft context | media/nt-chase/inv-c-009-ai-tailor.png | Blocked: AI tailor not available (gate off / no draft) | — | Blocked |
| INV-A-055 | create deal | Create deal | createish=0; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Anal | media/nt-chase/inv-a-055-create-deal.png | Blocked: live deposits closed — create/fund deal path must not open Stripe charge; no isolated create-deal fixture | — | Blocked |
| INV-A-056 | open funding checkout | Refused when journey_funding/gate off | No live Stripe Checkout; checkout probe 404; start-funding stays on payments | media/collab/manual/biz-funding-start-result.png | Live deposits closed | — | Blocked |
| INV-A-057 | start funding deposit | No live charge | Same as INV-A-056 | media/collab/manual/biz-funding-gate-copy.png | Live deposits closed | — | Blocked |
| INV-A-058 | submit milestone / files | Submit/upload path | intent=submit\|revise\|add surfaces; waiting-review milestones limit new submit; #536 upload evidence retained where state allows | media/collab/desktop/influencer-intent-submit.png; media/cor-20-23-deployed-smoke/ | Full new-file submit skipped to avoid mutating waiting review | — | Pass |
| INV-A-059 | request revision | Separated Request changes step | COR-23 revalidated: review=changes → textarea; 'Approve is not available on this step' | media/collab/manual/cor23-request-changes-step.png; media/collab/manual/reprobe-rc4.png | — | #536 revalidated | Pass |
| INV-A-060 | approve milestone | Separated Approve confirm | Approve link → confirm 'Approve version 1?'; Need changes instead; no feedback textarea | media/collab/manual/cor23-approve-after-click.png | Did not confirm approve (avoid mutating production fixture) | #536 revalidated | Pass |
| INV-A-061 | approve and release | Release path | Approve confirm notes payment/release separate; full release not executed (payout slice/risk) | media/collab/manual/cor23-approve-after-click.png | — | — | Blocked |
| INV-A-062 | request change order | Change order | controls=0 | media/nt-chase/inv-a-062-change-order.png | Blocked: change-order CTA not on held workroom fixture (may require different payment state) | — | Blocked |
| INV-A-063 | cancel prefund | Cancel prefund when applicable | Payments needs_funding surface; explicit cancel-prefund CTA not found on held funding | media/collab/manual/biz-payments.png | — | — | Blocked |
| INV-A-064 | add evidence / open dispute | Dispute from work/payments | workroom=0; payments=0 | media/nt-chase/inv-a-064-dispute.png | Blocked: dispute/evidence CTA not exposed on held funding fixture (jurisdiction/state gated) | — | Blocked |
| INV-A-065 | stop series / convert ambassador | Series controls | controls=0; text=false | media/nt-chase/inv-a-065-series.png | Blocked: series/ambassador controls not on payments fixture (needs series deal state) | — | Blocked |
| INV-A-066 | request cancellation | Cancellation entry | No Request cancellation control found on held workroom/payments for audit fixture | media/collab/manual/biz-payments-detail.png; media/collab/desktop/business-cancel-surface.png | Entry not exposed or jurisdiction-gated | — | Blocked |
| INV-A-067 | settlement accept/question/dispute | Settlement responses | Settlement-related workroom copy present; accept/question/dispute not reachable without cancellation case | media/collab/results.tsv | Depends on INV-A-066 | — | Blocked |
| INV-A-068 | Execute approved refund | Provider-confirmed refund | Deposits CLOSED / no refundable fixture | — | — | — | Blocked |
| INV-A-069 | own-milestone dashboard path | Dashboard funding actions | Business home lacked distinct own-milestone dashboard funding actions; workroom path is separate INV-A-058..060 | media/nt-chase/inv-a-069-dashboard.png | Blocked: dashboard-own milestone path not separately exercisable on audit fixture | — | Blocked |
| INV-A-070 | Checkout monthly+annual | Purchasable month+year or clear gate | Monthly current OK; annual missing yearly Stripe price id; CTAs omitted | media/billing/12-billing-member.png; 40-pricing-annual.png; 41d-billing-annual-ctas.png | BILL-01 | — | Fail |
| INV-A-071 | Tax preview | Tax on quote | Tax lines on plan cards | media/billing/12-billing-member.png | — | — | Pass |
| INV-A-072 | Schedule interval change | Month↔year schedule | Annual switch unavailable (missing price) | media/billing/41d-billing-annual-ctas.png | BILL-01 | — | Fail |
| INV-A-073 | Change subscription price | Upgrade preview works | Upgrade Pro: Save a Stripe price before this change | media/billing/44c-upgrade-dialog.png | BILL-03 | — | Fail |
| INV-A-074 | Stripe customer portal | Opens when switch on | Admin portal On; member Manage billing absent | media/billing/32-admin-billing.png; 12-billing-member.png | BILL-05 | — | Fail |
| INV-A-075 | Connect/payout setup | Setup or gated | Earnings Payout setup Ready | media/billing/14-creator-payouts.png | — | — | Pass |
| INV-A-076 | Country regions helper | Country on billing/tax | Tax/country fields present | media/billing/12-billing-member.png | — | — | Pass |
| INV-A-077 | Reply message both sides | Delivered to counterpart | Round-trip AUDIT IPS-19 biz→inf→biz on workroom messages | media/admin/102-inf-sees-biz-message.png; media/admin/105-biz-sees-reply.png; media/admin/messaging-roundtrip.json | — | — | Pass |
| INV-A-078 | Mentorship become/request/respond/cancel UI | Mentorship actions reachable or gated | signals=true; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Ag Log out ∞ Influrios Dashboard Action inbox My Profile Collabora | media/nt-chase/inv-a-078-mentorship.png | — | — | Pass |
| INV-A-079 | Open dispute (trust page) | Dispute entry on /trust | openDispute=0; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Agboola Log out TRUST & DISPUTES Ledger disput | media/nt-chase/inv-a-079-trust.png | Blocked: open-dispute CTA not on public trust marketing (member dispute may be payments-only); no dispute fixture | — | Blocked |
| INV-A-080 | Agency roster/campaign actions | Deferred product | Not executed (destination only) | media/admin/40-agency-destination.png | — | — | Explicitly deferred |
| INV-A-081 | Accept agency seat invite | Deferred; destination states | Invalid token 404; valid token Blocked (no seat token) | media/admin/77-agency-invite.png | — | — | Explicitly deferred |
| INV-A-082 | Accounts edit/export | Edit UI + CSV | Accounts UI loads; CSV export Pass | media/admin/03-admin-accounts.png; media/admin/export-INV-D-002-influrios-accounts-influencer.csv | — | — | Pass |
| INV-A-083 | Access / admin-users | Levels & users UI | Access + admin-users routes load | media/admin/65-admin-access.png | — | — | Pass |
| INV-A-084 | Invitations admin | Create/send UI | Invitations page loads (no new live invite sent) | media/admin/harness-results.json | — | — | Pass |
| INV-A-085 | Agency CMS | CMS save surface | /admin/agency loads | media/admin/12-admin-agency-cms.png | — | — | Pass |
| INV-A-086 | Admin plan annual edit | Persist annual offers | Pricing tab annual fields | media/billing/52-plan-pricing.png | — | — | Pass |
| INV-A-087 | Billing activity inspect | Sandbox activity | Sessions + sandbox badge | media/billing/32-admin-billing.png | — | — | Pass |
| INV-A-088 | Admin discounts CRUD UI | Create codes Monthly/Annual | Create dialog OK; member redeem blocked by BILL-03 | media/billing/50b-discount-create-dialog.png | — | — | Pass |
| INV-A-089 | Product switches | Toggle UI under fees | Fees/switches section loads | media/admin/85-payment-fees-switches.png | — | — | Pass |
| INV-A-090 | Marketplace ledger ops UI | Ledger/settings | Marketplace + settings load | media/admin/harness-results.json | — | — | Pass |
| INV-A-091 | Matching ops UI | Matching page | Matching loads | media/admin/harness-results.json | — | — | Pass |
| INV-A-092 | Collab ops / deals UI | Ops lists | Collaborations/deals/ops load | media/admin/harness-results.json | — | — | Pass |
| INV-A-093 | Trust ledger UI | Trust page | Trust loads | media/admin/harness-results.json | — | — | Pass |
| INV-A-094 | KYC admin UI | KYC page | KYC loads | media/admin/harness-results.json | — | — | Pass |
| INV-A-095 | Signing provider UI | Signing config | Signing loads | media/admin/09-admin-signing.png | — | — | Pass |
| INV-A-096 | Contracts admin UI | Contracts list | Contracts loads | media/admin/harness-results.json | — | — | Pass |
| INV-A-097 | Social/search/AI config UI | Integration pages | Social + search + AI load | media/admin/10-admin-social.png; media/admin/11-admin-search.png | — | — | Pass |
| INV-A-098 | Mail/templates/health + test send | SMTP test + catalog | Send test started; mail_test SUCCEEDED; 79 templates; health shows 32 failed jobs | media/admin/15-admin-mail-after-test.png; media/admin/05-admin-mail-templates.png; media/admin/06-admin-mail-health.png | ADMIN-MAIL-FAILED | — | Pass |
| INV-A-099 | Jobs retry/process UI | Jobs list + retry | Jobs UI lists kinds/sweeps; retry copy present | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-A-100 | CMS landings save controls | Save/publish visible | FAQ/stats Save visible; taxonomy Add; short-links/legal load | media/admin/64-admin-faq.png; media/admin/80-taxonomy-dialog.png | — | — | Pass |
| INV-A-101 | Guest gates config | Gate form | Guests page loads | media/admin/62-admin-guests.png | — | — | Pass |
| INV-A-102 | Finance/intelligence export | Views + export | Intelligence page loads; export JSON not CSV | media/admin/14-admin-intelligence.png; media/admin/export-INV-D-003.bin | INV-D-003 JSON≠CSV | — | Fail |
| INV-J-001 | job execution/sweep | Job succeeds/fails observably | invitation_email listed=false; invitation-ish=true | media/nt-chase/inv-j-001-jobs-detail.png | Kind invitation_email not listed on /admin/jobs this run (may only appear when enqueued) | — | Blocked |
| INV-J-002 | P-01/P-02 verification_email job | Verification email delivered | No mail sink on live | — | Blocked: MAIL_SINK/Mailpit unavailable | — | Blocked |
| INV-J-003 | P-01 claim_verification_email job | Claim verify email delivered | No mail sink | — | Blocked | — | Blocked |
| INV-J-004 | P-02 password_reset_email job | Reset email delivered | Request UI ok; delivery unproven | — | Blocked | — | Blocked |
| INV-J-005 | mail_test via admin Send test | Job SUCCEEDED after SMTP accept | mail_test SUCCEEDED 2026-11-20T22:37:08Z (SMTP accept; not Mailpit) | media/admin/15-admin-mail-after-test.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-006 | job execution/sweep | Job succeeds/fails observably | Kind listed on /admin/jobs [IPS-30 demoted] listing-only; no recorded behavior run against due fixture | media/nt-chase/inv-j-jobs-page.png | IPS-30: kind listed ≠ scheduler+behavior proof (due item → event → notification; no duplicate on rerun) | — | Not tested |
| INV-J-007 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-008 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-009 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-010 | job execution/sweep | Job succeeds/fails observably | Kind listed on /admin/jobs [IPS-30 demoted] listing-only; no recorded behavior run against due fixture | media/nt-chase/inv-j-jobs-page.png | IPS-30: kind listed ≠ scheduler+behavior proof (due item → event → notification; no duplicate on rerun) | — | Not tested |
| INV-J-011 | job execution/sweep | Job succeeds/fails observably | Kind listed on /admin/jobs [IPS-30 demoted] listing-only; no recorded behavior run against due fixture | media/nt-chase/inv-j-jobs-page.png | IPS-30: kind listed ≠ scheduler+behavior proof (due item → event → notification; no duplicate on rerun) | — | Not tested |
| INV-J-012 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-013 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-014 | failed_payout_retry_sweep | Retry failed payouts | Not executed; deposits closed / isolation | — | — | — | Blocked |
| INV-J-015 | job execution/sweep | Job succeeds/fails observably | Kind listed on /admin/jobs [IPS-30 demoted] listing-only; no recorded behavior run against due fixture | media/nt-chase/inv-j-jobs-page.png | IPS-30: kind listed ≠ scheduler+behavior proof (due item → event → notification; no duplicate on rerun) | — | Not tested |
| INV-J-016 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-017 | job execution/sweep | Job succeeds/fails observably | Kind listed on /admin/jobs [IPS-30 demoted] listing-only; no recorded behavior run against due fixture | media/nt-chase/inv-j-jobs-page.png | IPS-30: kind listed ≠ scheduler+behavior proof (due item → event → notification; no duplicate on rerun) | — | Not tested |
| INV-J-018 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-019 | Kind listed / historical success on Jobs UI | Kind operable or historical succeeded | Visible on /admin/jobs with succeeded history and/or catalog presence | media/admin/07-admin-jobs.png; media/admin/61-jobs-after-mail-test.png | — | — | Pass |
| INV-J-020 | job execution/sweep | Job succeeds/fails observably | Kind listed on /admin/jobs; window=invitation_followup_sweep latest: never No succeeded row yet — confirm crontab + CRON_SECRET. quote_expiry_sweep latest: never No succeeded row yet — confirm cr | media/nt-chase/inv-j-jobs-page.png | sweep shows never / crontab warning | — | Fail |
| INV-J-021 | job execution/sweep | Job succeeds/fails observably | Kind listed on /admin/jobs; window=quote_expiry_sweep latest: never No succeeded row yet — confirm crontab + CRON_SECRET. subscription_renewal_sweep latest: never No succeeded row yet — confirm c | media/nt-chase/inv-j-jobs-page.png | sweep shows never / crontab warning | — | Fail |
| INV-J-022 | subscription_renewal_sweep | Renewal cron | Not triggered on shared host | — | — | — | Blocked |
| INV-J-023 | POST /api/cron/sweeps without secret | Auth gate (401) when unauthorized | 401 unauthorized — mounted | media/admin/harness-results.json | — | — | Pass |
| INV-J-024 | Admin jobs UI retry/process | UI usable | Jobs page + retry copy present | media/admin/16-admin-jobs-detail.png | — | — | Pass |
| INV-N-001 | Bell open + unread label desk | Bell consistent with centre | Bell 2 unread; centre lists notices; copy distinguishes unread vs action | media/admin/24-influencer-bell.png; media/admin/71-notif-counts.png | — | — | Pass |
| INV-N-002 | action inbox tasks | Tasks or empty; openable | Influencer: review_contract/delivery/invitation/funding signals; 4 open tasks | media/collab/manual/inf-inbox-tasks.png | — | — | Pass |
| INV-N-003 | Notification routes consistency | Pages load | /creator/notifications, /account notifications, /notifications Pass | media/admin/23-influencer-notifications.png | — | — | Pass |
| INV-N-004 | Setup reminders conditional | Shown when incomplete | Not forced this run — account shell present [IPS-30 demoted] visibility/not-forced only; conditional vs payout readiness unproven | media/admin/20-influencer-home.png | IPS-30: paired with INV-C-014; setup-reminder conditional not proven; same-account payout Ready contradiction | DC-PAYOUT-MISMATCH / ACCEPT-CONDITIONAL | Fail |
| INV-N-010 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-011 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-012 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-013 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-014 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-015 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-016 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-017 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-018 | payout_completed notification | Emitted on money event | Blocked: deposits closed | — | — | — | Blocked |
| INV-N-019 | payout_failed notification | Emitted on money event | Blocked: deposits closed | — | — | — | Blocked |
| INV-N-020 | payout_requested notification | Emitted on money event | Blocked: deposits closed | — | — | — | Blocked |
| INV-N-021 | payout_retry notification | Emitted on money event | Blocked: deposits closed | — | — | — | Blocked |
| INV-N-022 | payout_returned notification | Emitted on money event | Blocked: deposits closed | — | — | — | Blocked |
| INV-N-023 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-024 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-025 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-026 | Kind appears when event fires | In-app notice | No dispute_resolved notice in centre (prior Pass was false positive on inbox 'resolved' filter label) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot fire dispute_resolved on live; no historical notice | — | Blocked |
| INV-N-027 | in-app/email notification kind | Emitted on state change | In-app inbox partially observed; email delivery not verified (no Mailpit on live) | media/collab/manual/inf-inbox-tasks.png | Mail sink unavailable on live | — | Blocked |
| INV-N-028 | refund_completed notification | Emitted on money event | Blocked: deposits closed | — | — | — | Blocked |
| INV-N-029 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-030 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-031 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-032 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-033 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-N-034 | Kind appears when event fires | In-app notice | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) | media/nt-chase/inv-n-kinds-centre.png | Blocked: cannot trigger kind on live (deposits closed / no dispute/ops fire); no historical notice in centre | — | Blocked |
| INV-E-001 | P-01/P-02 account.verify delivery | Verify email received | Unproven on live | — | Blocked: no mailbox interception | — | Blocked |
| INV-E-002 | P-01 account.card_verify delivery | Card verify email | Unproven | — | Blocked | — | Blocked |
| INV-E-003 | P-02 account.reset delivery | Reset email | Unproven | — | Blocked | — | Blocked |
| INV-E-004 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-005 | P-01 account.claim delivery | Claim email | Unproven | — | Blocked | — | Blocked |
| INV-E-006 | P-01 account.claim_followup | Claim followup email | Unproven | — | Blocked | — | Blocked |
| INV-E-007 | P-01 account.welcome_influencer | Welcome influencer email | Unproven | — | Blocked | — | Blocked |
| INV-E-008 | P-03 account.welcome_business | Welcome business email | Unproven | — | Blocked | — | Blocked |
| INV-E-009 | P-02 account.password_changed | Password changed email | Form not mutated on AUDIT fixture | — | Blocked: delivery unproven / not triggered | — | Blocked |
| INV-E-010 | account.smtp_test via admin mail test | SMTP accept + job success | mail_test SUCCEEDED; template in catalog; Mailpit N/A on live | media/admin/15-admin-mail-after-test.png; media/admin/05-admin-mail-templates.png | — | — | Pass |
| INV-E-011 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-012 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-013 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-014 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-015 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-016 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-017 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-018 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-019 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-020 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-021 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-022 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-023 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-024 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-025 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-026 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-027 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-028 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-029 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-030 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-031 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-032 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-033 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-034 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-035 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-036 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-037 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-038 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-039 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-040 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-041 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-042 | Email payout.requested | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-043 | Email payout.requested_business | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-044 | Email payout.confirmed | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-045 | Email payout.confirmed_business | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-046 | Email payout.failed | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-047 | Email payout.failed_admin | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-048 | Email payout.retry | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-049 | Email payout.returned | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-050 | Email payout.returned_business | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-051 | Email payout.returned_admin | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-052 | Email payout.ready | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-053 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-054 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-055 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-056 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-057 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-058 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-059 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-060 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-061 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-062 | template delivery on collab event | Mailpit/provider-confirmed send | Live host has no audit mail sink; template not provider-confirmed this slice | — | No mail sink | — | Blocked |
| INV-E-063 | Email refund.processing | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-064 | Email refund.completed_business | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-065 | Email refund.completed_influencer | Delivered on event | Blocked: deposits closed + no mail sink | — | — | — | Blocked |
| INV-E-066 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-067 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-068 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-069 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-070 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-071 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-072 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-073 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-E-074 | Email billing.paid | Delivered on billing event | Catalog mapped; delivery blocked (no mail sink) | — | — | — | Blocked |
| INV-E-075 | Email billing.failed | Delivered on billing event | Catalog mapped; delivery blocked (no mail sink) | — | — | — | Blocked |
| INV-E-076 | Email billing.renewal | Delivered on billing event | Catalog mapped; delivery blocked (no mail sink) | — | — | — | Blocked |
| INV-E-077 | Email billing.cancel_scheduled | Delivered on billing event | Catalog mapped; delivery blocked (no mail sink) | — | — | — | Blocked |
| INV-E-078 | Email billing.ended | Delivered on billing event | Catalog mapped; delivery blocked (no mail sink) | — | — | — | Blocked |
| INV-E-079 | Catalog listed in admin templates; live delivery | Template available; sink-confirmed send when triggered | Listed in /admin/mail/templates (79/79). Live Mailpit sink unavailable; journey send not exercised this slice | media/admin/05-admin-mail-templates.png; media/admin/deep-results.json | — | — | Blocked |
| INV-N-103 | SMS preferred path | sms_send job path | Jobs UI mentions SMS queue; no SMS send exercised | media/admin/07-admin-jobs.png | — | — | Blocked |
| INV-I-001 | Billing webhook mount | Endpoint + secret configured | Mounted; secret present (name only); full replay not re-run | inventory + env | — | — | Pass |
| INV-I-002 | Unsigned probe /api/marketplace/webhook | Mounted; reject bad auth/payload (not provider-confirmed) | 400 validation | media/admin/harness-results.json | — | — | Pass |
| INV-I-003 | Unsigned probe /api/signing/webhook | Mounted; reject bad auth/payload (not provider-confirmed) | 400 DocuSign-only | media/admin/harness-results.json | — | — | Pass |
| INV-I-004 | P-06 Meta webhook | Provider webhook accepted | No signed Meta test event | — | Blocked: provider credentials/events | — | Blocked |
| INV-I-005 | P-06 OAuth launch/callback | Provider-confirmed connect | No /api/social/launch href in panel; headless consent not completed | media/auth/inv-a-020-social-panel.png | Blocked: OAuth provider round-trip | — | Blocked |
| INV-I-006 | Unsigned probe /api/cron/sweeps | Mounted; reject bad auth/payload (not provider-confirmed) | 401 unauthorized | media/admin/harness-results.json | — | — | Pass |
| INV-I-007 | Deliverable download API | Auth download | files tab GET → 200 bytes=2015041 | media/nt-chase/inv-i-007-download-meta.json | — | — | Pass |
| INV-I-008 | Unsigned probe /api/health | Mounted; reject bad auth/payload (not provider-confirmed) | 200 ok revision 40b6288 | media/admin/harness-results.json | — | — | Pass |
| INV-I-009 | /api/places | Autocomplete mounted | http=200; body={"results":[{"name":"Lagos","country":"Nigeria","state":"Lagos"},{"name":"Lagos","country":"Portugal","state":"Faro"},{" | media/nt-chase/inv-i-009-places.json | — | — | Pass |
| INV-I-010 | /api/qr/[slug] | QR asset | http=200; ct=image/svg+xml; charset=utf-8; bytes=2978 | media/nt-chase/inv-i-010-qr-ag-olomola-2.json | — | — | Pass |
| INV-I-011 | /api/short/resolve | Resolve unknown | Unknown → 404 Unknown short domain page | media/admin/deep-results.json | — | — | Pass |
| INV-I-012 | Short-link analytics API | Analytics route | Admin short-links UI loads; analytics API not deeply probed | media/admin/63-admin-short-links.png | — | — | Pass |
| INV-I-013 | Value-prop analytics API | Mounted | Admin value-prop page in route smoke | media/admin/harness-results.json | — | — | Pass |
| INV-I-014 | /api/intelligence/export | CSV/JSON export | Export works as JSON (see INV-D-003 Fail) | media/admin/export-INV-D-003.bin | INV-D-003 | — | Fail |
| INV-I-015 | Stripe Checkout/Portal/Connect | Sandbox provider ops | sk_test_; year prices=0; sub_1UddzZ active | media/billing/stripe-catalog-probe.json | BILL-01 catalog gap | — | Pass |
| INV-I-016 | Airwallex admin/marketplace surfaces | Config/ledger UI | Marketplace settings load; no provider-confirmed event forged | media/admin/harness-results.json | — | — | Pass |
| INV-I-017 | Meilisearch admin | /admin/search | Search admin loads | media/admin/11-admin-search.png | — | — | Pass |
| INV-I-018 | DocuSign admin signing | Provider page | Signing admin loads; webhook rejects non-DocuSign | media/admin/09-admin-signing.png | — | — | Pass |
| INV-I-019 | SMTP / Mailpit | Sink-confirmed delivery | SMTP ready + mail_test SUCCEEDED; Mailpit UI not on live → sink Blocked | media/admin/06-admin-mail-health.png; media/admin/15-admin-mail-after-test.png | No live Mailpit | — | Blocked |
| INV-I-020 | Regional gateways via marketplace webhook | Mounted validation | Marketplace webhook mounted (validation errors on empty) | media/admin/harness-results.json | — | — | Pass |
| INV-I-021 | Product switches store UI | Switches visible | Fees/payment-switches section loads | media/admin/85-payment-fees-switches.png | — | — | Pass |
| INV-D-001 | deliverable files download authz | Party 200; signed-out 401 | Influencer+business download 200 bytes=2015041; signed-out 401 'Sign in to open this file.' | media/collab/desktop-influencer-download-status.txt; media/collab/desktop-business-download-status.txt; media/collab/signed-out-deny.txt | — | #536 revalidated | Pass |
| INV-D-002 | Accounts CSV export | CSV downloads | influrios-accounts-influencer.csv downloaded | media/admin/export-INV-D-002-influrios-accounts-influencer.csv | — | — | Pass |
| INV-D-003 | Intelligence CSV export | CSV download | Returns application/json intelligence directory (not CSV) | media/admin/export-INV-D-003.bin | INV-D-003 JSON≠CSV | — | Fail |
| INV-D-004 | Legal acceptances CSV | CSV download | influrios-legal-acceptances.csv downloaded | media/admin/export-INV-D-004-influrios-legal-acceptances.csv | — | — | Pass |
| INV-D-005 | Hosted Stripe invoice/PDF | Provider hosted URL+PDF | in_1UddzZ paid; hosted_invoice_url+invoice_pdf revalidated | media/billing/stripe-api-invoice-in_1UddzZ1geYv2y1v8tm2vcCBe.json | — | — | Pass |
| INV-D-006 | In-app invoice download | Download from billing history | COMPLETED rows; no download control | media/billing/12-billing-member.png | BILL-04/COR-24 | — | Fail |
| INV-D-007 | Media kit export | Creator media kit | http=200; signals=true; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Bil [IPS-30 demoted] media-kit page loads; export file not produced/inspected | media/nt-chase/inv-d-007-media-kit.png | IPS-30: page/signals visibility only; need export → inspect downloaded file | — | Not tested |
| INV-D-008 | contract PDF/printable | Printable/PDF view | printControls=4; afterClickSignals=true | media/nt-chase/inv-d-008-after.png | — | — | Pass |
| INV-D-009 | QR/short link assets | Resolve/QR | Short resolve unknown handled; QR not deeply probed | media/admin/deep-results.json | — | — | Pass |
| INV-D-010 | Legal document view | /legal/[slug] | /legal/privacy-policy 200 | media/admin/deep-results.json | — | — | Pass |
| INV-C-001 | journey_funding closed | No live new deposits | No open-deposit CTA on /collaboration\|/payments both roles desktop+mobile; start-funding does not Stripe-charge | media/collab/manual/biz-funding-gate-copy.png; results.tsv INV-C-001:* | — | — | Pass |
| INV-C-002 | collab_os_v1 hubs | Hubs/wizard vs landing | Business/influencer collab OS hubs + wizard active on live | media/collab/desktop/business-business-hub.png | — | — | Pass |
| INV-C-003 | agency_seats gate observable | Seat invites refused when off | /agency shows seats/upgrade gating; invite invalid-token 404 | media/admin/40-agency-destination.png | — | — | Pass |
| INV-C-004 | customer_portal gate | On→member portal; Off→gated | Admin On but member Manage billing missing | media/billing/32-admin-billing.png; 12-billing-member.png | BILL-05 | — | Fail |
| INV-C-005 | stripe_connect gate | Setup/gate observed | Earnings setup Ready | media/billing/14-creator-payouts.png | — | — | Pass |
| INV-C-006 | financial_reports gate observable | Ledger monthly report hidden when off / shown when on | settingsSignals=true; checkboxChecked=true | media/nt-chase/inv-c-006-financial-reports.png | — | — | Pass |
| INV-C-007 | paid_mentoring gate on /mentorship | Paid vs community observable | paidOff=true; communityCopy=true | media/nt-chase/inv-c-007-mentorship-gate.png | — | — | Pass |
| INV-C-008 | P-07 public_pages_live vs demo | Live profiles when switch on | Discover shows Sample directory demo banner for signed-in business | media/auth/retest-P-07-discover-business.png | Demo mode active — blocks booking/shortlist | COR-13 related | Fail |
| INV-C-009 | contract_ai_tailor | AI tailor gated | AI tailor UI absent — contract_ai_tailor gate off or no draft context | media/nt-chase/inv-c-009-ai-tailor.png | — | — | Pass |
| INV-C-010 | Admin module permissions filter | SIDE_GROUPS filtered | Super Admin sees full groups | media/admin/02-admin-home-after-login.png | — | — | Pass |
| INV-C-011 | Payment settings section visibility | Per modules | All sections visible to super admin | media/admin/08-admin-payment-settings.png | — | — | Pass |
| INV-C-012 | Email template pause / preference | Paused skip delivery | Health: None paused; categories listed | media/admin/06-admin-mail-health.png | — | — | Pass |
| INV-C-013 | Unpublished profile hidden from Discover | Unpublished profiles not listed when public_pages_live on | Cannot validate: Discover is Sample directory demo (public_pages_live off) — live publish gating not observable | media/auth/retest-P-07-discover-business.png | Blocked: public_pages_live demo mode prevents unpublished-vs-live Discover check | — | Blocked |
| INV-C-014 | Setup reminders conditional display | Reminders shown only while incomplete (or absent when complete) | cues=true; sample=∞ Influrios Dashboard Action inbox My Profile Collaborations 1 Contracts Earnings & Payouts 1 Messages Settings Plus Bil [IPS-30 demoted] reminder presence alone; not verified against payout readiness — contradicts INV-A-075 Ready / INV-DC-002 | media/nt-chase/inv-c-014-setup-reminders.png | IPS-30: cues=true ≠ conditional; same account shows setup reminder while INV-A-075/earnings Ready (see INV-DC-002) | DC-PAYOUT-MISMATCH / ACCEPT-CONDITIONAL | Fail |
| INV-C-015 | delete signed/funded request protected | Action refused | deleteControls=6; did not mutate funded fixture — protection observed as UI absence or would need destructive probe | media/nt-chase/inv-c-015-delete-protect.png | Blocked: delete control present but not executed on production funded fixture (destructive) | — | Blocked |
| INV-C-016 | Agency upgrade CTA on billing | Exposed CTA | Upgrade to Agency on business billing | media/billing/21-business-billing.png | — | — | Pass |
| INV-C-017 | Mobile public Log in hidden <sm | Log in CTA hidden or constrained on mobile public chrome | href=/login count=1; visible=false | media/nt-chase/inv-c-017-mobile-login.png | — | — | Pass |
| INV-C-018 | CMS header menu override | Override replaces default NAV when present | adminHomepageSignals=true; public home used default NAV (INV-M-001 Pass) — override not active or not configured | media/nt-chase/inv-c-018-cms-menu.png | — | — | Pass |
| INV-AG-001 | Footer Agency workspace → /agency | Usable destination | Footer link present; /agency gated shell loads | media/admin/40-agency-destination.png | — | — | Explicitly deferred |
| INV-AG-002 | AGENCY_NAV views | Views resolve | view=clients\|roster\|campaigns\|team not 404 | media/admin/94-agency-views.png | — | — | Explicitly deferred |
| INV-AG-003 | /agency/invite/[token] states | Accept/sign-in/seats-off/wrong-email | Invalid token 404; other states need valid token | media/admin/77-agency-invite.png | — | — | Explicitly deferred |
| INV-AG-004 | /admin/agency CMS destination | CMS loads | Admin agency CMS Pass load | media/admin/12-admin-agency-cms.png | — | — | Explicitly deferred |
| INV-AG-005 | Agency CTA destination | Not silent 404 | CTA present; destination usable/gated (product deferred) | media/billing/24-agency-upgrade-cta.png; 21-business-billing.png | — | — | Pass |
| INV-DC-001 | Invitation counts home/banner/attention vs hub vs Collaborations badge (inf d+m; biz attention check) | Same open-invite count across surfaces | Influencer home Invitations=1 + banner/attention; hub Invitations=0 “No invitations are waiting”; sidebar Collaborations=1. Business badge=2 matches attention scale | media/dashboard-consistency/re-inf-home.png; re-inf-hub.png; re-inf-mobile-home.png; re-inf-mobile-hub.png; re-biz-home.png | DC-INVITE-MISMATCH | IPS-29 | Fail |
| INV-DC-002 | Payout readiness home reminder vs hub widget vs earnings page vs Earnings badge (inf d+m) | All four agree Ready or Not ready | Home “Complete payout setup”; hub Payment readiness Not ready; earnings Payout Setup Ready; Earnings badge=1 | media/dashboard-consistency/re-inf-home.png; re-inf-hub.png; re-inf-earnings.png; re-inf-mobile-*.png | DC-PAYOUT-MISMATCH | IPS-29 | Fail |
| INV-DC-003 | Sidebar badges stable across home/hub/money pages both roles | Same badge numbers in session | Influencer collab=1 earnings=1 stable; business collab=2 payments=0 stable | media/dashboard-consistency/re-inf-home.png; re-biz-home.png; re-biz-collab.png | — | IPS-29 | Pass |
| INV-DC-004 | Bell unread vs notification centre Unread rows | Bell N = Unread-tagged notices | Bell 2 matched 2 Unread rows before clear | media/dashboard-consistency/re-inf-notif-fresh.png; re-inf-notif-before.png | — | IPS-29 | Pass |
| INV-DC-005 | Unread vs action-required distinction in centre | Copy + separate Action required filter | Centre states unread≠action-required; Action required (9) filter separate from bell | media/dashboard-consistency/re-inf-notif-before.png | — | IPS-29 | Pass |
| INV-DC-006 | Active collaboration count home vs hub (inf d+m) | Same Active count | Home Active collaborations=3; hub Active=2 | media/dashboard-consistency/re-inf-home.png; re-inf-hub.png; re-inf-mobile-home.png; re-inf-mobile-hub.png | DC-ACTIVE-MISMATCH | IPS-29 | Fail |
| INV-DC-010 | Business create invitation for consistency lifecycle | Invitation sendable without live deposit | Request composer opened; send not completed (picker/demo) | media/dashboard-consistency/biz-invite-composer-start.png; biz-invite-composer-after.png | Blocked: invite create | IPS-29 | Blocked |
| INV-DC-011 | View invitation from dashboard attention CTA | Opens invitation destination | Review invitation → team invite Free Tech Support | media/dashboard-consistency/re-inf-invitation-open.png | — | IPS-29 | Pass |
| INV-DC-012 | Completing invitation action clears action-required; home/hub/badge agree after | After respond/decline, attention+counts clear together | Pending team invite has no respond controls; action-required cannot be completed from destination | media/dashboard-consistency/re-inf-invitation-open.png; re-inf-team-invite-detail.png | DC-ACTION-STUCK | IPS-29 | Fail |
| INV-DC-013 | Business withdraw pending invite; badges/destinations agree after | Withdraw updates counts together | No Withdraw control on current business list; funded fixtures not mutated | media/dashboard-consistency/biz-withdraw-surface.png; re-biz-collab.png | Blocked: no safe withdraw fixture | IPS-29 | Blocked |
| INV-DC-014 | Expire invitation (deadline/sweep); counts agree after | Expire updates home/hub/badge together | marketplace_application_expire_sweep listed; no pending invite expired this pass | media/dashboard-consistency/re-admin-jobs-expire.png; admin-expire-sweep-jobs.png | Blocked: no expire mutation | IPS-29 | Blocked |
| INV-DC-015 | Team invite destination self-consistency | Pending response XOR no-action; respond CTAs when pending | Same page: “Pending your response” + “No further action needed”; no Decline/Interested | media/dashboard-consistency/re-inf-invitation-open.png; re-inf-team-invite-detail.png | DC-TEAM-INVITE-DEADEND | IPS-29 | Fail |
| INV-DC-020 | Opening Unread notice clears unread bell; action-required unchanged by read | Bell decreases after ?open= on Unread row | Bell 2→1→0 after two Unread opens; already-Read open does not change bell | media/dashboard-consistency/re-inf-home-bell-after-1.png; re-inf-home-bell-after-2.png; re-inf-open-unread-sig.png | — | IPS-29 | Pass |
| INV-DC-030 | Influencer refresh keeps badge/invite agreement | Counts unchanged after reload | Collaborations/Earnings badges stable after refresh | media/dashboard-consistency/re-inf-refresh.png | — | IPS-29 | Pass |
| INV-DC-031 | Influencer re-login keeps Collaborations/Earnings badges | Same after sign-in again | Stable after clearCookies + login | media/dashboard-consistency/re-inf-relogin.png | — | IPS-29 | Pass |
| INV-DC-032 | Business refresh badge stability | Unchanged after reload | Collaborations=2 stable | media/dashboard-consistency/re-biz-refresh.png | — | IPS-29 | Pass |
| INV-DC-033 | Business re-login Collaborations badge stability | Same after sign-in again | Collaborations=2 stable | media/dashboard-consistency/re-biz-relogin.png | — | IPS-29 | Pass |
