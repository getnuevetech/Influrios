# Full-platform inventory

**Source:** `main` @ `40b6288` · Phase A · IPS-18  
**IDs:** `INV-*` stable for [coverage-matrix.md](./coverage-matrix.md).  
**Agency:** product deferred; exposed entry points listed with destination notes (not full Agency coverage).

---

## 1. Page routes (128)

### 1.1 Public / guest

| ID | Route | Notes |
|----|-------|-------|
| INV-R-001 | `/` | Marketing home |
| INV-R-002 | `/discover` | Influencer directory |
| INV-R-003 | `/categories` | Category browse |
| INV-R-004 | `/collaboration` | Public collab landing |
| INV-R-005 | `/business` | Business marketing |
| INV-R-006 | `/pricing` | Plans marketing |
| INV-R-007 | `/card` | Influencer Card marketing |
| INV-R-008 | `/faq` | FAQ |
| INV-R-009 | `/trust` | Trust & disputes marketing |
| INV-R-010 | `/mentorship` | Mentorship (gated by `paid_mentoring`) |
| INV-R-011 | `/legal` | Legal center |
| INV-R-012 | `/legal/[slug]` | 23 legal docs under `content/legal/` |
| INV-R-013 | `/login` | Member login |
| INV-R-014 | `/signup` | Generic signup entry |
| INV-R-015 | `/register` | Register alias/path |
| INV-R-016 | `/claim` | Influencer claim / join |
| INV-R-017 | `/claim/preview/[draftId]` | Draft preview |
| INV-R-018 | `/claim/verify/[draftId]` | Draft email verify |
| INV-R-019 | `/claim/publish/[draftId]` | Draft publish |
| INV-R-020 | `/invite/[token]` | Creator invitation accept |
| INV-R-021 | `/c/[slug]` | Public influencer card |
| INV-R-022 | `/creators/[slug]` | Creator slug (member/public overlap) |
| INV-R-023 | `/q/[token]` | Short/QR token landing |
| INV-R-024 | `/billing` | Subscription checkout entry |
| INV-R-025 | `/billing/success` | Checkout success |
| INV-R-026 | `/billing/cancel` | Checkout cancel |
| INV-R-027 | `/notifications` | Public notifications redirect/shell |
| INV-R-028 | `/settings/connections` | Social connections settings entry |
| INV-R-029 | `/payments` | Protected payments list (auth often required) |
| INV-R-030 | `/payments/checkout/[id]` | Collaboration funding checkout |

### 1.2 Account shell (shared)

| ID | Route | Notes |
|----|-------|-------|
| INV-R-031 | `/account` | Settings (`?tab=`, `?audience=business`) |
| INV-R-032 | `/account/notifications` | Notification prefs / centre |
| INV-R-033 | `/account/password` | Password change |
| INV-R-034 | `/account/reset` | Password reset request/complete |
| INV-R-035 | `/account/verification` | Verification status |
| INV-R-036 | `/account/verify` | Email verify code |

### 1.3 Influencer / creator

| ID | Route | Notes |
|----|-------|-------|
| INV-R-037 | `/creator` | Dashboard |
| INV-R-038 | `/creator/analytics` | Profile analytics |
| INV-R-039 | `/creator/earnings` | Earnings & payouts (`#payouts`) |
| INV-R-040 | `/creator/media-kit` | Media kit |
| INV-R-041 | `/creator/messages` | Messages |
| INV-R-042 | `/creator/notifications` | Creator notifications |
| INV-R-043 | `/dashboard` | My Profile overview |
| INV-R-044 | `/dashboard/details` | Details & preferences |
| INV-R-045 | `/dashboard/preferences` | Redirect → details |
| INV-R-046 | `/dashboard/social` | Social accounts |
| INV-R-047 | `/dashboard/links` | Links & payments / short links |
| INV-R-048 | `/dashboard/kyc` | Identity KYC |

### 1.4 Business

| ID | Route | Notes |
|----|-------|-------|
| INV-R-049 | `/business/home` | Business dashboard |
| INV-R-050 | `/business/profile` | Company profile |
| INV-R-051 | `/business/billing` | Billing & plans |
| INV-R-052 | `/business/plans` | Plans (list + popup pattern) |
| INV-R-053 | `/business/intelligence` | Analytics |
| INV-R-054 | `/business/campaigns` | Campaigns |
| INV-R-055 | `/business/workspace` | Workspace |

### 1.5 Collaboration (member)

