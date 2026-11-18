# Journey reviews

Connected sequences from baseline captures + recordings. Pair with `/cursor/stores/self/docs/visual-audit/journeys.md` and `/cursor/stores/self/docs/visual-audit/recordings.md`.

Evidence root: `/cursor/stores/self/media/visual-audit/`.

---

## 1. Public discovery

**Path:** Home → Discover → filters/search → demo profile overlay → (intended) live book / invite  
**Evidence:** `screenshots/public/desktop/home.png`, `discover.png`, `discover-search-fashion.png`, `discover-more-filters.png`, `discover-profile-demo-*.png`; recording `recordings/public-discover-to-profile.webm`

| Finding | Type |
|---------|------|
| Sample directory banner blocks live booking | Dead end / intentional gate |
| Demo profiles clearly labeled — good honesty; cannot complete hire | Missing action |
| Live card available via `inflr.me/ag` → `/c/ag-olomola-2`, not via Discover | Split discovery model |
| Mobile home: no nav menu / Log in | Dead end for returning users |

**Next after completion (proposed):** Live profile → Contact / Hire → login gate → business request or message — not auditable until guest gates allow live directory.

---

## 2. Registration

**Path:** Pricing / Join → `/claim` or `/signup` → validation → (verify) → workspace  
**Evidence:** `pricing.png`, `signup.png`, `signup-validation-empty.png`, `claim.png`, `register.png`

| Finding | Type |
|---------|------|
| Empty-field validation present | OK |
| Join Influrios → `/claim` (influencer-skewed); business path via `/business` / `/signup` less obvious on mobile | Terminology / entry confusion |
| Full email verification / password set not recorded | Coverage gap |
| Mentorship deep-link bounced toward login | Dead end for guests |

---

## 3. Returning user

**Path:** Mobile/desktop home → Log in → role home  
**Evidence:** `public/mobile/home.png`, `login.png`, influencer/business `post-login-home.png`

| Finding | Type |
|---------|------|
| Desktop Log in visible | OK |
| Mobile Log in `display:none`, no hamburger | **Blocks core task** |
| Member shells use horizontal nav chips on `<lg` (sidebar hidden) — workable but dense | Mobile hierarchy |
| Admin/marketing dual chrome when admin signed in | Clutter |

---

## 4. Business collaboration

**Path:** Business home → Discover → Collaborations (Requests) → View/New request → invite → contract → fund → active work  
**Evidence:** `biz-home.png`, `biz-discover.png`, `discover-profile-authed.png`, `biz-collab.png`, `biz-inbox.png`, `biz-contracts.png`, `biz-payments.png`; recording `business-home-discover-collab.webm`

| Finding | Type |
|---------|------|
| Requests list clear with lifecycle filters (Open/Drafts/…) | OK vs §7 list |
| “View” does not show evidenced centered detail popup in pack | Missing interaction proof |
| Closed requests still expose “Open collaboration” — good for signed/funded retention | Aligns with §7 signed/funded |
| Inbox mixes Invitation + Funding required; Open on notification ≠ complete task (copy repeated) | Duplicate mental model / terminology |
| Sample Discover blocks invite from directory | Dead end |
| Funding / invite acceptance **blocked** in audit policy | Blocked |
| Agency plan still offered on Billing while Agency deferred | Misleading status |

**Dead ends:** Invite send, fund confirmation, withdraw/delete with reason.

---

## 5. Influencer collaboration

**Path:** Login → Dashboard → Action inbox / Collaborations → Contracts → Earnings  
**Evidence:** `creator-home.png`, `action-inbox.png`, `collab-hub.png`, `contracts.png`, `earnings.png`, `messages-state.png`; recording `influencer-login-inbox-contracts.webm`

| Finding | Type |
|---------|------|
| Dashboard surfaces invitation + active rows with next actions | OK |
| Inbox shows duplicate rows for same campaigns (3× each of two) | Misleading status / data aggregation |
| Collaborations hub: badge “1” vs Active “2” / list of 2 | Inconsistent counts |
| “Open deliverables” present but workroom not captured | Gap |
| Contracts list all “Fully signed” — no pending-sign state in evidence | Gap |
| Messages list only — no reply | Gap |
| Payout setup CTA good; real payout blocked | Blocked |

---

## 6. Subscription

**Path:** Public `/pricing` or member Billing → Monthly/Annual → Choose plan → checkout  
**Evidence:** `public/.../pricing.png`, `biz-billing.png`, `admin-plans.png`

| Finding | Type |
|---------|------|
| Monthly/Annual toggle present; Compare collapsed behind button | Matches §7 |
| Tax note “Applicable tax shown at checkout” — checkout not evidenced | Gap / blocked |
| Admin plans show base/tax/total preview for US | Partial tax presentation |
| Influencer sidebar “Plus / Billing & Plan” vs Business “Billing & Plans” + “Collaboration Payments” | Good separation nascent; keep in nav map |

---

## 7. Contract

**Path:** Contracts list → View agreement → preview/sign/PDF → funded work  
**Evidence:** influencer/business `contracts*.png`; admin `admin-contracts.png`, `admin-signing.png`

| Finding | Type |
|---------|------|
| List professional enough; statuses green Fully signed | Partial |
| No capture of agreement dialog body / PDF / signature ceremony | Gap |
| Footer CTAs in code distinguish Review and sign vs Fund vs Open deliverables | Good product model; not visually proven in pack |

---

## 8. Admin operations

**Path:** Admin login → Dashboard → Users / Plans / Payment settings / Deals  
**Evidence:** `admin-dash.png`, accounts dialogs, `admin-plans.png`, payment-settings*, `deal-detail.png`; recording `admin-payment-settings-tour.webm`

| Finding | Type |
|---------|------|
| KPI Active Collaborations = 0 while members show active funded work | Misleading status |
| Marketplace webhook ATTENTION without remediation CTA | Missing action |
| Plans & Billing already separate tabs | Aligns with §7 |
| Payment settings extremely dense (fees + switches + jurisdictions) | Hierarchy / mobile |
| Marketing top nav + admin sidebar on phone | Dense chrome |
| Agency admin page present; member Agency deferred | Document as CMS-only |

---

## Cross-journey terminology watchlist

| Term A | Term B | Risk |
|--------|--------|------|
| Collaborations (sidebar) | Requests / Opportunities / Active Collaborations (tabs) | OK if tabs explained |
| Action inbox | Notifications sidebar | Overlap — opening ≠ resolving |
| Join Influrios | Log in | Mobile loses Log in |
| Creators (business nav “Discover Creators”) | Influencer (product term) | Prefer Influencer in customer UI |
| Collaboration Payments | Billing & Plans | Keep separate (required) |
| Deals (admin) | Collaborations / Requests (members) | Internal vs customer language |
