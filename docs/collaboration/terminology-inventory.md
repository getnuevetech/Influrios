# Influencer terminology — engineering inventory

**Date:** 2026-10-03  
**Source:** Influencer Terminology Development Addendum v1 §4–6  
**Status:** Inventory for controlled migration (W1). Public UI already uses Influencer (#82).

Do **not** blind-rename `Creator` Prisma models or `/creators/` routes in one deploy. Prefer aliases + deprecation telemetry (P8).

---

## 1. Canonical public language (done)

| Surface | Required wording | Status |
|---|---|---|
| Acquisition CTAs | Join as an Influencer / Create / Claim Your Influrios Profile | Done |
| Business discovery | Find Influencers / Suggestions | Done |
| Collaboration | Influencer Opportunities / Collaboration | Done |
| Mentorship (stub) | Influencer Mentor | Done |
| Self-description | Content Creator etc. remain designations, not platform role | Claim select done; dashboard aligned in W1 |

---

## 2. Database / Prisma (`creator_*` still canonical)

| Object | Notes | Migration plan |
|---|---|---|
| `Creator` model | Primary influencer profile table | Keep; document as platform Influencer entity. Optional later `Influencer` view/alias |
| `CreatorSpecialty`, `CreatorManagedOptIn`, `CreatorInvitation` | Related | Keep until P8 deprecation wave |
| `MarketplaceCreatorOpportunity` | Marketplace object | Keep; public copy already Influencer |
| `creatorId` FKs (social, card, short link, analytics, …) | Widespread | Compatibility aliases only when external API needed |
| Enums e.g. `CREATOR_CREATOR`, `DataSource.CREATOR_CLAIMED` | Internal | Prefer `INFLUENCER_*` for **new** enums; map legacy (Terminology §4.3) |

---

## 3. Routes & URLs

| Path | Role | Plan |
|---|---|---|
| `/creators/[slug]` | Canonical public profile URL | Keep; SEO title/keywords use Influencer (W1). Deprecate only with redirects in P8 |
| `/c/[slug]` | Influencer Card | Keep |
| `/q/[token]` | Permanent QR | Keep |
| `/dashboard` | Influencer session | Keep |
| `/claim/*` | Onboarding | Keep |
| No `/api/creators/*` | — | N/A |

---

## 4. Libs / modules (internal names OK)

| Module | Notes |
|---|---|
| `src/lib/claim.ts`, `claim-persist.ts` | Draft → Creator |
| `src/lib/directory.ts`, `seed-data.ts` | Directory + `filterCreators` |
| `src/lib/landing-pages.ts` | `influencer_identity` CMS + `ROLE_SEARCH_SYNONYMS` |
| `src/lib/marketplace-listings.ts`, `collaboration-hub.ts` | Marketplace / hubs |
| `src/lib/billing.ts` | SKUs `creator_starter` / `creator_plus` / `creator_pro` — keep Stripe price ids; display as Influencer plans |
| `src/lib/legal.ts` | Trigger `creator_claim` — internal key; public legal copy audited separately |
| Cookie `influrios_creator_session` | Session cookie name — change only with dual-read window |

---

## 5. Analytics events

| Legacy (still readable) | Canonical for **new** writes (W1) | Meta |
|---|---|---|
| `profile_viewed` | `influencer_profile_viewed` | `{ legacyEventType: "profile_viewed", … }` |
| `search_submitted` | `influencer_search_submitted` | `{ legacyEventType: "search_submitted", … }` |

Mapping helper: `src/lib/terminology-events.ts`. Dashboards should display Influencer labels even if warehouse columns lag.

**Planned (not yet emitted):** `influencer_invited`, `influencer_match_saved`, `influencer_payout_requested`.

---

## 6. CMS / email / legal / notifications

| Area | Action |
|---|---|
| Collaboration / business landing CMS | Public copy migrated; guard against Creator-as-role reintroduction (W2.1) |
| Homepage value-prop | Influencer Card / Collaboration Network pillars |
| Match titles | Display-time `Creator`→`Influencer` on `/collaboration`; prefer normalize-on-save |
| Notification/email templates | Audit remaining (W1 residual / ops checklist) |
| Legal document bodies | Prefer Influencer in public text; keep internal trigger keys stable |

---

## 7. Search & SEO

| Item | Status |
|---|---|
| Role-only queries (`creator`, `content creator`, `influencer`, …) return all profiles | `isRoleOnlySearchQuery` + `filterCreators` (W1) |
| Specialty synonyms (woodwork→woodworking) | Admin taxonomy |
| Discover / profile metadata keywords | Influencer + content creator synonyms (W1) |
| Admin note | Taxonomy + Influencer identity pages link each other |

---

## 8. Self-description vs platform role

| Layer | Source of truth |
|---|---|
| Platform role | Always **Influencer** |
| Self-description (`Creator.title`) | Admin list `/admin/influencer-identity` → claim preview + **dashboard** select |
| Specialty taxonomy | Separate; “Content Creator” may exist as designation/specialty without replacing role |

---

## 9. P8 cutover checklist

1. Dual-write or alias any external API fields.  
2. ~~Deprecation telemetry on `creator_*` request fields.~~ **Done (checkout SKUs → audit).**  
3. Optional route redirects `/creators/` → chosen Influencer URL scheme.  
4. ~~Remove quarantined JSON demos.~~ **Done when `legacy_demo_payments` is off (purge on read).**  
5. Do **not** reset longitudinal analytics — keep mapping table.
6. Signing fate: keep admin shell; accept-only wizard; no provider-success claims until counsel.
