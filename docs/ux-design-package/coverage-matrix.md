# Coverage matrix

Baseline evidence: `/cursor/stores/self/docs/visual-audit/` + `/cursor/stores/self/media/visual-audit/` (PR #532).  
**Legend — Result:** `reviewed` · `partial` · `gap` · `blocked` · `deferred`  
**Evidence paths** are relative to `/cursor/stores/self/media/visual-audit/screenshots/` unless noted.

A screenshot proves appearance at one moment — not full workflow success.

---

## Public

| Role | Page / route | Objective | Entry | Primary action | States | Interactions | Desktop | Mobile | Result | Gap |
|------|--------------|-----------|-------|----------------|--------|--------------|---------|--------|--------|-----|
| public | `/` Home | Understand product; join or discover | Direct / SEO | Search / Join / Discover | Default | Header nav, category pills | `public/desktop/home.png` | `public/mobile/home.png` | **partial** | Mobile: nav+Login hidden (P1) |
| public | `/discover` | Find influencers | Header / search | Filter, open profile | Sample banner; search fashion; more filters | Search, filters, profile overlay | discover*, discover-search*, discover-more-filters*, discover-profile-demo-* | same mobile | **partial** | Live bookable directory blocked (DISCOVER-SAMPLE-001) |
| public | `/discover?profile=demo-*` | View demo profile | Discover card | Close / invite (gated) | Demo overlay | Overlay detail | demo-amara/daniel/marcus | same | **reviewed** | Not live booking |
| public | `/c/[slug]` card | Share influencer identity | Shortlink / QR | Contact | Live `/c/ag-olomola-2`; vanity `/c/ag` 404 | Card chrome | live-card-* | live-card-ag mobile | **partial** | Vanity on primary host (CARD-VANITY-001) |
| public | `/creators/[slug]` | Directory profile | Deep link | — | 404 on audit slug | — | creators-slug-ag | same | **gap** | Live directory not enabled |
| public | `/pricing` | Choose influencer plan | Header | Monthly/Annual, Choose plan | Monthly selected; Compare collapsed | Interval toggle, Compare | pricing | pricing | **reviewed** | Checkout totals not exercised |
| public | `/signup` `/register` | Create account | Join / CTA | Submit | Empty validation | Form validation | signup*, register, signup-validation-empty | same | **reviewed** | Full registration completion not recorded |
| public | `/login` | Sign in | Header Login | Submit | Empty validation | Form | login* | login* | **partial** | Mobile entry from home broken |
| public | `/claim` | Claim influencer card | Join Influrios | Continue claim | Default | Form | claim | claim | **reviewed** | End-to-end claim not completed |
| public | `/business` `/collaboration` `/card` `/categories` `/faq` `/legal` `/trust` | Marketing education | Nav / footer | CTAs | Default | Links | matching atlas ids | matching | **reviewed** | — |
| public | `/mentorship` | Mentorship | Footer | — | Redirected toward login | — | mentorship | mentorship | **partial** | Guest path unclear |
| public | `/account/reset` | Reset password | Login help | Submit | Default | Form | account-reset | account-reset | **reviewed** | Send not exercised |
| public | `/admin/login` | Admin auth | Direct | Submit | Default | Form | admin-login | admin-login | **reviewed** | — |

---

## Influencer

| Role | Page / route | Objective | Entry | Primary action | States | Interactions | Desktop | Mobile | Result | Gap |
|------|--------------|-----------|-------|----------------|--------|--------------|---------|--------|--------|-----|
| influencer | `/creator` Dashboard | See next steps | Post-login | Review invitation / Submit content | Populated KPIs; payout CTA | Cards, lists | creator-home, post-login-home | post-login-home | **reviewed** | Badge vs Active count mismatch noted in journey |
| influencer | `/collaboration/inbox` | Complete assigned tasks | Sidebar | Open workspace / Review | 6 open tasks; Assigned tab | Tabs, filters, Open | action-inbox, inbox-list-state, collab-detail* | inbox-list-state | **partial** | Duplicate task rows; workroom not opened |
| influencer | `/dashboard*` Profile | Manage profile | Sidebar My Profile | Edit tabs | details/social/links/kyc/prefs | Tabs | my-profile, profile-* | profile-* | **reviewed** | — |
| influencer | `/collaboration/hub?view=collaborations` | Manage collabs | Sidebar | Open deliverables | Overview + Active list | Tabs Overview/Active/History… | collab-hub | collab-hub | **partial** | Overview popup missing; Active tab drill-down gap |
| influencer | `/collaboration/work/[fundingId]` | Milestone workroom | Open deliverables | Submit / review | — | Workspace tabs | — | — | **gap** | Not captured |
| influencer | `/collaboration/contracts` | Agreements | Sidebar | View agreement | Fully signed list | Tabs Agreements/Templates; filter | contracts, contracts-list-state | same | **partial** | Preview/signing/PDF not captured |
| influencer | `/collaboration/contracts/[id]` | Read/sign | View agreement | Sign | — | Dialog/viewer | — | — | **gap / blocked** | Signing completion not exercised |
| influencer | `/creator/messages` | Message brands | Sidebar | Open thread / reply | List + state | List | messages, messages-state | messages | **partial** | Reply flow gap |
| influencer | `/creator/earnings` `#payouts` | Track earnings / payouts | Sidebar | Continue payout setup | Overview + payouts tab | Tabs, anchors | earnings* | earnings | **partial** | Real payout blocked |
| influencer | `/payments` `/billing` | Collab payments / plan | Sidebar / Plus | Manage | Default | Links | payments, billing | payments | **partial** | Checkout blocked |
| influencer | `/creator/notifications` `/account*` | Notices & settings | Bell / Settings | Update | Default | Tabs | notifications, account* | same | **reviewed** | — |
| influencer | Invitation accept / withdraw | Respond to invite | Inbox / dashboard | Accept / decline / withdraw | Invitation row present | Confirm + notify | creator-home Review invitation | — | **blocked** | Customer notification / state mutation policy |

---

## Business

| Role | Page / route | Objective | Entry | Primary action | States | Interactions | Desktop | Mobile | Result | Gap |
|------|--------------|-----------|-------|----------------|--------|--------------|---------|--------|--------|-----|
| business | `/business/home` | Ops overview | Post-login | Next actions | Populated | Cards | biz-home, post-login-home | same | **reviewed** | — |
| business | `/collaboration/inbox` | Tasks | Sidebar | Review invitation | 2 tasks; Funding required | Tabs | biz-inbox | biz-inbox | **partial** | Accept/fund blocked |
| business | `/business/profile` | Company profile | Sidebar | Edit | Default | Forms | biz-profile | biz-profile | **reviewed** | — |
| business | `/discover` (authed) | Select influencers | Sidebar | Open profile / invite | Sample directory | Profile overlay | biz-discover, discover-profile-authed | biz-discover | **partial** | Live invite blocked by sample mode + notify policy |
| business | `/collaboration/business` Requests | Manage requests | Collaborations | + New request / View | Requests tab; filters; 6 rows | Tabs Requests/Opportunities/Active; filters | biz-collab, biz-collab-list, biz-campaigns | same | **partial** | Detail/edit popup not captured from View |
| business | `/collaboration/business/request/[id]` | Create/edit request | New request / View | Save / publish / invite | Modal overlay (code) | Composer steps | propose-validation (partial) | — | **gap** | Need desktop/mobile detail+edit+empty+error captures |
| business | Active Collaborations tab | Track funded work | Collaborations tab | Open collaboration | Tab present | List → overview | biz-collab (Requests active in capture) | — | **gap** | Active tab + overview popup not evidenced |
| business | `/collaboration/contracts` | Agreements | Sidebar | View agreement | Fully signed | Same as influencer | biz-contracts | biz-contracts | **partial** | Preview/PDF gap |
| business | `/collaboration/propose` | Propose collab | Direct / CTA | Submit | Validation | Form | biz-propose, propose-validation | — | **partial** | Mobile propose gap |
| business | `/collaboration/records` `/collaboration/team` | Records / team | Nav | Manage | Default | Tables | biz-records, biz-team | same | **reviewed** | — |
| business | `/business/billing` `/business/plans` | Subscription | Sidebar | Change plan Monthly/Annual | Pro current; Agency card shown | Toggle, Compare | biz-billing, biz-plans, biz-billing-state | same | **partial** | Checkout/discount totals blocked; Agency plan still shown though Agency deferred |
| business | `/payments` | Collaboration funds | Sidebar | Fund / release | Default | Tabs | biz-payments | biz-payments | **blocked** | Real funding |
| business | `/admin` as business | Restricted | Direct | Bounce | Login bounce | — | biz-restricted-admin | same | **reviewed** | — |
| business | Request delete / participant withdraw | Lifecycle | Request popup | Withdraw → delete | — | Confirm + reason + notify | — | — | **blocked** | Notifications + mutation |

---

## Admin

| Role | Page / route | Objective | Entry | Primary action | States | Interactions | Desktop | Mobile | Result | Gap |
|------|--------------|-----------|-------|----------------|--------|--------------|---------|--------|--------|-----|
| admin | `/admin` | Platform overview | Post-login | Investigate health | KPI ↓100%; webhook ATTENTION | KPI strip, health | admin-dash, post-login-home | admin-dash | **partial** | Metric correctness (ADMIN-KPI-001); webhook (ADMIN-WEBHOOK-001); mobile dense (ADMIN-MOBILE-001) |
| admin | CMS pages (`/admin/banners` … `/admin/cards`) | Edit marketing | Sidebar | Edit | Default | Forms | admin-* CMS ids | mobile set | **reviewed** | — |
| admin | Members (`accounts*`, business-accounts, admin-users, access, invitations, guests) | Manage users & access | Sidebar | View / invite | Tabs; View account dialog | Dialogs | admin-accounts*, admin-*-dialog, guests-gates | same | **partial** | Keep Users ≠ Access Levels in IA |
| admin | `/admin/agency` | Agency admin CMS | Sidebar | — | Page only | — | admin-agency | admin-agency | **deferred** | Agency member journeys out of scope |
| admin | `/admin/plans` `/admin/billing` | Plans vs billing activity | Subscriptions | Create/Edit plan | Monthly+annual USD; Compare matrix; Create/Edit dialogs | Audience, country, dialogs | admin-plans, admin-billing, admin-plans-dialog-* | same | **reviewed** | Align with §7 separation (already tabbed) |
| admin | Collab ops (`deals`…`trust`) | Operate marketplace | Sidebar | Open deal | Deal detail opportunistic | Detail | admin-deals, deal-detail, … | mobile set | **partial** | Deep exception workflows gap |
| admin | `/admin/payment-settings` (+ sections) | Fees, routes, providers, discounts, tax | Sidebar | Edit / simulate | Multi-section dense UI | Tabs/sections | admin-payment-*, payment-section-* | mobile set | **partial** | Tax Country+Product model + preview **gap**; Payment v2 paused |
| admin | `/admin/finance` `/admin/kyc` | Finance / KYC | Sidebar | Review | Default | Tables | admin-finance, admin-kyc | same | **reviewed** | — |
| admin | Integrations & ops (ai, signing, contracts, mail, jobs, taxonomy…) | Operate platform | Sidebar | Configure | Default | Forms/tables | matching atlas | mobile | **reviewed** | Mail send not exercised |

---

## Agency

| Role | Routes | Result | Gap |
|------|--------|--------|-----|
| agency | `/agency` (+ views) | **deferred** | No Agency account creation; skip until after coordinated redesign |

---

## Priority missing-evidence summary

| Priority area | Status |
|---------------|--------|
| Request detail/edit popups | **gap** (route exists; not captured from list) |
| Invitation accept/withdraw | **blocked** |
| Active collab + milestone workrooms | **gap** |
| Contract preview/signing/PDF | **gap / blocked** for completion |
| Monthly/annual subscription | **reviewed** at pricing/billing UI; checkout **blocked** |
| Discount + checkout totals | **blocked** |
| Tax config/edit/preview | **gap** |
| Mobile nav/login | **reviewed** (broken — issues) |
| Real influencer profiles & discovery | **blocked** by sample mode + live directory gates |
