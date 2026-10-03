# Influrios Collaboration OS — Recommendations & Implementation Plan

**Date:** 2026-10-03  
**Source spec:** [`COLLABORATION_OS_SPEC_v1.txt`](./COLLABORATION_OS_SPEC_v1.txt) (Dev AI Collaboration v1, Oct 2026)  
**Approved designs:**  
- Public landing — [`../design-references/collaboration/public-landing.png`](../design-references/collaboration/public-landing.png)  
- Creator hub — [`../design-references/collaboration/creator-hub.png`](../design-references/collaboration/creator-hub.png)  
**Sequencing authority:** this document for Collaboration OS work; still subordinate to money invariants in [`../DEVELOPMENT_STATE_AND_NEXT_PLAN.md`](../DEVELOPMENT_STATE_AND_NEXT_PLAN.md) and the marketplace ledger.

---

## 1. Verdict

The Collaboration OS spec is the right product direction: treat Collaboration as a **marketplace + contracting + protected-funds OS**, not a static matching demo. The approved designs (public landing + creator hub) should become the UX source of truth for those surfaces.

Influrios already has durable pieces to **extend**, not replace:

| Keep / extend | Do not rebuild |
|---|---|
| Directory matching (`matching.ts`) + propose → `Collaboration` | A second money engine beside `marketplace-ledger.ts` |
| Marketplace ledger, fee snapshots, disputes, change orders, revisions | Hard-coded Airwallex / Escrow.com domain rules |
| Admin fee rules, milestone templates, jurisdictions | Fabricated public stats (“150K+ Collaborations”) |
| Guest gate infrastructure | Mixing mentorship payouts into collaboration balances |

**Bottom line:** ship UX + marketplace objects first (designs), then deepen contracts/payouts behind the existing ledger. Phase M operator evidence (SMTP/Stripe/social) remains required for launch integrations and is **parallel**, not blocking, for Collab OS P1 UI work.

---

## 2. Recommendations

### 2.1 Product / UX

1. **Treat the attached designs as approved.** Public `/collaboration` must match Figure 1 structure; signed-in creator Collaboration Hub must match Figure 2. Do not invent alternate layouts.
2. **No fabricated metrics.** Hero stats cards and footer “Power of Collaboration” numbers display only when Admin/CMS-backed analytics exist; otherwise omit or show qualitative copy.
3. **Preserve today’s useful concepts** (popular category cards, filters, Why This Match, business requests, creator opportunities, Join Creator/Business) but upgrade them to first-class CMS/DB objects and the approved card chrome (image + icon + title/subtitle + horizontal scroll).
4. **Guest acquisition path:** “Get Collaboration Suggestions” shows a limited preview; full reveal requires signup (reuse guest-usage policy, extend actions beyond Discover).
5. **Mentorship is acquisition-adjacent.** Ship public banner + stub landing early (P1); full Mentor–Mentee hub is P7. Keep mentorship money out of collaboration holding until a paid-mentoring flag exists.

### 2.2 Architecture / finance

6. **One collaboration engine.** Migrate read/write onto canonical services; freeze legacy demo-only paths after P1–P3. Do not maintain parallel engines (§19).
7. **Money invariants stay absolute** (§1.3): Operations ≠ Collaboration Holding; fee earned only on milestone release; ROUTE_READY before fundable; creator funds never through Operations; fee snapshots immutable; provider-agnostic domain.
8. **Airwallex is an adapter candidate, not domain logic.** Validate sandbox program items (§22) before any production adapter. Existing Stripe/Flutterwave/M-Pesa/Wise continue as rails.
9. **Reuse ledger.** Map OS milestone states onto existing funding/milestone lifecycle where possible; add missing states/fields rather than a greenfield ledger.
10. **Feature-flag Collab OS surfaces** (`collab_os_v1` product switch) so landing/hub can ship incrementally without breaking current propose/records flows.

### 2.3 Delivery sequencing