| ID | Route | Notes |
|----|-------|-------|
| INV-R-056 | `/collaboration/hub` | Influencer hub (`?view=collaborations\|opportunities`) |
| INV-R-057 | `/collaboration/inbox` | Action inbox |
| INV-R-058 | `/collaboration/business` | Business collaborations |
| INV-R-059 | `/collaboration/business/request/[id]` | Request detail / popup route |
| INV-R-060 | `/collaboration/requests/[id]` | Request detail |
| INV-R-061 | `/collaboration/applications/[id]` | Application detail |
| INV-R-062 | `/collaboration/openings/[id]` | Opening detail |
| INV-R-063 | `/collaboration/propose` | Propose collaboration |
| INV-R-064 | `/collaboration/records` | Collaboration records |
| INV-R-065 | `/collaboration/records/[id]` | Record detail |
| INV-R-066 | `/collaboration/contracts` | Agreements / templates |
| INV-R-067 | `/collaboration/contracts/[id]` | Agreement detail / sign |
| INV-R-068 | `/collaboration/contract` | Contract wizard / fund signed |
| INV-R-069 | `/collaboration/work/[fundingId]` | Workroom / deliverables |
| INV-R-070 | `/collaboration/team` | Team |
| INV-R-071 | `/collaboration/team/[id]` | Team proposal detail |

### 1.6 Agency (exposed; product deferred)

| ID | Route | Destination note |
|----|-------|------------------|
| INV-R-072 | `/agency` | Workspace UI when access resolves; views `clients\|roster\|campaigns\|team`. Prefer **Explicitly deferred** for product depth; still check usable destination. |
| INV-R-073 | `/agency/invite/[token]` | Seat invite accept; gated by `agency_seats`. |

### 1.7 Admin

| ID | Route | Notes |
|----|-------|-------|
| INV-R-074 | `/admin/login` | Admin login |
| INV-R-075 | `/admin` | Admin dashboard |
| INV-R-076 | `/admin/banners` | Banners CMS |
| INV-R-077 | `/admin/example-portraits` | Example portraits |
| INV-R-078 | `/admin/value-prop` | Value proposition |
| INV-R-079 | `/admin/homepage` | Homepage CMS |
| INV-R-080 | `/admin/collaboration-landing` | Collab landing CMS |
| INV-R-081 | `/admin/business-landing` | Business landing CMS |
| INV-R-082 | `/admin/faq` | FAQ CMS |
| INV-R-083 | `/admin/stats` | Site stats |
| INV-R-084 | `/admin/cards` | Influencer cards |
| INV-R-085 | `/admin/accounts` | Influencer accounts (`?tab=`) |
| INV-R-086 | `/admin/business-accounts` | Business accounts |
| INV-R-087 | `/admin/admin-users` | Admin users |
| INV-R-088 | `/admin/access` | Access levels |
| INV-R-089 | `/admin/invitations` | Invitations |
| INV-R-090 | `/admin/agency` | Agency CMS (not member Agency product) |
| INV-R-091 | `/admin/guests` | Guest gates |
| INV-R-092 | `/admin/plans` | Plans & features |
| INV-R-093 | `/admin/billing` | Billing activity |
| INV-R-094 | `/admin/deals` | Deals list |
| INV-R-095 | `/admin/deals/[id]` | Deal detail |
| INV-R-096 | `/admin/collaborations` | Collaborations ops list |
| INV-R-097 | `/admin/marketplace-listings` | Marketplace listings |
| INV-R-098 | `/admin/marketplace` | Marketplace ledger |
| INV-R-099 | `/admin/marketplace/[fundingId]` | Funding ledger detail |
| INV-R-100 | `/admin/marketplace/settings` | Marketplace settings |
| INV-R-101 | `/admin/matching` | Managed Matching |
| INV-R-102 | `/admin/intelligence` | Intelligence |
| INV-R-103 | `/admin/collaboration-ops` | Collaboration ops |
| INV-R-104 | `/admin/trust` | Trust & disputes |
| INV-R-105 | `/admin/payment-settings` | Payment settings hub (`?section=`) |
| INV-R-106 | `/admin/search` | Meilisearch |
| INV-R-107 | `/admin/kyc` | KYC admin |
| INV-R-108 | `/admin/finance` | Finance |
| INV-R-109 | `/admin/ai` | AI pipelines |
| INV-R-110 | `/admin/signing` | Document signing providers |
| INV-R-111 | `/admin/contracts` | Admin contracts |
| INV-R-112 | `/admin/contracts/[id]` | Admin contract detail |
| INV-R-113 | `/admin/social` | Social networks |
| INV-R-114 | `/admin/legal` | Legal documents |
| INV-R-115 | `/admin/short-links` | Short links |
| INV-R-116 | `/admin/referrals` | Referrals |
| INV-R-117 | `/admin/mail` | Email settings |
| INV-R-118 | `/admin/mail/templates` | Email templates |
| INV-R-119 | `/admin/mail/health` | Email health |
| INV-R-120 | `/admin/jobs` | Background jobs |
| INV-R-121 | `/admin/taxonomy` | Taxonomy |
| INV-R-122 | `/admin/setup` | Admin setup |
| INV-R-123 | `/admin/influencer-identity` | Influencer identity |
| INV-R-124 | `/admin/payment-settings` aliases | `/admin/gateways`→providers, `/admin/corridors`→routes, `/admin/fees`→fees, `/admin/payment-switches`→fees#payment-switches |
| INV-R-125 | `/admin/payments` | Payments (legacy/alias surface) |

