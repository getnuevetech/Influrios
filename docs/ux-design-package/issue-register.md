# Issue register (expanded)

Severity ladder (Ola §4): **P0** security/money/data loss · **P1** blocks core task · **P2** nav/status/steps/hierarchy/mobile · **P3** cosmetic.  
Baseline issues from `/cursor/stores/self/docs/visual-audit/issues.md` retained and remapped. Do not invent causes from screenshots alone.

Evidence paths under `/cursor/stores/self/media/visual-audit/screenshots/` unless noted.

---

## Summary

| ID | P | Roles | Title | Root cause family |
|----|---|-------|-------|-------------------|
| MOBILE-NAV-001 | P1 | public | Mobile marketing header hides primary nav | Public mobile chrome |
| MOBILE-LOGIN-001 | P1 | public, influencer, business | Mobile home has no visible Log in | Public mobile chrome |
| MEMBER-MOBILE-NAV-001 | P2 | influencer, business | Member sidebar replaced by dense chip scroller only | Member mobile chrome |
| ADMIN-MOBILE-001 | P3 | admin | Admin chrome dense on phone | Admin mobile chrome |
| ADMIN-KPI-001 | P2 | admin | KPI ↓100% / Active Collabs 0 vs member reality | Metrics definition |
| ADMIN-WEBHOOK-001 | P2 | admin | Marketplace webhook ATTENTION | Ops health surfacing |
| DISCOVER-SAMPLE-001 | P2 | public, business | Discover sample mode blocks live booking | Guest gates / directory |
| CARD-VANITY-001 | P3 | public, influencer | `/c/ag` 404 on primary host | Vanity routing |
| INBOX-DUP-001 | P2 | influencer | Duplicate action-inbox rows for same campaigns | Task aggregation |
| BADGE-COUNT-001 | P2 | influencer | Sidebar Collaborations badge ≠ Active count | Badge semantics |
| REQUEST-POPUP-001 | P1 | business | Request detail/edit not evidenced as centered popup from list | List→popup pattern |
| ACTIVE-OVERVIEW-001 | P1 | influencer, business | Active collab overview popup + workroom states missing | List→popup / workspace |
| MSG-REPLY-001 | P2 | influencer | Messages lack evidenced reply flow | Messages completeness |
| CONTRACT-VIEW-001 | P2 | influencer, business | Agreement preview/sign/PDF not evidenced | Contract viewer |
| TAX-MODEL-001 | P2 | admin | Tax UI denser than Country+Product model | Tax admin IA |
| CHECKOUT-TOTALS-001 | P1 | public, business, influencer | Discount+tax+total consistency unproven | Checkout evidence blocked |
| AGENCY-PLAN-001 | P2 | business | Agency plan offered while Agency deferred | Entitlement surfacing |
| TERM-CREATOR-001 | P3 | business | “Creators” in nav vs Influencer terminology | Terminology |
| DUAL-CHROME-001 | P2 | admin | Marketing header + admin sidebar dual chrome | Chrome separation |
| FOOTER-AGENCY-001 | P3 | public | Footer advertises Agency workspace while deferred | Marketing vs readiness |

---

## Detail

### MOBILE-NAV-001 — Mobile marketing header hides primary nav (no menu)

- **Priority:** P1 · **Roles:** public · **Family:** Public mobile chrome  
- **URL:** https://influrios.com/  
- **Evidence:** `public/mobile/home.png`; Playwright style probe 2026-11-18 (issues.md): header links in DOM, Log in `display:none`, no hamburger. Code pattern: `SiteHeader` nav `hidden … lg:flex`, Login `hidden … sm:inline` (`/workspace/src/components/site-chrome.tsx`).  
- **Repro:** Open `/` at 390×844 → only logo, search, Join visible.  
- **Expected:** Mobile menu (or equivalent) exposes primary nav.  
- **Impact:** Guests cannot reach Discover/Categories/Collaboration/Business/Pricing from header without scrolling to footer.  
- **Correction:** Add accessible mobile menu for marketing header; do not hide nav without replacement.  
- **Acceptance:** See [acceptance-checklist.md](./acceptance-checklist.md) A-MOBILE-01.  
- **Deps / owner:** Shared public chrome · Package **UX-P1 Mobile public chrome**

### MOBILE-LOGIN-001 — Existing users cannot reach `/login` from mobile homepage

- **Priority:** P1 · **Roles:** public, influencer, business · **Family:** Public mobile chrome  
- **Evidence:** Same as MOBILE-NAV-001; probe: no visible log* links in first viewport/footer probe.  
- **Repro:** Mobile home → seek Log in → absent; Join → `/claim`.  
- **Expected:** Log in visible in menu or beside Join.  
- **Impact:** Returning users blocked unless they know `/login`.  
- **Correction:** Same fix family as MOBILE-NAV-001; separate acceptance.  
- **Acceptance:** A-MOBILE-02  
- **Deps:** UX-P1 Mobile public chrome