11. **Vertical slices** (§20): each phase leaves a coherent user-visible product.
12. **Do not start Meilisearch / Connect / e-sign** unless product asks — e-sign stays behind existing signing provider; Connect stays off.
13. **Optional Phase 9/10 JSON deletion** remains deferred until ops confirms unused.
14. **Always merge green PRs to `main`.**

---

## 3. Gap summary (current `main`)

| Spec area | Today | Gap |
|---|---|---|
| Public landing | Partial demo page | Redesign to Figure 1; CMS category cards; suggestions CTA; mentor banner; dual CTAs; no fake stats |
| Creator hub | Dashboard + records only | Figure 2 hub: status cards, recommended carousel, payout panel, pipeline, side nav |
| Business hub | `/business` workspace | Collab-native hub: requests, suggestions, spend, contracts |
| Match objects | In-memory scores | Persist match + save/dismiss; match_type; blockers |
| Business requests / creator opportunities | Hardcoded arrays | Prisma marketplace objects + lifecycle |
| Contract wizard | Thin propose form | Full wizard + financial snapshot gates |
| Milestones / finance | Strong ledger core | Domain account purposes; fee-earned-on-release; ROUTE_READY |
| Payout readiness | Missing | Primary/secondary routes; Global Payout Ready |
| Mentorship | Missing | Banner → landing → hub |
| Admin control plane | Fees/marketplace/trust | Category cards, corridors, mentorship eligibility, account purposes |

---

## 4. Implementation phases (Collaboration OS)

### P0 — Plan & design lock *(this PR)*

- Archive spec + approved PNGs under `docs/collaboration/` and `docs/design-references/collaboration/`.
- Publish this plan; link from Development State.
- Add product switch `collab_os_v1` (default **on** for new landing chrome once shipped).

**Exit:** plan merged; designs in-repo; sequencing clear.

### P1 — Public Collaboration Landing (Figure 1) *(starts in this PR)*

**UX (must match approved design):**

1. Hero: headline, search (creators/brands/niches/opportunities), popular tags, collage visuals; stats only if CMS-backed.
2. Popular Collaboration Matches: single-row horizontal scroller, image cards with icon + title + “+ partner” subtitle (admin-manageable via existing homepage collab CMS + taxonomy images).
3. Filter Collaborations sidebar (industry, type, location, budget, audience, platform, verified).
4. Featured Collaboration Match: two parties, score ring, breakdown, Why This Match, Request + Save.
5. Right rail: Business Requests + Creator Collaboration Opportunities.
6. “Need Collaboration Ideas?” → Get Collaboration Suggestions (guest-limited).
7. Become a Mentor banner → `/mentorship` stub.
8. Dual “Are You a Creator?” / “Are You a Business?” acquisition banners.
9. Guest CTAs stay honest (Join / Sign in) — never default to a demo creator.

**Data (minimal):**

- Wire popular cards from CMS `collaborationMatches` + category images.
- Marketplace business requests / opportunities / match records are Prisma-backed (P1b).
- Extend guest gates to suggestion preview / request-match actions.

**Exit:** `/collaboration` matches Figure 1 layout on desktop + mobile; CI green; no fake stats.

### P1b — Marketplace objects ✅

- Prisma: `MarketplaceBusinessRequest`, `MarketplaceCreatorOpportunity`, `MarketplaceMatchRecord`, applications + events.
- Application/invitation state machine + timeline events.
- Admin CRUD at `/admin/marketplace-listings`.
- Public `/collaboration` lists read from DB (seeded from former hardcoded arrays when empty).

**Exit:** public lists read from DB; admin can publish without deploy.

### P2 — Creator Collaboration Hub (Figure 2) ✅

- Route: `/collaboration/hub` (signed-in creators with a claimed draft are redirected from `/collaboration`).
- Profile card, status cards, filters, Recommended Matches carousel, payout panel shell, business requests, creator opportunities, Active Collaboration Pipeline stepper (Match → Contract → Funded → In Progress → Review → Released).
- Side nav shortcuts per design.
- Persist Save Match; map pipeline from real `Collaboration` / funding status.
- Guests keep Figure 1 (`/collaboration?landing=1` to force public landing when signed in).