**Route count check:** 128 `page.tsx` files under `src/app` (includes agency + all admin). Aliases INV-R-124 count as redirect surfaces, not extra pages.

---

## 2. Menus & chrome

| ID | Surface | Items / source |
|----|---------|----------------|
| INV-M-001 | Public header | Home, Discover Influencers, Categories, Collaborations, For Businesses, Pricing · `site-chrome.tsx` NAV (CMS override possible) |
| INV-M-002 | Public header CTAs | Search→Discover; Log in; Join→`/claim` (hidden Log in `<sm`) |
| INV-M-003 | Public footer platform | Home, Discover, Collaborations, Influencer Card |
| INV-M-004 | Public footer business | Find Influencers, For Businesses, **Agency workspace**, Intelligence, Business Pro, Opportunities |
| INV-M-005 | Public footer resources | FAQ, Pricing(`/card`), Checkout(`/billing`), Protected payments, Trust, Create card, Categories |
| INV-M-006 | Public footer legal | Contact, About, Privacy, Terms, Legal Center |
| INV-M-007 | Influencer sidebar | CREATOR_NAV: Dashboard, Action inbox, My Profile, Collaborations, Contracts, Earnings & Payouts, Messages, Settings |
| INV-M-008 | Influencer secondary | Billing & Plan → `/account?tab=billing` |
| INV-M-009 | Business sidebar | BUSINESS_NAV: Dashboard, Action inbox, Company Profile, Discover Creators, Collaborations, Contracts, Analytics, Team, Billing & Plans, Collaboration Payments, Verification, Settings |
| INV-M-010 | Agency sidebar | AGENCY_NAV (when agency account): overview, inbox, clients, roster, campaigns, contracts, payments, team, settings — **Explicitly deferred** product |
| INV-M-011 | Admin sidebar Main | Dashboard, Banners, Example portraits, Value prop, Homepage, Collab landing, Business landing, FAQ, Site stats, Influencer cards |
| INV-M-012 | Admin Members & access | Influencer accounts, Business accounts, All accounts, Admin users, Access levels, Invitations, Agency, Guest gates |
| INV-M-013 | Admin Subscriptions | Plans & features, Billing activity |
| INV-M-014 | Admin Collaborations | Deals, Collaborations, Marketplace listings, Marketplace ledger, Managed Matching, Intelligence, Collaboration ops, Trust & Disputes |
| INV-M-015 | Admin Payments & finance | Payment settings, Discount codes shortcut, Meilisearch, KYC, Finance |
| INV-M-016 | Admin Integrations & ops | AI, Document signing, Contracts, Social, Legal, Short links, Referrals, Email, Templates, Health, Jobs, Taxonomy |
| INV-M-017 | Notification bell | `notification-centre.tsx` in account shell |
| INV-M-018 | Setup reminders | Conditional dashboard cards: verify email, publish profile, connect social, payout setup (`account-nav.ts`) |

---

## 3. Tabs & query views