### MEMBER-MOBILE-NAV-001 — Member apps rely on horizontal chip nav only

- **Priority:** P2 · **Roles:** influencer, business  
- **Evidence:** Influencer/business mobile screenshots show top chip scroller; sidebar `hidden … lg:flex` in `account-shell.tsx`.  
- **Expected:** Clear current section + reachable labels without losing Billing vs Payments distinction.  
- **Correction:** Keep chip bar or replace with drawer; ensure active item + overflow labels (Earnings & Payouts, Collaboration Payments).  
- **Acceptance:** A-MEMBER-MOBILE-01  
- **Deps:** UX-P2 Member chrome

### ADMIN-MOBILE-001 — Admin chrome dense on mobile

- **Priority:** P3 · **Roles:** admin  
- **Evidence:** `admin/mobile/admin-dash.png`  
- **Expected:** Either drawer sidebar or documented desktop-first.  
- **Correction:** Collapse admin sidebar to drawer on small screens **or** document desktop-first ops.  
- **Acceptance:** A-ADMIN-MOBILE-01  
- **Deps:** UX-P3 Admin polish

### ADMIN-KPI-001 — Admin overview KPIs disagree with member apps

- **Priority:** P2 · **Roles:** admin  
- **Evidence:** `admin/desktop/admin-dash.png` (↓100%, Active Collaborations 0) vs `influencer/desktop/creator-home.png` (Active collaborations 3) / `business/desktop/biz-home.png`.  
- **Do not assume:** Cause may be empty prior window math, definition mismatch, or staging data — investigate before UI-only “fix.”  
- **Expected:** Period math safe when prior=0; Active Collaborations aligned with member definitions.  
- **Acceptance:** A-ADMIN-KPI-01  
- **Deps:** Metrics eng · after definition decision by Ola

### ADMIN-WEBHOOK-001 — Marketplace webhook ATTENTION

- **Priority:** P2 · **Roles:** admin  
- **Evidence:** `admin/desktop/admin-dash.png`  
- **Expected:** OPERATIONAL or precise remediation link.  
- **Acceptance:** A-ADMIN-HOOK-01  
- **Deps:** Ops / marketplace health · not a redesign blocker

### DISCOVER-SAMPLE-001 — Sample directory blocks live booking audit

- **Priority:** P2 · **Roles:** public, business  
- **Evidence:** `public/desktop/discover.png`, demo profile overlays; guests-gates capture.  
- **Expected:** When ready, live profiles bookable; until then banner stays truthful.  
- **Correction:** Enable live directory via guest gates when Ola requests; keep demo mode labeled.  
- **Acceptance:** A-DISCOVER-01 (when enabled)  
- **Deps:** Admin guest gates · blocked for live hire UX until enabled

### CARD-VANITY-001 — Vanity `/c/ag` 404 on influrios.com

- **Priority:** P3 · **Roles:** public, influencer  
- **Evidence:** `live-card-ag.png` (404), `live-card-inflr-me-ag.png`, `live-card-ag-olomola-2.png`  
- **Expected:** Document-only vanity on inflr.me **or** primary-host redirect.  
- **Acceptance:** A-CARD-01  
- **Deps:** Short-link routing

### INBOX-DUP-001 — Duplicate Action inbox tasks

- **Priority:** P2 · **Roles:** influencer  
- **Evidence:** `influencer/desktop/collab-detail.png` / action-inbox: three identical “4th Test…” and three “3rd Testing…” rows.  
- **Expected:** One task per required action (copy already claims this).  
- **Correction:** Dedupe aggregation by fundingId/action kind; verify fixture data.  
- **Acceptance:** A-INBOX-01  
- **Deps:** Action inbox load · data hygiene

### BADGE-COUNT-001 — Collaborations badge ≠ Active count

- **Priority:** P2 · **Roles:** influencer  
- **Evidence:** `collab-hub.png` — sidebar badge 1 vs Active 2 / list of 2.  
- **Expected:** Badge semantics documented (attention count ≠ active count) **or** aligned.  
- **Acceptance:** A-BADGE-01  
- **Deps:** `sidebar-badges.ts`

### REQUEST-POPUP-001 — Request detail/edit as centered popup

- **Priority:** P1 · **Roles:** business · **§7** Requests  
- **Evidence:** List `biz-collab.png`; code route `/collaboration/business/request/[id]` uses centered overlay — **open-from-list states not in baseline pack**.  
- **Expected:** View/Edit open centered popup (not under-table, not right rail); lifecycle actions visible; filters/scroll preserved.  
- **Acceptance:** A-REQ-01 … A-REQ-04  
- **Deps:** UX-P1 Requests package · designs in `designs/requests.md`

