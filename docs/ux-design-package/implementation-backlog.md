# Implementation backlog (ordered packages)

No code in this phase. Packages are small, dependency-ordered, with measurable acceptance. Payment Standard v2 stays paused; Agency deferred.

| # | Package | Depends on | Routes / surfaces | Preserve | Change | Data / API | Permissions | Migration | Checks | Before / after evidence |
|---|---------|------------|-------------------|----------|--------|------------|-------------|-----------|--------|-------------------------|
| 1 | **UX-P1 Mobile public chrome** | — | `/` header, all marketing layouts using `SiteHeader` | Join, desktop nav, footer | Add mobile menu; expose Log in | None | Public | None | A-MOBILE-01/02; a11y menu | Before: `public/mobile/home.png` · After: delta folder mobile menu open + login |
| 2 | **UX-P1 Requests list→popup** | Shared dialog (`AccountDialog`) | `/collaboration/business`, `/collaboration/business/request/[id]` | List filters, composer fields, lock rules | Ensure View/Edit = centered popup; lifecycle actions; withdraw/delete gates | Briefs, invitations | Business workspace | None | A-REQ-01…04 | Before: `biz-collab.png` · After: list+detail+edit deltas |
| 3 | **UX-P1 Active overview + workroom link** | Dialog system | Collaborations Active tabs; `/collaboration/work/[id]` | Workroom page | Overview popup fields per §7 | Deals/funding | Influencer & business | None | A-ACTIVE-01…03 | Before: `collab-hub.png` · After: overview popup + workroom shot |
| 4 | **UX-P2 Member mobile chrome** | — | `account-shell` | Destinations, badges | Drawer/More; terminology Influencer | Badge counts | Member | None | A-MEMBER-MOBILE-01 | Before: any `*/mobile/*` member · After: drawer |
| 5 | **UX-P2 Admin chrome separation** | — | `/admin/*` layout | Sidebar groups, Users ≠ Access | Drop/minimize marketing top nav; optional mobile drawer | Admin modules | Admin session | None | A-ADMIN-CHROME-01, A-ADMIN-MOBILE-01 | Before: `admin-dash.png` |
| 6 | **UX-P2 Messages reply** | — | `/creator/messages` | List | Thread + reply a11y | Messages API | Influencer | None | A-MSG-01 | Before: `messages-state.png` |
| 7 | **UX-P2 Contracts viewer** | Signing channel | `/collaboration/contracts` | List | Full-screen professional viewer; integrity | Contract docs | Parties | Versioning only | A-CONTRACT-01 | Before: contracts list · After: viewer |
| 8 | **UX-P2 Tax admin simplify** | — | `/admin/payment-settings` Tax | Calc engine inputs needed | Country+Product UI; remove filing-owner from calc; one tax line previews | Tax rules | Payments Admin | None | A-TAX-01…03 | Before: payment-settings · After: tax popup |
| 9 | **UX-P2 Pricing polish** | — | `/pricing`, billing pages | Plan prices from admin | Collapse compare; annual equiv; hide Agency CTA | Entitlements | Public/member | None | A-PRICE-01, A-AGENCY-PLAN-01 | Before: pricing/biz-billing |
| 10 | **UX-P2 Inbox dedupe + badges** | — | Action inbox, sidebar badges | Inbox concept | Dedupe tasks; clarify badge semantics | `action-inbox-load`, `sidebar-badges` | Member | None | A-INBOX-01, A-BADGE-01 | Before: collab-detail/inbox |
| 11 | **UX-P3 Vanity + footer + terms** | Product decisions | `/c/*`, footer, business nav label | Shortlinks | Redirect or docs; Agency footer; Discover Influencers label | Short links | Public | None | A-CARD-01, A-FOOTER-01, A-TERM-01 | |
| 12 | **Ops metrics / webhook** | Definitions from Ola | `/admin` | Dashboard layout | Fix math/definitions; remediation link | Admin dashboard queries | Admin | None | A-ADMIN-KPI-01, A-ADMIN-HOOK-01 | Not UI-redesign critical path |
| 13 | **Unblock live Discover** | Ola go-ahead | Guest gates, `/discover` | Demo mode honesty | Enable live profiles | Directory | Admin guests | None | A-DISCOVER-01 | After gates change |
| 14 | **Sandbox checkout evidence** | Isolated mocks | Checkout | — | Capture discount+tax totals | Stripe/Airwallex test | — | — | A-CHECKOUT-01 | **Blocked** until mocks |
| — | **Payment Standard v2** | Full completion later | Payment settings broadly | — | **Paused** | — | — | — | — | Out of this backlog active work |
| — | **Agency member app** | Account creation | `/agency` | Admin CMS page | **Deferred** | — | — | — | — | Record missing entry path |

## Suggested ship order for first redesign PR train

1 → 4 (chrome) → 2 → 3 (collab popups) → 10 → 6 → 7 → 9 → 8 → 5 → 11; ops 12 parallel; 13–14 when unblocked.