| ID | Location | Tabs / views |
|----|----------|--------------|
| INV-T-001 | `/account` influencer | account, security, notifications, verification, connections, billing |
| INV-T-002 | `/account` business | account, security, notifications, billing |
| INV-T-003 | Profile shell | Overview, Details & Preferences, Social Accounts, Links & Payments, Media Kit, Analytics |
| INV-T-004 | `/collaboration/hub` | view=opportunities \| collaborations |
| INV-T-005 | Hub collaborations | overview, applications, invitations, active, proposals, completed, history, saved |
| INV-T-006 | `/collaboration/business` | requests, opportunities, active |
| INV-T-007 | Business opportunities | view=recommended \| applications |
| INV-T-008 | `/collaboration/contracts` | agreements \| templates (+ wizard steps) |
| INV-T-009 | Contract agreement dialog | Agreement / Activity tabs |
| INV-T-010 | `/collaboration/inbox` | assigned, waiting, resolved · type filters: all, contract, delivery, funding, payout, invitation |
| INV-T-011 | Workroom | milestone tabs + review=hub\|changes |
| INV-T-012 | `/payments` | settlement, transactions (+ deal deep link) |
| INV-T-013 | Collaboration payments dialog | tabbed payment detail |
| INV-T-014 | `/admin/accounts` | influencer / business / all |
| INV-T-015 | `/admin/payment-settings` | providers, roles, routes, fees, tax, discounts, audit |
| INV-T-016 | `/agency` | overview + view=clients\|roster\|campaigns\|team (**deferred**) |
| INV-T-017 | Admin access levels UI | permission module tabs |
| INV-T-018 | Email template dialog | draft/preview tabs |
| INV-T-019 | Creator earnings | receive/payout sections (`#payouts`) |

---

## 4. Popups / dialogs / overlays

| ID | Component / surface | Used for |
|----|---------------------|----------|
| INV-P-001 | `InfluencerCardModal` | Discover / directory card overlay |
| INV-P-002 | `CardPreviewDialog` | Claim / auth card preview |
| INV-P-003 | `ContractAgreementDialog` | Read / sign agreement |
| INV-P-004 | `ContractAiReviewDialog` | AI tailor (`contract_ai_tailor`) |
| INV-P-005 | `collaboration-payments-dialog` | Funding / payment details |
| INV-P-006 | `RecordDialog` | Payment journey record |
| INV-P-007 | Workroom `FocusDialog` | Milestone focus / submit |
| INV-P-008 | Business request composer popup | New/edit request (`/collaboration/business`) |
| INV-P-009 | Active collaboration overview popup | Hub/business → workroom |
| INV-P-010 | `conversation-popup` | Messages thread |
| INV-P-011 | `earning-dialogs` | Earnings / payout detail |
| INV-P-012 | `PayoutDetailDialog` | Payout detail |
| INV-P-013 | `AccountDialog` | Admin account view/edit |
| INV-P-014 | Admin plans centered popup | Plan/entitlement edit |
| INV-P-015 | Admin taxonomy popup | Taxonomy edit |
| INV-P-016 | `SubscriptionsDialog` | Admin subscription view |
| INV-P-017 | Discount / tax rule dialogs | Payment settings |
| INV-P-018 | `EmailTemplateDialog` | Template editor |
| INV-P-019 | `NoticeDialog` | Generic notices |
| INV-P-020 | Admin access-levels popup | Create/edit level |
| INV-P-021 | Admin users popup | Create/edit admin user |
| INV-P-022 | Invitation review UI | Accept/decline invite |
| INV-P-023 | Review-before-save | Payment settings confirm |
| INV-P-024 | Creator QR button overlay | Card QR |
| INV-P-025 | Remove gateway confirm | Admin providers |

---

## 5. Forms & primary actions (server actions)

### 5.1 Auth & account

| ID | Action | Route / trigger |
|----|--------|-----------------|
| INV-A-001 | Register | `/signup`, `/register` |
| INV-A-002 | Login | `/login` |
| INV-A-003 | Logout | Account shell |
| INV-A-004 | Verify email / resend | `/account/verify` |
| INV-A-005 | Request / complete password reset | `/account/reset` |
| INV-A-006 | Set / replace password | `/account/password` |
| INV-A-007 | Save personal details / country | `/account` |
| INV-A-008 | Save email & comm preferences | `/account` notifications |
| INV-A-009 | Set auto-renew | `/account?tab=billing` |
| INV-A-010 | Register business | Business signup path |
| INV-A-011 | Accept business terms | Business gate |

### 5.2 Claim / onboarding / profile

