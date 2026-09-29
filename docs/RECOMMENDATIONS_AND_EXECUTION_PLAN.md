# Influrios / Influence Connect — Recommendations & Execution Plan

**Status:** For stakeholder review  
**Repo:** `getnuevetech/Influrios`  
**Source materials reviewed:** 14 design templates (web + mobile), product UI mockups, background assets  
**Date:** 2026-09-29

---

## 1. Executive summary

The attached materials describe a **two-sided creator–brand marketplace** with a strong secondary product: a shareable **Influencer Card** (digital business card + QR + short link). Designs cover marketing/web surfaces and a tiered mobile card experience (Starter → Plus → Pro).

**Verdict:** The vision is clear and commercially coherent. Scope in the templates is large. We should **ship a focused MVP** around Discover + Profiles + Influencer Card, then layer Collaboration Matching and paid tiers—rather than building every screen and AI feature at once.

**Immediate decisions needed from you (see §8):** brand name, stack preference, MVP cut, and whether web-first or mobile-first.

---

## 2. What the materials define

### 2.1 Product surfaces in the designs

| Surface | Role | Complexity |
|--------|------|------------|
| **Home / Landing** | Acquisition; search hero; categories; featured creators; social proof | Medium |
| **Discover Influencers** | Marketplace search + heavy filters + AI “Top Matches” | High |
| **Creator Profile** | Media-kit style page: stats, demographics, content, collab prefs, brands | High |
| **Collaboration Matches** | AI match scoring, brand requests, creator-x-creator opps | Very high |
| **Influencer Card (marketing)** | Product landing for the digital card | Medium |
| **Influencer Card (mobile)** | Shareable card UI in **3 tiers** (Starter / Plus / Pro) | Medium–High |
| **Backgrounds / art** | Light aurora + dark cosmic assets for cards, splash, premium | Asset pipeline |

### 2.2 Core user jobs

1. **Brands:** Find creators by niche/location/platform/followers/engagement → evaluate → contact / invite to collaborate.  
2. **Creators:** Publish a professional presence → share via QR/short link → get discovered → receive collab requests.  
3. **Both:** Use Collaboration Matches for AI-suggested pairings (later phase).

### 2.3 Differentiator vs. Linktree / creator directories

The **Influencer Card** is the clearest unique wedge:

- Multi-platform reach on one card  
- QR + short URL (`ic.me/...`)  
- Tiered feature unlocks (tags, QR, brand inquiry email, media-kit badges)  
- Bridge into full platform profile and collab flows  

Recommend treating the Card as **MVP hero**, with Discover/Profile as the marketplace that makes the card valuable.

---

## 3. Design & UX review

### 3.1 Strengths

- Clear dual CTA pattern: **Join as Creator** / **Join as Business**  
- Consistent visual language: purple–blue gradients, rounded cards, verified badges, social metrics  
- Influencer Card tiers are productized (Starter / Plus / Pro)—good monetization path  
- Discover filters match real brand buying criteria (niche, geo, platform, followers, engagement, rate, verified, open-to-collab)  
- Profile page reads as a **sales media kit**, which brands expect  

### 3.2 Risks & gaps in the current templates

| Issue | Why it matters | Recommendation |
|-------|----------------|----------------|
| **Brand conflict:** repo/README = *Influrios*; designs = *Influence Connect* | Confused identity, domains, legal | Pick one name before build; update all copy |
| **No auth, onboarding, dashboards, messaging, or payment UIs** | Can’t operate the marketplace from marketing screens alone | Design these before/alongside Phase 1 build |
| **AI matching + live social APIs shown as fact** | Instagram/TikTok/YouTube APIs are restricted, costly, and often unavailable for follower sync | Start with **manual / claimed stats** + optional OAuth later; mock AI scores until data exists |
| **Heavy card / dashboard density on every page** | Templates are card-heavy marketing comps; easy to overbuild | Keep marketplace utility pages denser; keep marketing heroes simpler (one composition per first viewport) |
| **Default AI-look palette** (purple gradients everywhere) | Fine for brand continuity if intentional; easy to feel generic | Lock a **design system** (tokens, type, radius) and one expressive typeface—not Inter-by-default |
| **Copyrighted brand logos** (Samsung, Nike, L’Oréal, etc.) in comps | Cannot ship as-is without permission | Use placeholders or licensed/partner logos only |
| **No empty / loading / error / mobile web layouts** | Production will need them | Spec responsive breakpoints and states early |
| **Demographics & engagement charts** | Implies first-party analytics or expensive third-party data | Phase 2+; seed with user-entered or partner data |

