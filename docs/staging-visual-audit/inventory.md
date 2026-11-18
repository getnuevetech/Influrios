# Route inventory

Generated: 2026-11-18T09:41:03.289Z

Source: Influrios Next.js `src/app/**/page.tsx` plus authenticated nav from `account-shell.tsx` / `admin/layout.tsx`.

## Public (17)

| ID | Path | Title |
|----|------|-------|
| home | `/` | Marketing home |
| discover | `/discover` | Discover influencers |
| pricing | `/pricing` | Pricing |
| signup | `/signup` | Signup |
| login | `/login` | Login |
| claim | `/claim` | Claim profile |
| business-landing | `/business` | For businesses landing |
| collaboration-landing | `/collaboration` | Collaborations landing |
| card | `/card` | Card |
| faq | `/faq` | FAQ |
| legal | `/legal` | Legal index |
| categories | `/categories` | Categories |
| mentorship | `/mentorship` | Mentorship |
| trust | `/trust` | Trust |
| register | `/register` | Register alias |
| admin-login | `/admin/login` | Admin login |
| account-reset | `/account/reset` | Password reset |

## Influencer (23)

| ID | Path | Title |
|----|------|-------|
| creator-home | `/creator` | Creator dashboard |
| action-inbox | `/collaboration/inbox` | Action inbox |
| my-profile | `/dashboard` | My profile overview |
| profile-details | `/dashboard/details` | Profile details |
| profile-social | `/dashboard/social` | Social connections |
| profile-links | `/dashboard/links` | Profile links |
| profile-kyc | `/dashboard/kyc` | KYC |
| profile-prefs | `/dashboard/preferences` | Preferences |
| media-kit | `/creator/media-kit` | Media kit |
| analytics | `/creator/analytics` | Analytics |
| collab-hub | `/collaboration/hub?view=collaborations` | Collaborations hub |
| contracts | `/collaboration/contracts` | Contracts |
| earnings | `/creator/earnings` | Earnings |
| earnings-payouts | `/creator/earnings#payouts` | Earnings payouts tab |
| messages | `/creator/messages` | Messages |
| notifications | `/creator/notifications` | Notifications |
| account | `/account` | Account settings |
| account-password | `/account/password` | Password settings |
| account-notifications | `/account/notifications` | Notification settings |
| account-verification | `/account/verification` | Verification |
| payments | `/payments` | Payments overview |
| billing | `/billing` | Billing |
| settings-connections | `/settings/connections` | Connections |

## Business (17)

| ID | Path | Title |
|----|------|-------|
| biz-home | `/business/home` | Business dashboard |
| biz-inbox | `/collaboration/inbox` | Action inbox |
| biz-profile | `/business/profile` | Company profile |
| biz-discover | `/discover` | Discover creators (authed) |
| biz-collab | `/collaboration/business` | Collaborations |
| biz-contracts | `/collaboration/contracts` | Contracts |
| biz-intelligence | `/business/intelligence` | Analytics |
| biz-team | `/collaboration/team` | Team |
| biz-billing | `/business/billing` | Billing & plans |
| biz-plans | `/business/plans` | Plans |
| biz-campaigns | `/business/campaigns` | Campaigns |
| biz-workspace | `/business/workspace` | Workspace |
| biz-payments | `/payments` | Collaboration payments |
| biz-verification | `/account/verification` | Verification |
| biz-settings | `/account?audience=business` | Settings |
| biz-propose | `/collaboration/propose` | Propose collaboration |
| biz-records | `/collaboration/records` | Collaboration records |

## Admin (48)

| ID | Path | Title |
|----|------|-------|
| admin-dash | `/admin` | Admin dashboard |
| admin-banners | `/admin/banners` | Banners |
| admin-portraits | `/admin/example-portraits` | Example portraits |
| admin-value | `/admin/value-prop` | Value proposition |
| admin-homepage | `/admin/homepage` | Homepage |
| admin-collab-landing | `/admin/collaboration-landing` | Collaboration landing |
| admin-biz-landing | `/admin/business-landing` | Business landing |
| admin-faq | `/admin/faq` | FAQ |
| admin-stats | `/admin/stats` | Site stats |
| admin-cards | `/admin/cards` | Influencer cards |
| admin-accounts | `/admin/accounts` | Influencer accounts |
| admin-accounts-all | `/admin/accounts?tab=all` | All accounts |
| admin-biz-accounts | `/admin/business-accounts` | Business accounts |
| admin-admin-users | `/admin/admin-users` | Admin users |
| admin-access | `/admin/access` | Access levels |
| admin-invitations | `/admin/invitations` | Invitations |
| admin-agency | `/admin/agency` | Agency admin (page only; Agency role deferred) |
| admin-guests | `/admin/guests` | Guest gates |
| admin-plans | `/admin/plans` | Plans & features |
| admin-billing | `/admin/billing` | Billing activity |
| admin-deals | `/admin/deals` | Deals |
| admin-collaborations | `/admin/collaborations` | Collaborations |
| admin-listings | `/admin/marketplace-listings` | Marketplace listings |
| admin-marketplace | `/admin/marketplace` | Marketplace ledger |
| admin-matching | `/admin/matching` | Managed matching |
| admin-intelligence | `/admin/intelligence` | Intelligence |
| admin-collab-ops | `/admin/collaboration-ops` | Collaboration ops |
| admin-trust | `/admin/trust` | Trust & disputes |
| admin-payment-settings | `/admin/payment-settings` | Payment settings |
| admin-payment-routes | `/admin/payment-settings?section=routes` | Country routes |
| admin-payment-fees | `/admin/payment-settings?section=fees` | Fees & policies |
| admin-payment-providers | `/admin/payment-settings?section=providers` | Providers |
| admin-payment-discounts | `/admin/payment-settings?section=discounts` | Discount codes |
| admin-search | `/admin/search` | Meilisearch |
| admin-kyc | `/admin/kyc` | KYC |
| admin-finance | `/admin/finance` | Finance |
| admin-ai | `/admin/ai` | AI pipelines |
| admin-signing | `/admin/signing` | Document signing |
| admin-contracts | `/admin/contracts` | Contracts |
| admin-social | `/admin/social` | Social networks |
| admin-legal | `/admin/legal` | Legal documents |
| admin-short-links | `/admin/short-links` | Short links |
| admin-referrals | `/admin/referrals` | Referrals |
| admin-mail | `/admin/mail` | Email |
| admin-mail-templates | `/admin/mail/templates` | Email templates |
| admin-mail-health | `/admin/mail/health` | Email health |
| admin-jobs | `/admin/jobs` | Jobs |
| admin-taxonomy | `/admin/taxonomy` | Taxonomy |

## Agency (deferred — 5)

| ID | Path | Reason |
|----|------|--------|
| agency-home | `/agency` | Agency role deferred per preferences.md |
| agency-clients | `/agency?view=clients` | Agency role deferred |
| agency-roster | `/agency?view=roster` | Agency role deferred |
| agency-campaigns | `/agency?view=campaigns` | Agency role deferred |
| agency-team | `/agency?view=team` | Agency role deferred |

Dynamic detail routes (`/creators/[slug]`, `/collaboration/contracts/[id]`, `/admin/deals/[id]`, etc.) are captured opportunistically when lists expose links; otherwise listed as coverage gaps.