| ID | Action | Route |
|----|--------|-------|
| INV-A-012 | Create / claim draft | `/claim` |
| INV-A-013 | Verify draft email | `/claim/verify/...` |
| INV-A-014 | Publish draft | `/claim/publish/...` |
| INV-A-015 | Add draft social | Claim flow |
| INV-A-016 | Update dashboard profile / media | `/dashboard` |
| INV-A-017 | Confirm specialties | `/dashboard/details` |
| INV-A-018 | Save discovery facets / offer-need notes | `/dashboard/details` |
| INV-A-019 | Save managed-intro opt-in | Profile |
| INV-A-020 | Connect / refresh / disconnect social | `/dashboard/social` |
| INV-A-021 | Short-link slug / destination / schedule / campaign links | `/dashboard/links` |
| INV-A-022 | Submit document KYC / start gateway KYC | `/dashboard/kyc` |
| INV-A-023 | Publish / unpublish profile | Dashboard |
| INV-A-024 | Business profile save | `/business/profile` |
| INV-A-025 | Workspace actions | `/business/workspace` |

### 5.3 Discovery, invitations, requests

| ID | Action | Route |
|----|--------|-------|
| INV-A-026 | Apply to business request | Hub |
| INV-A-027 | Toggle saved listing | Hub |
| INV-A-028 | Apply to creator opportunity | Hub |
| INV-A-029 | Creator transition application | Hub / applications |
| INV-A-030 | Respond to invitation (accept/decline) | Inbox / invite / applications |
| INV-A-031 | Decline invitation (token page) | `/invite/[token]` |
| INV-A-032 | Save campaign intent / workspace request | Business collab |
| INV-A-033 | Publish campaign / post business request | Business collab |
| INV-A-034 | Refresh campaign suggestions | Business collab |
| INV-A-035 | Shortlist add/remove | Business |
| INV-A-036 | Send / reply / decline inquiry | Business |
| INV-A-037 | Advance lead / shortlist from inquiry | Business |
| INV-A-038 | Invite creator(s) to request | Business |
| INV-A-039 | Transition marketplace application | Business |
| INV-A-040 | Withdraw participation | Business |
| INV-A-041 | Delete / close business request | Business |
| INV-A-042 | Request managed match | Business |
| INV-A-043 | Set plan (workspace) | Business |
| INV-A-044 | Create brief (legacy business actions) | Business |
| INV-A-045 | Transition application detail | Applications |
| INV-A-046 | Propose collaboration | `/collaboration/propose` |
| INV-A-047 | Advance collaboration / queue signature | Records |
| INV-A-048 | Team proposal send / respond | Team |

### 5.4 Contracts & signing

| ID | Action | Route |
|----|--------|-------|
| INV-A-049 | Submit contract wizard (draft/send/sign intents) | `/collaboration/contract` |
| INV-A-050 | Sign native contract | `/collaboration/contracts/[id]` |
| INV-A-051 | Post contract message | Contracts |
| INV-A-052 | Fund signed contract / agreement | Contract / funding apply |
| INV-A-053 | Apply collaboration discount | Collab discount actions |
| INV-A-054 | AI tailor draft (conditional) | Contract AI dialog |

### 5.5 Funding, deliverables, review, money

| ID | Action | Notes |
|----|--------|-------|
| INV-A-055 | Create deal | Payments |
| INV-A-056 | Open funding checkout | **Blocked live** when `journey_funding` off |
| INV-A-057 | Start funding deposit | Same gate |
| INV-A-058 | Submit milestone / add deliverable files | Workroom |
| INV-A-059 | Request revision | Business workroom |
| INV-A-060 | Approve milestone | Business |
| INV-A-061 | Approve and release | Standard payments |
| INV-A-062 | Request change order | Payments / dashboard own |
| INV-A-063 | Cancel prefund | Payments |
| INV-A-064 | Add evidence / open dispute | Payments / trust / workroom |
| INV-A-065 | Stop series / convert ambassador | Payments |
| INV-A-066 | Request cancellation | Payments |
| INV-A-067 | Accept / question / dispute settlement | Payments settlement tab |
| INV-A-068 | Execute approved refund | Admin/standard |
| INV-A-069 | Own-milestone submit / evidence / dispute | Dashboard funding actions |

### 5.6 Billing / subscriptions

| ID | Action | Route |
|----|--------|-------|
| INV-A-070 | Start subscription checkout | `/billing`, `/pricing`, plan checkout |
| INV-A-071 | Preview subscription tax | Billing |
| INV-A-072 | Schedule / cancel interval change | Billing |
| INV-A-073 | Preview / change subscription price | Billing |
| INV-A-074 | Open Stripe portal | `customer_portal` switch |
| INV-A-075 | Open Connect / connected account | `stripe_connect` switch |
| INV-A-076 | Country regions helper | Billing |

### 5.7 Messages, mentorship, trust

