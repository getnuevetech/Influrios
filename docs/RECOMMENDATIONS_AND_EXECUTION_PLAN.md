# Influrios — Recommendations & Execution Plan

**Status:** For stakeholder review (aligned to Product Strategy v2.2)  
**Repo:** `getnuevetech/Influrios`  
**Sources reviewed:** Product Strategy v2.2 · 14 design templates · card/background assets  
**Date:** 2026-09-29 · **Doc version:** 2.0

---

## 1. Executive summary

**Influrios** is an **Influence Discovery & Collaboration Platform** — not another follower-count directory. Positioning: *“Find the right influence. Build the right collaboration.”* Brand line: *“Influence. Identity. Opportunity.”*

Four connected engines from the strategy:

| Engine | Job | Monetization |
|--------|-----|--------------|
| **Influence Discovery** | Search by specialty, audience, geography, platform | Traffic + freemium |
| **Creator Collaboration Network** | Complementary creator ↔ creator matching | Pro / collab tools |
| **Influencer Card + Share Identity** | Portable commercial identity (link → QR → dynamic QR by tier) | Creator Pro / card SKU |
| **Business Matching + Managed Promotion** | Intros, shortlists, facilitated deals | B2B subs + managed fees |

**Verdict:** Strategy v2.2 is coherent and execution-ready. It correctly prioritizes **density (free discovery + card)** before marketplace/escrow complexity. Our earlier design-only review is **superseded** by this doc on naming, tiers, QR rules, colors, onboarding, and phase order.

**Ship order (aligned):** Taxonomy → claimable profiles + tier-aware Card → specialty search → I offer / I need collab → Business Pro → managed matching (manual first) → intelligence.

---

## 2. Decisions resolved by v2.2

| Topic | Prior open question | **Locked by v2.2** |
|-------|---------------------|---------------------|
| Product name | Influrios vs Influence Connect | **Influrios** only. Do not revive “Influence Connect” in production UI, emails, cards, QR landings, or admin. |
| Card product name | — | **Influrios Card** or **Influencer Card by Influrios**; “Influencer Card” = category term |
| Card vs Profile | Blurred in mockups | **Card** = portable identity & connection · **Profile** = discovery, intelligence, portfolio depth |
| Starter QR | Mockups showed QR on Starter | **No QR at Starter** (launch default). Plus = standard QR + shortlink. Pro = **dynamic** platform QR |
| Starter socials | — | **1** public social link (admin-configurable) |
| Specialties | — | Starter **1** · Plus **up to 3** · Pro admin-configured higher limit |
| Color system | Generic purple AI look | Blue = trust/platform · Purple = creator/collab · Pink = sparse accent · **Champagne gold = Pro only** |
| Onboarding | Missing from mockups | **Value before registration:** draft card → claim → verify → publish Starter |
| Monetization | Implied | Creator Pro $12–25 · Business Pro $79–129 · Agency $249–499 · Managed + success fees |
| MVP rule | — | **No** escrow, payouts, full contracts, or social publishing in early phases |

Remaining decisions for engineering kickoff: §12.

---

## 3. Reconciliation: designs vs strategy

Mockups remain valid for **layout hierarchy and tier feel**. Production must diverge where strategy overrides them.

| Design artifact | Strategy correction |
|-----------------|---------------------|
| “Influence Connect” wordmarks | Replace with **Influrios** everywhere in production |
| Starter cards with QR / multi-social | Strip QR; one social; one specialty; profile URL only |
| Plus cards | Shortlink + **standard** QR; up to 3 specialties / 4 socials |
| Pro cards | Dynamic QR (`ic.me/q/{opaqueId}`); gold accents only on badge/border/highlights |
| Horizontal “card” website modules | Allowed as **previews only**; canonical card is **portrait ~4:5** |
| Baked-in follower counts / QR bitmaps | Live UI components + server-rendered QR; no rasterized live data |
| Brand logos (Nike, Samsung, etc.) | Placeholders / partners only |
| Demographics / engagement dashboards | Post-MVP intelligence; label data source when shown |

