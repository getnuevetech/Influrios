# Navigation map — current → proposed

Rules applied: Influencer terminology · public ≠ workspace chrome · billing ≠ collab funds · Admin Users ≠ Access levels · no duplicate destinations · task-based labels · do not drop functionality just to shorten menus · Agency deferred.

Code sources: `site-chrome.tsx`, `marketing-header.tsx`, `account-shell.tsx` (`CREATOR_NAV` / `BUSINESS_NAV`), `admin/layout.tsx` `SIDE_GROUPS`.

---

## Public (guest)

### Current

| Item | Route | Notes |
|------|-------|-------|
| Home | `/` | |
| Discover Influencers | `/discover` | Header label varies |
| Categories | `/categories` | |
| Collaborations | `/collaboration` | Landing |
| For Businesses | `/business` | |
| Pricing | `/pricing` | MarketingHeader uses Influencer/Business Plans split |
| Search icon | `/discover` | |
| Log in | `/login` | Hidden `<sm` |
| Join Influrios | `/claim` | Influencer-skewed |
| Footer | Agency workspace, Intelligence, Checkout, … | Agency still linked |

**Mobile:** Nav + Log in not replaced by menu → **broken**.

### Proposed

| Item | Disposition | Notes |
|------|-------------|-------|
| Primary links | **Keep** in desktop header | Home, Discover, Categories, Collaboration, For Businesses, Pricing |
| Mobile menu | **Add** drawer/sheet | All primary links + Log in + Join |
| Log in | **Keep** + always reachable | Text link in menu; optional beside Join on mobile |
| Join | **Keep** → clarify | Primary “Join” opens role chooser (Influencer claim vs Business signup) — do not remove claim |
| MarketingHeader on `/pricing` | **Keep** Discover / Influencer Plans / Business Plans / Resources | Align Resources → FAQ |
| Footer Agency workspace | **Defer label** | “Agency — coming soon” or hide until Agency onboarding |
| Footer Checkout | **Redirect** | Point to Pricing / Billing, not orphan checkout |
| Mentorship | **Keep** route | Guest: explain value then CTA Log in / Join — avoid silent bounce |

**Details:** Marketing pages stay full pages (not popups). Profile overlays on Discover stay overlays; live Influencer Card stays full page `/c/[slug]`.

---

## Influencer (authenticated)

### Current (`CREATOR_NAV` + extras)

| Label | Route | Disposition |
|-------|-------|-------------|
| Dashboard | `/creator` | **Keep** |
| Action inbox | `/collaboration/inbox` | **Keep** — task inbox |
| My Profile | `/dashboard` (+ subroutes) | **Keep** — profile workspace (tabs remain) |
| Collaborations | `/collaboration/hub?view=collaborations` | **Keep** list; **detail → centered overview popup**; deliverables → **workroom** |
| Contracts | `/collaboration/contracts` | **Keep** list; agreement → **viewer dialog / full-screen** |
| Earnings & Payouts | `/creator/earnings` | **Keep** (collab money) |
| Messages | `/creator/messages` | **Keep** list+thread |
| Settings | `/account` | **Keep** |
| Plus / Billing & Plan | `/account?tab=billing` | **Keep** — subscription only |
| Media kit / Analytics | `/creator/media-kit`, `/analytics` | **Keep** reachable from Profile (avoid duplicate top-level unless usage demands) |
| `/payments` | often overlaps earnings | **Merge entry** under Earnings & Payouts; redirect `/payments` → earnings when influencer |

### Proposed structure

```
Dashboard
Action inbox
My Profile          → tabs: Overview | Details | Social | Links | KYC | Preferences | Media kit | Analytics
Collaborations      → tabs: Overview | Invitations | Active | Applications | History | …
                      row → centered Overview popup → Workroom (dedicated)
Contracts           → Agreements | Templates; row → agreement viewer
Messages
Earnings & Payouts  → Earnings | Payouts | (collab payment history)
Settings            → Account | Notifications | Password | Verification
Billing & Plan      → subscription only (footer/sidebar secondary)
```