| ID | Action | Route |
|----|--------|-------|
| INV-A-077 | Reply to message thread | `/creator/messages` |
| INV-A-078 | Become mentor / request / respond / cancel mentorship | `/mentorship` |
| INV-A-079 | Open dispute (trust page) | `/trust` |

### 5.8 Agency actions (deferred product)

| ID | Action | Notes |
|----|--------|-------|
| INV-A-080 | Add roster / create campaign / portfolio / link agreement / set status / toggle portfolio | `/agency` — **Explicitly deferred** |
| INV-A-081 | Accept agency seat invite | `/agency/invite/[token]` — destination check only |

### 5.9 Admin configuration actions (representative inventory)

| ID | Area | Action modules (`src/app/admin/**/actions.ts`) |
|----|------|-----------------------------------------------|
| INV-A-082 | Accounts | Edit/export accounts |
| INV-A-083 | Access / admin-users | Levels & users |
| INV-A-084 | Invitations | Create/send/revoke |
| INV-A-085 | Agency CMS | Admin agency content |
| INV-A-086 | Plans | Plan/entitlement/annual offer edit |
| INV-A-087 | Billing activity | Inspect / ops |
| INV-A-088 | Payment settings | Providers, roles, routes, fees, tax, discounts, audit |
| INV-A-089 | Product switches | Toggle switches (under fees) |
| INV-A-090 | Marketplace / listings / ledger | Release, reconcile, settings |
| INV-A-091 | Matching | Managed match ops |
| INV-A-092 | Collaboration ops / collaborations / deals | Ops transitions |
| INV-A-093 | Trust ledger | Dispute ledger actions |
| INV-A-094 | KYC admin | Review KYC |
| INV-A-095 | Signing | Provider config / advance signature |
| INV-A-096 | Contracts admin | Contract ops |
| INV-A-097 | Social / search / AI | Integration config |
| INV-A-098 | Mail / templates / health | SMTP, templates, test send |
| INV-A-099 | Jobs | Retry / process jobs |
| INV-A-100 | CMS landings | Homepage, banners, FAQ, stats, legal, taxonomy, short-links, referrals |
| INV-A-101 | Guests | Guest gate config |
| INV-A-102 | Finance / intelligence export | Finance views + CSV |

---

## 6. Background jobs

| ID | Kind | Trigger |
|----|------|---------|
| INV-J-001 | `invitation_email` | Enqueue on invite |
| INV-J-002 | `verification_email` | Signup / resend |
| INV-J-003 | `claim_verification_email` | Claim verify |
| INV-J-004 | `password_reset_email` | Reset request |
| INV-J-005 | `mail_test` | Admin mail test |
| INV-J-006 | `collab_notification` | Collab events |
| INV-J-007 | `reindex_creators` | Search index |
| INV-J-008 | `sms_send` | Preferred SMS queue |
| INV-J-009 | `provider_webhook` / `ai_provider` / `provider_instruction` | Provider/AI ops |
| INV-J-010 | `milestone_auto_approval` | Cron sweep |
| INV-J-011 | `review_deadline_sweep` | Cron |
| INV-J-012 | `dispute_sla_sweep` | Cron |
| INV-J-013 | `provider_hold_warn_sweep` | Cron |
| INV-J-014 | `failed_payout_retry_sweep` | Cron |
| INV-J-015 | `funding_recon_sweep` | Cron |
| INV-J-016 | `scheduled_release_sweep` | Cron |
| INV-J-017 | `marketplace_application_expire_sweep` | Cron |
| INV-J-018 | `recurring_cycle_sweep` | Cron |
| INV-J-019 | `short_link_schedule_sweep` | Cron |
| INV-J-020 | `invitation_followup_sweep` | Cron |
| INV-J-021 | `quote_expiry_sweep` | Cron |
| INV-J-022 | `subscription_renewal_sweep` | Cron |
| INV-J-023 | Cron endpoint | `POST /api/cron/sweeps` (Bearer `CRON_SECRET`) |
| INV-J-024 | Admin jobs UI | `/admin/jobs` retry/process |

---

## 7. Notifications

### 7.1 In-app / inbox

| ID | Surface |
|----|---------|
| INV-N-001 | Notification centre / bell |
| INV-N-002 | Action inbox tasks: review_contract, review_delivery, review_funding, update_payout, review_invitation, submit_delivery |
| INV-N-003 | `/creator/notifications`, `/account/notifications`, `/notifications` |
| INV-N-004 | Setup reminders (conditional) |

### 7.2 Collab notification kinds (25)