**Exit:** signed-in creator sees Figure 2; guests still see Figure 1.

### P2b — Business Collaboration Hub

- Role-aware hub: status cards, Create Request / Suggestions, applicants, spend summary (funded/held/released/fee) from ledger.
- Suggestions form → Campaign Intent draft.

**Exit:** business session lands on business hub, not creator chrome.

### P3 — Contract & milestone wizard

- Wizard: parties → scope → commercial → milestones → payment readiness → preview → accept → funding instruction.
- Pre-contract gates: identity, ROUTE_READY, payout route known.
- Entitlement: standard vs custom milestones; custom requires creator accept + 100% validation.
- Immutable `collaboration_financial_plan` snapshot on accept (fee rule version locked).

**Exit:** cannot fund without gates; fee rule change does not alter locked deals.

### P4 — Finance domains & provider adapter

- Logical account purposes: OPERATIONS, COLLABORATION_HOLDING, PLATFORM_FEE_CLEARING, …
- Fee earned only when milestone release condition met; linked creator + fee release legs.
- `PaymentProviderAdapter` interface; move marketplace webhook mapping behind it.
- Airwallex adapter **only after** §22 sandbox validation checklist is signed.

**Exit:** domain tests prove $0 Operations until fee earned; adapter swap does not change domain rules.

### P5 — Payout readiness & corridor engine

- Creator primary/secondary payout methods (friendly labels).
- Global Payout Ready = KYC + ≥1 verified route.
- Country Activation Matrix + Route decision before funding.
- Payout status machine; exact fee/FX quote before confirm.

**Exit:** fundable only when ROUTE_READY; creator UI matches payout panel design.

### P6 — Admin Collaboration control plane

- Nav: category cards, mentorship eligibility, corridors, account purposes, dual-approval thresholds.
- Versioned config + audit for fee/corridor/account mapping.
- Guest thresholds for collab actions.

**Exit:** ops can suspend a corridor / change fee future-deals without code deploy.

### P7 — Mentorship module

- Public mentor landing; Find a Mentor / Become a Mentor hub.
- Eligibility rules (admin); request/accept/decline; availability.
- Paid mentoring behind feature flag; never mix into collab holding unless enabled.

**Exit:** acquisition loop live; free mentorship does not touch collaboration funds.

### P8 — Migration & teardown

- Inventory legacy endpoints; dry-run migration; feature-flag cutover; freeze legacy writes; remove deprecated paths after verification (§19).

---

## 5. Acceptance criteria (from spec §21) — tracking

| # | Criterion | Phase |
|---|---|---|
| 1 | Public landing usable logged-out; category cards, search, requests, opportunities, suggestions CTA, mentor banner | P1 |
| 2 | Creator & business dashboards role-aware, same backend | P2 / P2b |
| 3 | Business can create request and/or ask for suggestions | P1b / P2b |
| 4–6 | Admin milestone templates; entitlements; 100% + creator accept | P3 |
| 7–10 | Fee snapshots; Operations vs Holding; per-milestone dual release | P4 |
| 11–12 | Payout routes; ROUTE_READY before fund | P5 |
| 13–16 | Idempotent webhooks; cancellation math; disputes; corridor suspend | existing ledger + P4–P6 |
| 17 | Airwallex only in adapter | P4 |
| 18 | Auditable financial actions | existing + P4/P6 |

---

## 6. Immediate next coding slice (P2b)

P2 creator hub shipped. Next:

1. Business Collaboration Hub (role-aware requests, suggestions, spend from ledger).
2. Parallel: fill Phase M staging evidence when credentials are available.
3. Then P3 contract & milestone wizard.

Follow-up after business hub: P3 contract wizard.

---

## 7. Out of scope for P1

- Airwallex integration  
- Full payout KYC  
- Mentorship matching engine  
- Replacing marketplace ledger  
- Fabricating analytics numbers to match concept art  