**Action:** Treat comps as visual references; implement responsive components driven by an **entitlement matrix** (admin-editable), not hard-coded plan names.

---

## 4. Product model (engineering view)

### 4.1 Influence DNA (profile)

Not a vanity score. Fields should answer *what they influence* and *commercial fit*:

- Primary + secondary specialties (entitlement-capped)  
- Content concentration / style  
- Verified social accounts + freshness timestamps  
- Geography + languages  
- Portfolio / featured content  
- Disclosed brand history  
- Commercial services + availability  
- Collaboration offers & needs  
- Contact routing (platform-mediated preferred)  
- Optional rate card / request quote  
- Verification status + last refreshed  

**Avoid** a single universal influencer score. Prefer **topic-specific strength / fit** explanations.

### 4.2 Influencer Card (standalone SKU)

Vertical digital business card, **monetizable alone** or bundled with creator plans.

| Capability | Starter | Plus | Pro |
|------------|---------|------|-----|
| Public vertical card | ✓ | ✓ | ✓ |
| Specialties | 1 | ≤3 | Admin limit |
| Social links | 1 | ≤4 | Admin / all supported |
| Profile URL | ✓ | ✓ | ✓ |
| Shortlink | — | ✓ | ✓ (+ custom alias if entitled) |
| QR | — | Standard → card URL | **Dynamic** opaque redirect |
| Contact / inquiry | Limited / none | ✓ | ✓ + richer lead route |
| Collab CTA | Config | Optional | ✓ |
| Portfolio | None / minimal | Limited | Expanded |
| Analytics | Basic views | Views / scans / clicks | + leads / advanced QR |
| Themes | Platform default | Limited | Full creator-brand colors |
| Platform branding | Visible | Reduced | Minimal / removable if entitled |
| Media kit / brand history | — | Optional | ✓ |
| Lead tracking | — | Limited | ✓ |

Commercial rule: table = **launch defaults**. Admin must change limits per plan/country/promo **without deploy**.

### 4.3 QR & link strategy

```
Starter  →  influrios.com/c/{slug}          (no QR)
Plus     →  ic.me/{alias}  +  static QR → card URL
Pro      →  ic.me/q/{opaqueToken}  (redirect table; content changes without reprinting QR)
```

Pro analytics (privacy-permitted): scan count, time, campaign/source, device class, **coarse** geo — not precise location.

### 4.4 Collaboration network

Complementary matching, not competition:

1. Declare offers / needs  
2. Match (specialty complementarity, audience adjacency, geo, platform, availability)  
3. Propose structured collab  
4. Build joint scope  
5. Showcase joint case study  

Separate match engines: **Creator→Creator**, **Business→Creator**, **Business→Creator Team** — each with explainable “Why this match?”

### 4.5 Managed layer (later, manual-first)

Opt-in promotion → package media kit → target businesses → permissioned intros → facilitate brief → retain as recurring. Pilot with humans before automation.

---

## 5. Design system (from v2.2 tokens)

### Brand colors

| Token | Hex | Use |
|-------|-----|-----|
| Deep Indigo | `#111A5A` | Trust, nav, strong text |
| Royal Violet | `#633CFF` | Creator identity, collab, primary gradient |
| Electric Blue | `#2979FF` | Platform actions, links |
| Soft Lavender | `#EAE4FF` | Soft surfaces, chips |
| White | `#FFFFFF` | Card surfaces |
| Pink Accent | `#E879F9` | Energy only — sparingly |
| Champagne Gold | `#D7B56D` | **Pro-only** accents |

### Tier surfaces (implement as CSS variables)

- **Starter:** white / `#F7FAFF` / soft blue-lavender · low glow · clear Influrios branding  
- **Plus:** electric blue ↔ royal violet · moderate glow · shortlink + QR visible  
- **Pro:** `#0B123F` / deep indigo · gold on badge/border only · dynamic QR prominent  