**Mobile:** Replace or augment chip scroller with “More” drawer listing full labels; preserve badges.

**Terminology:** Prefer “Influencer” in chrome secondary label (already). Avoid “Creator” in customer-facing nav where easy.

---

## Business (authenticated)

### Current (`BUSINESS_NAV`)

| Label | Route | Disposition |
|-------|-------|-------------|
| Dashboard | `/business/home` | **Keep** |
| Action inbox | `/collaboration/inbox` | **Keep** |
| Company Profile | `/business/profile` | **Keep** |
| Discover Creators | `/discover` | **Rename** → Discover influencers |
| Collaborations | `/collaboration/business` | **Keep** tabs Requests / Opportunities / Active Collaborations |
| Contracts | `/collaboration/contracts` | **Keep** (+ viewer) |
| Analytics | `/business/intelligence` | **Keep** |
| Team | `/collaboration/team` | **Keep** |
| Billing & Plans | `/business/billing` | **Keep** subscription |
| Collaboration Payments | `/payments` | **Keep** — funds/milestones only |
| Verification | `/account/verification` | **Merge** under Settings tabs (keep deep link) |
| Settings | `/account?audience=business` | **Keep** |
| Propose / Records | `/collaboration/propose`, `/records` | **Keep** via Collaborations actions / Records entry — do not delete |

### Proposed Collaborations IA

```
Collaborations
  Tabs: Requests | Opportunities | Active Collaborations
  Requests list → View/Edit: centered popup (composer)
                 lifecycle: Draft / Publish / Invite / Close / Withdraw / Delete (gated)
  Active list → Overview popup → Workroom
  + New request → same popup system (new)
```

**Agency plan** on Billing: hide or “Coming soon” until Agency exists.

---

## Admin

### Current groups (condensed)

| Group | Proposal |
|-------|----------|
| Main menu (CMS pages) | **Keep** group; optional collapse under “Site content” |
| Members & access | **Keep** Influencer accounts, Business accounts, All accounts, **Admin users**, **Access levels** (separate), Invitations, Guest gates; Agency CMS **Keep** labeled “Agency (CMS)” |
| Subscriptions | **Keep** Plans & features ≠ Billing activity |
| Collaborations | **Keep**; prefer customer terms in page titles where possible |
| Payments & finance | **Keep** Payment settings; Tax as first-class section with Country+Product; Discount codes |
| Integrations & ops | **Keep** |

### Proposed chrome

| Change | Why |
|--------|-----|
| Remove or minimize **marketing** top nav while in `/admin/*` | Separate public vs authenticated chrome |
| Admin search stays | Ops utility |
| Mobile: sidebar → drawer | ADMIN-MOBILE-001 |
| Create button | Keep; scope menu to permitted modules |

**Do not merge** Admin users into Access levels.

---

## Agency

| Item | Disposition |
|------|-------------|
| `/agency` member app | **Deferred** — record missing entry path |
| Admin `/admin/agency` | CMS only until Agency onboarding ships |
| Public footer / Business plan “Agency” | Soft-gate copy |

---

## Cross-role popup vs page rules

| Content | Pattern |
|---------|---------|
| Request detail/edit | Centered popup |
| Active collab overview | Centered popup |
| Invitation review (accept/decline/withdraw) | Centered popup + confirm |
| Contract agreement | Full-screen dialog / dedicated viewer |
| Milestone workroom | Dedicated page `/collaboration/work/[id]` |
| Discover profile (directory) | Overlay OK if not substituting request popup |
| Admin Create/Edit plan, View account | Centered dialog (already) |
| Tax rule edit | Centered popup from list |

---

## Redirect sheet (if routes consolidate later)

| From | To | When |
|------|----|------|
| Influencer `/payments` | `/creator/earnings` | If payments UI fully nested |
| `/business/campaigns` | `/collaboration/business?tab=requests` | Alias already observed in audit |
| `/business/workspace` | `/collaboration/business` | Alias |
| `/register` | `/signup` | Already |
| Footer Checkout | `/pricing` or role billing | Soft |

No redirects required to ship mobile menu or popup pattern — those are additive.
