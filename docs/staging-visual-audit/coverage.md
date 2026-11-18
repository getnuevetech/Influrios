# Coverage report

What was reviewed, what failed, and what remains inaccessible or intentionally untested.

Generated: 2026-11-18T09:41:03.289Z

## Summary

| Role | Planned routes | Screenshot captures (all states/viewports) | Notes |
|------|----------------|--------------------------------------------|-------|
| Public | 17 | 56 | Guest + validation/search extras |
| Influencer | 23 | 57 | AUDIT_INFLUENCER_* |
| Business | 17 | 44 | AUDIT_BUSINESS_* |
| Admin | 48 | 118 | AUDIT_ADMIN_* |
| Agency | 5 | 0 | **Deferred / out of scope** (preferences.md) |

Total screenshot captures: **275**  
Workflow recordings: **4**  
Automated issues: **7**

## Agency (deferred / untested)

Per project preference, Agency account creation does not exist yet and Agency role coverage is skipped until after this audit.

| Path | Title | Status |
|------|-------|--------|
| `/agency` | Agency overview | deferred — Agency role deferred per preferences.md |
| `/agency?view=clients` | Agency clients | deferred — Agency role deferred |
| `/agency?view=roster` | Agency roster | deferred — Agency role deferred |
| `/agency?view=campaigns` | Agency campaigns | deferred — Agency role deferred |
| `/agency?view=team` | Agency team | deferred — Agency role deferred |

Note: `/admin/agency` was captured as an **Admin** CMS page only; that is not an Agency-role journey.

## Failed navigations

_None recorded._

## Inaccessible / opportunistic gaps

- **public** `/creators/[slug] (live directory)` — Discover is in sample/demo mode; profile overlays use /discover?profile=demo-* (captured). Live bookable /creators/[slug] directory not enabled on staging banner.

## Interaction states captured

- public/desktop: `login-validation-empty` (validation)
- public/desktop: `signup-validation-empty` (validation)
- public/desktop: `discover-search-fashion` (search)
- public/mobile: `login-validation-empty` (validation)
- public/mobile: `signup-validation-empty` (validation)
- public/mobile: `discover-search-fashion` (search)
- business/desktop: `biz-restricted-admin` (restricted)
- business/mobile: `biz-restricted-admin` (restricted)
- admin/desktop: `admin-accounts-dialog-1` (dialog — View account)
- admin/desktop: `admin-plans-dialog-0` (dialog — Create plan)
- admin/desktop: `admin-plans-dialog-1` (dialog — Edit)
- admin/desktop: `admin-plans-dialog-2` (dialog — Edit)
- admin/mobile: `admin-accounts-dialog-1` (dialog — View account)
- admin/mobile: `admin-plans-dialog-0` (dialog — Create plan)
- admin/mobile: `admin-plans-dialog-1` (dialog — Edit)
- admin/mobile: `admin-plans-dialog-2` (dialog — Edit)
- public/desktop: `discover-profile-demo-amara` (detail)
- public/desktop: `discover-profile-demo-daniel` (detail)
- public/desktop: `discover-profile-demo-marcus` (detail)
- public/desktop: `discover-more-filters` (filters)
- public/desktop: `live-card-ag` (detail)
- public/desktop: `creators-slug-ag` (detail)
- public/mobile: `discover-profile-demo-amara` (detail)
- public/mobile: `discover-profile-demo-daniel` (detail)
- public/mobile: `discover-profile-demo-marcus` (detail)
- public/mobile: `discover-more-filters` (filters)
- public/mobile: `live-card-ag` (detail)
- public/mobile: `creators-slug-ag` (detail)
- influencer/desktop: `collab-detail` (detail)
- influencer/desktop: `messages-state` (list)
- business/desktop: `propose-validation` (validation)
- business/desktop: `discover-profile-authed` (detail)
- admin/desktop: `deal-detail` (detail)
- admin/desktop: `guests-gates` (settings)

## Explicitly out of scope / not exercised

- Real financial transactions / live payment confirmation (Stripe checkout submit, fund collaboration confirm, payout release)
- Notifications to real customers (invite send, email blast, SMS, accept/decline invitation actions)
- Payment Standard v2 implementation or UI redesign
- Agency member role journeys (`AUDIT_AGENCY_*` present but unused)
- Live Discover booking of non-demo creators (directory sample mode — see DISCOVER-SAMPLE-001)
- Some dynamic workroom/PDF routes (`/collaboration/work/[fundingId]`, contract PDF) unless linked from captured lists

## Opportunistic detail captures that did succeed

- Discover demo profile overlays (`/discover?profile=demo-*`)
- Live influencer card via `https://inflr.me/ag` → `/c/ag-olomola-2`
- Influencer collaboration detail + messages list
- Business propose validation + authed discover profile
- Admin deal detail + guests gates + payment-settings sections + plans dialogs
- Business restricted access bounce to `/admin/login`

## Viewports

- Desktop: 1440×900
- Mobile: 390×844