Accessibility: color never sole plan indicator; WCAG AA; explicit tier labels; test creator-custom Pro themes.

Prefer CSS/SVG for aurora backgrounds; use raster backgrounds (`influencer_card_*_background.png` refs) only where needed for Pro/splash.

---

## 6. Architecture recommendations

### 6.1 Stack (default)

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) + TypeScript |
| UI | Tailwind + CSS design tokens (tier themes) |
| DB | PostgreSQL + Prisma |
| Hosting | **AWS Lightsail** — Ubuntu, Nginx, PM2, managed Postgres |
| Auth | Clerk or Auth.js (roles: creator, business, agency, admin) |
| Files | S3 or Lightsail bucket for avatars / portfolio |
| Short links / QR | Own redirect service + server QR generation |
| Billing | Stripe (Creator / Business / Agency / card SKUs) |
| Search | Postgres → Meilisearch/Typesense when filter load grows |
| Entitlements | DB-driven plan feature flags (not `if (plan === 'pro')` in UI) |

### 6.2 Core data model (relationship-first)

`Creator` · `SocialAccount` · `Specialty` · `AudienceSnapshot` · `CollaborationOffer` · `CollaborationNeed` · `BusinessProfile` · `Opportunity` · `Relationship` · `InfluenceCard` · `EntitlementPlan` · `EntitlementOverride` · `QrRedirect` · `AnalyticsEvent` · `Invitation` (admin/brand/creator/agency) · `AttributionTouch`

Label fields as `creator_claimed` vs `platform_verified` vs `provider_synced` + `refreshed_at`.

### 6.3 Entitlement engine (critical)

```
effectiveEntitlements(user) =
  planDefaults(planId)
  ⊕ country/promo overrides
  ⊕ admin grants
  ⊕ bundle includes (card SKU ↔ marketplace plan)
```

UI and API both check **effective entitlements**. Locked actions show contextual upgrade CTAs (strategy §20).

### 6.4 Trust & compliance (build-in from Phase 0)

- Official APIs / authorized data only — no scrape-dependent business model  
- Claim / correct / opt-out for seeded profiles  
- Platform inquiry routing; no private email/phone on public card without consent  
- Sponsored placements clearly labeled; never overwrite relevance  
- Verification ≠ paid badge  
- Abuse: impersonation, fake metrics, spam, prohibited categories  
- Managed promotion requires explicit creator authorization (scope, comp, exclusivity)

---

## 7. Phased execution plan (aligned to strategy §14–§18)

### Phase 0 — Foundation

**Proof:** Can we describe influence accurately?

- Specialty taxonomy (primary + sub-specialty) + geography model  
- Profile / card schema + entitlement matrix (admin-configurable)  
- Design tokens + Influrios wordmark (retire Influence Connect assets)  
- Auth roles + verification status model (identity ≠ social ≠ data)  
- Data permissions, claim/correction/opt-out flows  
- Attribution taxonomy (ORGANIC_SIGNUP, PROFILE_CLAIM, ADMIN_EMAIL_INVITE, …)

**Defer:** Payments, campaign management  

---

### Phase 1 — Directory + Influencer Card *(MVP)*

**Proof:** Do creators claim/share? Do users search?

| Build | Notes |
|-------|--------|
| Homepage / Search | “Who influences what?” + specialty/location shortcuts |
| Public Influence Profile | Influence DNA lite; socials; inquiry; collab CTA stubs |
| Vertical Influencer Card | Starter live; Plus layout ready behind entitlements |
| Claim / create flow | **Draft preview → claim → verify → publish** (value before signup) |
| Free search | Specialty + geography + platform (+ basic filters) |
| Creator dashboard (lite) | Completeness score + next-best actions |
| Shortlink + Plus QR | Behind Plus entitlement |
| Seed + admin invite CRM | Seed profiles; creator-specific claim links |

**Defer:** Advanced intelligence, Pro dynamic QR (can ship late Phase 1 if capacity), full collab matching  