| ID | Kind |
|----|------|
| INV-N-010 | funding_required |
| INV-N-011 | funding_successful |
| INV-N-012 | funding_failed |
| INV-N-013 | milestone_submitted |
| INV-N-014 | review_deadline_approaching |
| INV-N-015 | revision_requested |
| INV-N-016 | milestone_approved |
| INV-N-017 | milestone_auto_approved |
| INV-N-018 | payout_completed |
| INV-N-019 | payout_failed |
| INV-N-020 | payout_requested |
| INV-N-021 | payout_retry |
| INV-N-022 | payout_returned |
| INV-N-023 | stale_funding |
| INV-N-024 | ledger_mismatch |
| INV-N-025 | dispute_opened |
| INV-N-026 | dispute_resolved |
| INV-N-027 | collaboration_cancelled |
| INV-N-028 | refund_completed |
| INV-N-029 | payment_risk |
| INV-N-030 | change_order_accepted |
| INV-N-031 | preexisting_relationship_claimed |
| INV-N-032 | provider_jurisdiction_limitation |
| INV-N-033 | dispute_sla_reminder |
| INV-N-034 | provider_hold_period_warning |

### 7.3 Email catalog (79 templates → INV-E-001…079)

Groups: account, invite, contract, funding, milestone, payout, dispute, cancellation, refund, payment, ops, billing, marketing. Source: `src/data/email-catalog.json`. Full ID map in [coverage-matrix.md](./coverage-matrix.md).

| Matrix range | Examples |
|--------------|----------|
| INV-E-001…011 | account.verify, reset, claim, welcome_*, password_changed, smtp_test |
| INV-E-012…018 | invite.collaboration, private_campaign, accepted/declined, team_* |
| INV-E-019…029 | contract.sign → change_accepted |
| INV-E-030…036 | funding.required → expired |
| INV-E-037…041 | milestone.* |
| INV-E-042…053 | payout.* |
| INV-E-054…058 | dispute.* |
| INV-E-059…063 | cancellation.* |
| INV-E-064…065 | refund.* |
| INV-E-066…068 | payment.* |
| INV-E-069…074 | ops.* |
| INV-E-075…079 | billing.* + marketing.broadcast |
| INV-N-103 | SMS preferred delivery path (`sms_send` job) |

---

## 8. Integrations & API surfaces

| ID | Endpoint / system | Role |
|----|-------------------|------|
| INV-I-001 | `POST /api/billing/webhook` | Stripe billing, KYC gateway, mentorship, funding deposit events |
| INV-I-002 | `POST /api/marketplace/webhook` | Airwallex / marketplace ledger / regional (Flutterwave, M-Pesa) |
| INV-I-003 | `POST /api/signing/webhook` | DocuSign Connect |
| INV-I-004 | `GET/POST /api/social/meta/webhook` | Meta IG/FB |
| INV-I-005 | `/api/social/launch` + `/api/social/callback` | OAuth social connect |
| INV-I-006 | `POST /api/cron/sweeps` | Scheduled jobs |
| INV-I-007 | `/api/deliverables/[fileId]` | Deliverable file download |
| INV-I-008 | `/api/health` | Health |
| INV-I-009 | `/api/places` | Places autocomplete |
| INV-I-010 | `/api/qr/[slug]` | QR image |
| INV-I-011 | `/api/short/resolve` (+ catch-all) | Short-link resolve |
| INV-I-012 | `/api/short-links/[id]/analytics` | Short-link analytics |
| INV-I-013 | `/api/analytics/value-prop` | Value-prop analytics |
| INV-I-014 | `/api/intelligence/export` | Intelligence CSV |
| INV-I-015 | Stripe Checkout / Portal / Connect | Subscriptions & payouts |
| INV-I-016 | Airwallex | Marketplace collection/holding |
| INV-I-017 | Meilisearch | `/admin/search` |
| INV-I-018 | DocuSign (+ native signing) | Contracts |
| INV-I-019 | SMTP / Mailpit (sandbox) | Mail delivery |
| INV-I-020 | Regional gateways | Flutterwave, M-Pesa via marketplace webhook |
| INV-I-021 | Product switches store | Feature gates |

---

## 9. Downloadables & exports