### 3.3 Influencer Card tier model (from templates)

| Capability | Starter | Plus | Pro |
|------------|---------|------|-----|
| Photo + name + verification | ✓ | ✓ | ✓ |
| Single niche / limited tags | 1 tag | 3 tags | 5+ tags |
| Social stats | 1 platform row | 4 platforms | 5 platforms + website |
| Short link | Full URL | Short `ic.me/...` + copy | Short link + copy |
| QR code | — | ✓ | ✓ (emphasized) |
| Brand inquiry email | — | — | ✓ |
| Status badges (Media Kit, Collab Ready, Priority) | — | — | ✓ |
| Primary CTA | View Profile | Contact | Work With Me |
| Visual treatment | Light glass | Light + richer chrome | Dark / premium glass + gold accents |

**Recommendation:** Encode tiers as a **feature-flag matrix** in code from day one, even if only Starter ships free.

### 3.4 Background assets

- **Light pastel aurora** → Starter/Plus cards, light marketing sections  
- **Blue cosmic ribbons / dark gold-sparkle** → Pro cards, splash, premium upsell  

Prefer **CSS/SVG gradients** for simple aurora backgrounds where possible; reserve raster art for Pro/splash to control bundle size.

---

## 4. Architecture recommendations

### 4.1 Suggested product shape

```
Web app (Next.js)          Mobile (later / PWA first)
├── Marketing pages        └── Influencer Card share views
├── Discover + Profile         (same card components)
├── Auth + Creator/Brand
│   onboarding
├── Messaging / Requests
└── Billing (Stripe)
         │
         ▼
   API (Node or Nest) + Postgres
         │
   ├─ Profiles, niches, locations
   ├─ Cards + QR + short links
   ├─ Collab requests / matches
   └─ Optional: social OAuth sync jobs
```

### 4.2 Recommended stack (default if no preference)

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Next.js (App Router) + TypeScript** | SEO for Discover/Profile; shared React for card UIs |
| Styling | **Tailwind + CSS variables** (design tokens) | Matches rapid UI from comps; theming for tiers |
| Backend | **Next.js Route Handlers or NestJS** | Start simple; extract Nest if matching/jobs grow |
| DB | **PostgreSQL + Prisma** | Relational fit for filters, tiers, orgs |
| Auth | **Clerk or Auth.js** | Dual roles (creator / business) quickly |
| Files | **S3-compatible (R2/S3)** | Avatars, content thumbnails |
| QR | Server-generated (e.g. `qrcode`) with logo overlay | Matches designs |
| Short links | Dedicated route/`ic.me` subdomain or path redirects | Core card feature |
| Payments | **Stripe** (Plus / Pro subscriptions) | Maps to tier badges |
| Search | Postgres full-text → **Typesense/Meilisearch** when scale needs it | Discover filters are demanding |
| Charts | Lightweight (e.g. Recharts) only when real data exists | Avoid fake-precision charts in MVP |

### 4.3 Domain model (MVP entities)

- `User` (role: `creator` | `business` | `admin`)  
- `CreatorProfile` (bio, location, languages, verified, openToCollab, tier)  
- `SocialAccount` (platform, handle, followers, url) — initially user-claimed  
- `Category` / `Niche` (with counts for filters)  
- `InfluencerCard` (slug, theme, QR payload, visibility)  
- `BusinessProfile`  
- `CollabRequest` / `SavedCreator`  
- `Match` (optional Phase 3; score breakdown fields as in comps)