**Exit criteria**

- Seeded specialty/location pages + claimable profiles  
- Creator publishes Starter card with shareable URL on day one  
- Search → profile view funnel measurable  

---

### Phase 2 — Collaboration Network ✅ *started (in progress)*

**Proof:** Will creators use complementary matches?

- [x] I offer / I need fields on creator DNA + match signals  
- [x] Collaboration Explorer with filters (niche, location, platform, viewer plan)  
- [x] Explainable Creator→Creator scoring (`src/lib/matching.ts`) + breakdown UI  
- [x] Structured proposal flow (`/collaboration/propose`) with Plus/Pro gate  
- [x] Business requests + creator opportunity demo lists  
- [ ] Joint portfolio / case-study stubs (next)  
- [ ] Persist proposals to Prisma `Opportunity` rows  

**Defer:** Complex contracting  

---

### Phase 3 — Business Pro ✅ *started (demo workspace live)*

**Proof:** Will businesses pay for precision + workflow?

- [x] Business entitlements (`BUSINESS_FREE` / `BUSINESS_PRO` / `AGENCY`) + inquiry/shortlist limits  
- [x] Business workspace UI (`/business`) — shortlists, briefs, inquiries (file-backed demo store)  
- [x] Fit explanations (“Why this creator?”) via `fitCreatorToBrief` / `rankCreatorsForBrief`  
- [x] Pro dynamic QR (`/api/qr/[slug]` → `/q/{token}`) + Plus standard QR on Influencer Cards  
- [x] Discover ♡ → shortlist; profile Shortlist + Inquiry CTAs  
- [ ] Stripe: Creator Pro + Business Pro (+ Agency later)  
- [ ] Persist workspace to Prisma (replace `data/business-workspace.json`)  
- [ ] Lead routing + advanced analytics on Pro cards  

---

### Phase 4 — Managed Matching (manual ops console) ✅ *started (ops demo live)*

**Proof:** Can platform generate commercial outcomes?

- [x] Creator opt-in targeting (`/admin/matching`)  
- [x] Admin outreach / intro console with status pipeline  
- [x] Shortlist delivery → create facilitated intro  
- [x] Track intro → paid relationship (+ expected success fee field)  
- [ ] Persist to Prisma + notify parties by email  
- [ ] Automate matching only after manual pilot works  

**Defer:** Escrow / full marketplace  

---

### Phase 5 — Intelligence ✅ *started (demo live)*

**Proof:** Will B2B pay for audience + relationship signal depth?

- [x] Audience snapshots from seed/claimed demographics (`src/lib/intelligence.ts`)  
- [x] Niche demand trends (rising / stable / cooling)  
- [x] Relationship signals (managed intros + collab fit)  
- [x] Business Intelligence UI (`/business/intelligence`) gated by Business Pro / Agency  
- [x] Admin Intelligence ops view (`/admin/intelligence`)  
- [x] Export API (`/api/intelligence/export` JSON + CSV)  
- [ ] Live social / first-party sync (OAuth) after demand validates  
- [ ] Persist intelligence store to Prisma  

**Defer:** Full analytics warehouse, precise geo, scrape-dependent metrics  

---

### Phase 6 — Monetization (Stripe) ✅ *started (demo checkout live)*

**Proof:** Will creators and businesses pay through platform checkout?

- [x] Billing catalog: Creator Plus/Pro + Business Pro/Agency (`src/lib/billing.ts`)  
- [x] Public checkout hub (`/billing`) with demo upgrade when Stripe keys absent  
- [x] Stripe Checkout Session + webhook scaffold (`/api/billing/webhook`) when `STRIPE_SECRET_KEY` set  
- [x] Success / cancel routes applying plan entitlements to demo stores  
- [x] Admin billing console (`/admin/billing`) — sessions, overrides, env readiness  
- [ ] Live Stripe Price IDs + Customer Portal in production  
- [ ] Persist subscriptions to Prisma `User.planTier`  