### ACTIVE-OVERVIEW-001 — Active collaboration overview popup + workroom

- **Priority:** P1 · **Roles:** influencer, business · **§7** Active collaborations  
- **Evidence:** Lists in `collab-hub.png`, business Collaborations tabs; workroom `/collaboration/work/[fundingId]` **uncaptured**.  
- **Expected:** Overview popup with status, participants, next action, milestones, workroom link; workroom for complex work.  
- **Acceptance:** A-ACTIVE-01 … A-ACTIVE-03  
- **Deps:** UX-P1 Active collabs package

### MSG-REPLY-001 — Messages reply flow incomplete in evidence

- **Priority:** P2 · **Roles:** influencer · **§7** Messages  
- **Evidence:** `messages.png`, `messages-state.png`  
- **Expected:** Unread, latest message, collab context, accessible reply.  
- **Acceptance:** A-MSG-01  
- **Deps:** UX-P2 Messages

### CONTRACT-VIEW-001 — Contract preview / integrity not evidenced

- **Priority:** P2 · **Roles:** influencer, business · **§7** Contracts  
- **Evidence:** lists only  
- **Expected:** Professional document viewer; no contradictory statuses; signing/PDF paths clear.  
- **Acceptance:** A-CONTRACT-01  
- **Deps:** UX-P2 Contracts · signing completion may be blocked on staging policy

### TAX-MODEL-001 — Tax admin not Country+Product simple model

- **Priority:** P2 · **Roles:** admin · **§7** Tax  
- **Evidence:** `admin-payment-fees.png` / payment-settings density; tax tab not isolated in dedicated capture.  
- **Expected:** Country + Product/charge selection; one tax line in previews; no filing-owner in calc setup; zero/exempt allowed.  
- **Acceptance:** A-TAX-01 … A-TAX-03  
- **Deps:** UX-P2 Tax · Payment v2 remains paused for broader payment work

### CHECKOUT-TOTALS-001 — Discount + tax + total consistency unproven

- **Priority:** P1 · **Roles:** public, business, influencer  
- **Evidence:** Pricing/billing show “tax at checkout” only; no checkout capture with discount.  
- **Expected:** Base, discount, tax (once), total identical in preview and checkout.  
- **Status:** **Blocked** until isolated checkout mock.  
- **Acceptance:** A-CHECKOUT-01 (when unblocked)  
- **Deps:** Sandbox checkout fixtures

### AGENCY-PLAN-001 — Agency plan card while Agency deferred

- **Priority:** P2 · **Roles:** business  
- **Evidence:** `biz-billing.png` Agency $349 upgrade  
- **Expected:** Hide/disable Agency upgrade **or** label coming-soon until Agency onboarding exists.  
- **Acceptance:** A-AGENCY-PLAN-01  
- **Deps:** Product decision

### TERM-CREATOR-001 — “Discover Creators” vs Influencer terminology

- **Priority:** P3 · **Roles:** business  
- **Evidence:** Business sidebar label in `biz-collab.png`  
- **Expected:** Customer-facing **Influencer** wording.  
- **Acceptance:** A-TERM-01  
- **Deps:** Nav copy pass

### DUAL-CHROME-001 — Admin marketing top nav + ops sidebar

- **Priority:** P2 · **Roles:** admin  
- **Evidence:** Admin desktop/mobile screenshots  
- **Expected:** Authenticated admin chrome separated from public marketing nav (Ola §5).  
- **Acceptance:** A-ADMIN-CHROME-01  
- **Deps:** UX-P2 Admin chrome

### FOOTER-AGENCY-001 — Footer Agency workspace while deferred

- **Priority:** P3 · **Roles:** public  
- **Evidence:** Footers across captures  
- **Expected:** Remove or “Coming soon” until Agency ready.  
- **Acceptance:** A-FOOTER-01  

---

## Root-cause consolidations

| Family | Issues | One implementation theme | Separate acceptance |
|--------|--------|--------------------------|---------------------|
| Public mobile chrome | MOBILE-NAV-001, MOBILE-LOGIN-001 | Marketing mobile menu | A-MOBILE-01, A-MOBILE-02 |
| Member mobile chrome | MEMBER-MOBILE-NAV-001 | Member drawer/chips polish | A-MEMBER-MOBILE-01 |
| List→centered popup | REQUEST-POPUP-001, ACTIVE-OVERVIEW-001 | Shared dialog system (`AccountDialog` pattern) | Per-flow A-* |
| Metrics / badges | ADMIN-KPI-001, BADGE-COUNT-001, INBOX-DUP-001 | Definition + aggregation | Per metric |
| Directory readiness | DISCOVER-SAMPLE-001, CARD-VANITY-001 | Guest gates + vanity routing | Per gate |
| Money evidence | CHECKOUT-TOTALS-001, tax preview | Isolated mocks | Unblock first |