### 4.4 What *not* to build first

- Live Instagram/TikTok follower sync  
- Full demographic analytics  
- AI match engine with explainability UI  
- Native iOS/Android apps  
- Campaign management / escrow payments  
- NFC writing  

---

## 5. Phased execution plan

### Phase 0 — Align & foundation *(review gate)*

**Outcomes**

- [ ] Confirm product name: **Influrios** vs **Influence Connect** (or Influrios product / Influence Connect brand)  
- [ ] Confirm MVP scope cut (recommend §5 Phase 1 below)  
- [ ] Confirm web-first vs mobile app  
- [ ] Domain + short-link strategy (`influrios.com`, `influenceconnect.com`, `ic.me`)  
- [ ] Legal: trademark search; remove third-party logos from production assets  
- [ ] Design system: colors, type, radius, button/card tokens extracted from comps  
- [ ] Repo bootstrap: Next.js app, CI, lint, env, staging  

**Deliverable:** Signed MVP brief + Figma/component inventory (or this doc approved)

---

### Phase 1 — MVP marketplace + Influencer Card *(primary build)*

**Goal:** A brand can search creators; a creator can publish a profile and share a Starter/Plus card.

| Workstream | Scope |
|------------|--------|
| Design system | Tokens, Logo, Nav, Footer, Buttons, Tags, Badges, Social icons |
| Auth | Sign up / log in; role select Creator vs Business |
| Creator onboarding | Profile basics, niches, location, socials (manual), photo |
| Home | Simplified landing: brand, headline, search CTA, categories teaser, featured row, dual join CTAs |
| Discover | Search + filters (niche, location, platform, follower range, verified, open-to-collab); result grid; sort |
| Profile | Public media-kit page (stats, about, tags, collab prefs); Contact / Share Card CTAs |
| Influencer Card | Public share page + QR + slug URL; Starter + Plus layouts |
| Business light path | Save creators; “Invite to Collaborate” creates a request (email or in-app inbox v1) |
| Admin light | Seed categories; verify creators manually |

**Explicitly out of Phase 1:** Collaboration Matches page, demographics charts, Pro dark card, Stripe, AI scoring.

**Exit criteria**

- 20+ seeded demo creators browsable on Discover  
- Creator can edit profile and open shareable card URL + QR  
- Business can filter and send a collab request  

---

### Phase 2 — Monetization & card depth

| Workstream | Scope |
|------------|--------|
| Billing | Stripe: Plus / Pro subscriptions; webhook → tier on profile |
| Pro card | Dark glassmorphism layout; brand email; status badges; 5 platforms |
| Card marketing page | “Your Influencer Card, Everywhere” funnel |
| Messaging | Threaded inbox for collab requests (replace email-only) |
| Creator dashboard | Edit card, view profile views / link clicks (basic analytics) |
| Business dashboard | Saved lists, request status |

**Exit criteria:** Paid upgrade path works; Pro card matches approved design; basic funnel analytics.

---

### Phase 3 — Collaboration matching

| Workstream | Scope |
|------------|--------|
| Match UI | Recommended Match card with score breakdown (as in comps) |
| Rules engine v1 | Weighted scoring on niche overlap, geo, platform, audience size (deterministic—not LLM-first) |
| Listings | Business requests + creator “looking for” opportunities |
| Filters | Industry, collab type, budget, campaign goal |
| Explainability | “Why this match works” from structured reasons |

Optional later: LLM rewrite of match rationale; true ML ranking once enough outcomes exist.

---

### Phase 4 — Scale & platform depth

- Social OAuth / partner data for verified metrics (where legally available)  
- Audience demographics (partner or first-party pixel)  
- Campaign tools, contracts, payments escrow  
- Native apps or refined PWA for card sharing at events  
- Categories directory page, pricing page, resources/CMS  
- Performance: search index, CDN images, edge caching for cards  

---

## 6. Frontend implementation notes (from templates)