**Defer:** Invoicing agency custom contracts, usage-based metering  

---

### Phase 7 — Discover fidelity + Admin RBAC ✅ *started*

**Proof:** Can brands find creators with serious filters, and can ops safely share admin?

- [x] Full-width Discover with sidebar filters (country / state / city + platform, followers, engagement, language, verified, open-to-collab)  
- [x] 4-column influencer grid on wide viewports  
- [x] Admin login (cookie session) — portal no longer open to anyone  
- [x] Super Admin creates roles + admin users with scoped permissions (`/admin/access`)  
- [ ] SSO / Clerk (or Auth.js) for production identity  

---

### Phase 8 — Creator Claim & Activation ✅ *started (demo live)*

**Proof:** Do creators claim, verify, and publish a Starter card without friction?

- [x] Unauthenticated draft generation from one social URL/handle (`/claim`)  
- [x] Draft card preview before signup (`/claim/preview/[draftId]`)  
- [x] Claim ownership with email + display name  
- [x] Channel verification demo (`/claim/verify/[draftId]`)  
- [x] Publish Starter card → live `/c/{slug}`  
- [x] Creator dashboard lite with completeness score + next-best actions (`/dashboard`)  
- [ ] Production auth (Clerk / Auth.js) replacing demo creator cookie  
- [ ] Real social OAuth / DM verification challenges  
- [ ] Persist claims to Prisma `Creator` + `User`  

**Defer:** Escrow / Protected Payments until claim + share loops show signal  

---

### Phase 9 — Protected Payments ✅ *started (demo live)*

**Proof:** Will brands fund collaborations in escrow and release on milestones?

- [x] Escrow deal store + milestone state machine (`src/lib/protected-payments.ts`)  
- [x] Public escrow UI — create, fund, submit, release (`/payments`)  
- [x] Admin payments console — create/fund/release/refund + intro link (`/admin/payments`)  
- [x] Granular admin perms `payments.view` / `payments.manage`  
- [ ] Live Stripe Connect / payout rails  
- [ ] Dispute workflow + mediation queue  
- [ ] Persist deals to Prisma  

**Defer:** Full contracts / legal templates until escrow volume validates  

---

## 8. Creator acquisition & activation (strategy §20)

**Wedge message:** *“Create Your Free Influencer Card. One Card. All Your Influence.”*

### Funnel

`DISCOVER → PREVIEW → CLAIM → VERIFY → ACTIVATE → PUBLISH → SHARE → ENGAGE → UPGRADE`

### Engineering implications

1. **Unauthenticated draft generation** from one handle/URL (permitted public / provider data), clearly labeled draft  
2. Claim creates account + ownership transfer  
3. Separate statuses: identity verified / social verified / data verified  
4. AI suggests specialties/title/bio — creator confirms (never auto-publish inferred claims as verified)  
5. Progressive completion after publish (no long mandatory form)  
6. Invitation types: admin, brand/campaign, creator-to-creator, agency import, event QR — all deep-link to **that creator’s draft**, not generic signup  
7. Report Invited → Previewed → Claim Started → Verified → Published → Shared → Engaged → Paid by source  

### Launch campaigns (copy-ready)

- Free Influencer Card  
- Claim Your Influence  
- Get Discovered by Specialty  
- Collaboration Network  

**Motion:** Seed useful profiles → free Starter card + claim invites + admin outreach → invite creators into real brand/collab opportunities.

---

## 9. Screens to design next (gaps vs mockups)

Existing comps cover marketing, Discover, Profile, Collab, Card marketing, and tier cards. **Still needed before/alongside Phase 1:**

1. Unauthenticated **draft card preview** + claim  
2. Verification / consent steps  
3. Creator dashboard (completeness + next actions)  
4. Progressive “add specialty / social / collab prefs” flows  
5. Contextual upgrade modals (locked QR, shortlink, extra social, analytics)  
6. Admin: taxonomy, entitlements, invitations, trust/abuse  
7. Business workspace (shortlists, briefs) — **Phase 3 demo live** (`/business`)  
8. Empty / loading / error / mobile web for Discover + Profile  
9. Influrios-branded redraws of all legacy “Influence Connect” screens  