| ID | Artifact | Path |
|----|----------|------|
| INV-D-001 | Deliverable files | `/api/deliverables/[fileId]` |
| INV-D-002 | Accounts CSV | `/admin/accounts/export` |
| INV-D-003 | Intelligence CSV | `/admin/intelligence/export`, `/api/intelligence/export` |
| INV-D-004 | Legal acceptances CSV | `/admin/legal/export` |
| INV-D-005 | Hosted Stripe invoice / PDF | Billing portal / provider (J20 prior evidence) |
| INV-D-006 | In-app invoice download | Gap noted in prior COR-24 — still inventory as expected surface |
| INV-D-007 | Media kit export/view | `/creator/media-kit` |
| INV-D-008 | Contract / agreement PDF or printable view | Contracts dialog |
| INV-D-009 | QR / short link assets | `/api/qr/[slug]`, links panel |
| INV-D-010 | Legal document download/view | `/legal/[slug]` (23 docs) |

---

## 10. Hidden / conditional / gated

| ID | Gate | Effect |
|----|------|--------|
| INV-C-001 | `journey_funding` | New collab deposits closed; checkout refuses charge |
| INV-C-002 | `collab_os_v1` | Collab hubs/wizard vs public landing + propose/records |
| INV-C-003 | `agency_seats` | Seat invites refused when off |
| INV-C-004 | `customer_portal` | Stripe portal closed |
| INV-C-005 | `stripe_connect` | Connect onboarding closed |
| INV-C-006 | `financial_reports` | Ledger monthly report hidden |
| INV-C-007 | `paid_mentoring` | Paid mentorship vs community only |
| INV-C-008 | `public_pages_live` | Live CMS vs demo content |
| INV-C-009 | `contract_ai_tailor` | AI wording suggestions |
| INV-C-010 | Admin module permissions | SIDE_GROUPS filtered per access level |
| INV-C-011 | Payment settings sections | Visible per admin modules |
| INV-C-012 | Email template pause / preference / feature_off | Catalog delivery skipped |
| INV-C-013 | Unpublished profile | Hidden from Discover |
| INV-C-014 | Setup reminders | Shown only while incomplete |
| INV-C-015 | Delete signed/funded request | Protected — action refused |
| INV-C-016 | Agency upgrade CTA on billing | Exposed; Agency product deferred |
| INV-C-017 | Mobile public Log in | Hidden `<sm` (known UX risk) |
| INV-C-018 | CMS header menu override | Replaces default NAV when directory menus present |

---

## 11. Agency exposed entry points (destination check only)

| ID | Entry | Expected usable destination |
|----|-------|----------------------------|
| INV-AG-001 | Footer “Agency workspace” → `/agency` | Page loads; access gate or workspace shell — not full product audit |
| INV-AG-002 | AGENCY_NAV (agency-role accounts) | Views resolve without dead chrome |
| INV-AG-003 | `/agency/invite/[token]` | Accept / sign-in / seats-off / wrong-email states |
| INV-AG-004 | `/admin/agency` | CMS destination (ops, not member Agency) |
| INV-AG-005 | Business billing Agency upgrade CTA | Must not silently 404; “coming soon” or gated path OK |

---

## 12. Prior evidence crosswalk (retained, not substitute)

| Prior pack | Reuse |
|------------|-------|
| `docs/e2e-audit/route-inventory.csv` | Route list baseline; expanded here |
| `docs/e2e-audit/action-inventory.csv` | Core journey actions |
| `docs/e2e-audit/journeys.md` | J01–J30 historical acceptance |
| `docs/remediation-pack/` + #536 COR-20–23 | Deliverables fixes retained |
| `docs/ux-design-package/navigation-map.md` | Nav IA |

---

## Count summary

| Category | Inventory IDs | Count |
|----------|---------------|------:|
| Routes | INV-R-001…125 | 125 |
| Page files on disk | `src/app/**/page.tsx` | 128 |
| Menus | INV-M-001…018 | 18 |
| Tabs/views | INV-T-001…019 | 19 |
| Popups | INV-P-001…025 | 25 |
| Actions/forms | INV-A-001…102 | 102 |
| Jobs | INV-J-001…024 | 24 |
| Inbox / reminders | INV-N-001…004 | 4 |
| Collab notification kinds | INV-N-010…034 | 25 |
| Email templates | INV-E-001…079 | 79 |
| SMS path | INV-N-103 | 1 |
| Integrations | INV-I-001…021 | 21 |
| Downloadables | INV-D-001…010 | 10 |
| Conditional | INV-C-001…018 | 18 |
| Agency entries | INV-AG-001…005 | 5 |
| **Matrix rows (authoritative)** | see [coverage-matrix.md](./coverage-matrix.md) | **476** |

Page-file count (128) includes all App Router pages; inventory route IDs (125) collapse payment-settings aliases into INV-R-124/125 while still listing redirect destinations.