### 6.1 Shared components to build once

- `AppHeader` / `AppFooter`  
- `CreatorCard` (home featured + discover grid variants)  
- `InfluencerCard` (tier-aware: Starter | Plus | Pro)  
- `FilterSidebar` (Discover; later Collab)  
- `StatPill` / `SocialMetric`  
- `CategoryChip`  
- `VerifyBadge`, `TierBadge`  
- `QrBlock`  
- `CtaBanner` (Creator / Business dual CTAs)  
- `MatchScoreRing` (Phase 3)

### 6.2 Responsive strategy

- Discover: sidebar collapses to drawer/bottom sheet on mobile  
- Profile: stack hero → stats → about → content  
- Cards: single-column share view is already mobile-native—reuse for PWA

### 6.3 Motion (keep intentional, not noisy)

- Hero fade/rise on load  
- Card hover lift on desktop grids  
- Soft gradient drift on card backgrounds (CSS only)  
- Avoid continuous sparkle animations that hurt performance/accessibility  

### 6.4 Accessibility & contrast

- Light aurora backgrounds → **dark navy text** only  
- Dark Pro cards → white/light text; ensure WCAG AA on badges and secondary labels  
- Don’t place body copy directly on busy cosmic backgrounds—use glass panels  

---

## 7. Data, compliance, and ops

- **Claimed metrics disclaimer** until verified sync exists  
- **GDPR/CCPA:** data export/delete for profiles; consent for marketing  
- **Age:** creators should be 18+ for commercial collabs  
- **Brand safety:** reporting / block for profiles  
- **Rate limits** on contact forms to reduce spam  
- **QR payload:** prefer HTTPS profile URL, not raw PII  

---

## 8. Decisions we need from you

Please reply with preferences (defaults in **bold** if you want us to proceed without waiting):

1. **Product name:** Influrios / Influence Connect / other?  
2. **MVP cut:** **Phase 1 as written** / narrower (Card-only) / fuller (include matching)?  
3. **Client:** **Web-first (Next.js)** / Flutter / React Native?  
4. **Auth vendor:** **Clerk** / Auth.js / other?  
5. **Short domain:** Do you own or want `ic.me`-style links, or path-based `/c/sofia` on main domain?  
6. **Design fidelity:** Pixel-match comps / **interpret into a tighter design system**?  
7. Any **must-have** integrations already (CRM, Stripe account, social APIs)?

---

## 9. Suggested near-term engineering sequence (after approval)

1. Bootstrap Next.js + design tokens + layout shell  
2. Seed data model + fake creator catalog  
3. Discover + Profile (read-only)  
4. Auth + creator edit flows  
5. Influencer Card Starter/Plus public routes + QR  
6. Business save + collab request  
7. Hardening, analytics, staging demo for stakeholders  

---

## 10. Design reference index

Files copied to `docs/design-references/`:

| File | Likely screen |
|------|----------------|
| `43db205a-...png` | Home / landing |
| `41af99d3-...png` | Creator profile (Sofia Martinez) |
| `7e83886a-...png` | Discover influencers |
| `9201a4e6-...png` | Collaboration matches |
| `23349ba3-...png` | Influencer Card marketing landing |
| `afe96cd0-...png` / `13cacfc6-...png` | Card — Starter |
| `3be1f309-...png` / `8de33766-...png` | Card — Plus |
| `d29dd52f-...png` / `13e75916-...png` | Card — Pro |
| `71c28254-...png` | Light aurora background |
| `5db6a37e-...png` / `8fea709a-...png` | Dark cosmic / premium backgrounds |

---

## 11. Bottom line

Ship **Discover + Profile + Influencer Card (Starter/Plus)** as the first usable product. Treat Collaboration Matching and live social analytics as later phases. Resolve **Influrios vs Influence Connect** naming before any public UI. Encode **subscription tiers** in the data model early so Pro designs are a layout + billing unlock, not a rewrite.

Once you confirm the decisions in §8, we can start Phase 0/1 implementation on this repo.