---

## 10. Metrics that matter (instrument from Phase 1)

| Stage | Metric |
|-------|--------|
| Supply | Claimed profiles / completeness |
| Distribution | Card shares / (later) QR scans |
| Discovery | Searches → profile views |
| Collaboration | Match views → proposals → accepted |
| Business | Search/brief → inquiry → qualified response |
| Revenue | Free → paid conversion |
| Managed | Intros → paid relationships |
| Retention | Repeat business–creator relationships |

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Cold-start empty directory | Seed + claim invites + admin outreach before big marketing |
| Social API limits | Claimed metrics + OAuth where available; never block MVP on sync |
| Entitlement sprawl hard-coded | Feature-flag matrix + admin UI from Phase 0 |
| Trust / fake profiles | Verification states, freshness labels, abuse queue |
| Overbuilding marketplace | Stick to MVP rule: no escrow/payouts until discovery+card+collab proven |
| Brand drift (Influence Connect assets) | Asset audit; lint/copy check for banned string in CI |
| Generic purple UI | Enforce token set; gold Pro-only; pink sparse; expressive type |

---

## 12. Decisions — status

| Decision | Status |
|----------|--------|
| Hosting | **Locked: AWS Lightsail** (Ubuntu + Nginx + PM2 + managed Postgres). See `docs/deploy/AWS_LIGHTSAIL.md`. |
| Phase 0–1 kickoff | **Started** on branch `cursor/phase-0-1-mvp-lightsail-0127` |
| Short domain | Open: own `ic.me` vs path-only `/c/{slug}` + `/q/{token}` on primary domain |
| Auth | Open: **Clerk** / Auth.js / other |
| Phase 1 Pro dynamic QR | **Shipped in Phase 3** (`/api/qr` + `/q/{token}`) |
| Stripe billing | **Phase 6 started** — demo checkout + Stripe scaffold (`/billing`, `/api/billing/webhook`) |
| AI draft extraction | Open: provider + budget |
| Initial taxonomy | **Drafted** in `src/lib/seed-data.ts` (Beauty, Fashion, Food, Home, Hair, Travel, Fitness, Tech, Lifestyle, Suppliers + sub-specialties) |
| Design fidelity | **Code-first tokens** (v2.2 hex values in `globals.css`); comps remain visual references |

---

## 13. Immediate engineering sequence (after §12)

1. Bootstrap Next.js + Influrios tokens + entitlement schema  
2. Specialty taxonomy seed + Creator / Card / SocialAccount models  
3. Public profile + Starter card routes  
4. Draft → claim → verify → publish funnel  
5. Search (specialty + geo + platform)  
6. Creator dashboard completeness  
7. Plus shortlink + standard QR (entitlement-gated)  
8. Admin invitations + attribution events  
9. Staging demo with seeded creators for stakeholder review  

---

## 14. Design reference index

See `docs/design-references/` — visual hierarchy only. Production renders **Influrios** branding and live data.

| Asset | Use |
|-------|-----|
| Home, Discover, Profile, Collab, Card marketing comps | Layout reference; rebrand required |
| Starter / Plus / Pro card comps | Tier density & hierarchy; apply §4.2 entitlement rules |
| Light / cosmic backgrounds | Optional decorative layers; prefer CSS/SVG |

---

## 15. Bottom line

v2.2 locks the product: **Influrios** discovers influence by specialty, connects complementary creators, and sells portable identity (Card) plus workflow/matching — not directory spam or paid “verification.”

**Build Phase 0–1 next:** taxonomy, entitlements, claimable profiles, Starter card with value-before-signup onboarding, and free specialty search. Collaboration, Business Pro, and managed matching follow only after those loops show signal.

Confirm §12 and we start foundation implementation on this repo.
