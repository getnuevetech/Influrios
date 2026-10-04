# Influrios Collaboration OS — Recommendations & Implementation Plan

**Date:** 2026-10-04  
**Source spec:** [`COLLABORATION_OS_SPEC_v1.txt`](./COLLABORATION_OS_SPEC_v1.txt) (Dev AI Collaboration v1, Oct 2026)  
**Approved designs:**  
- Public landing — [`../design-references/collaboration/public-landing-v3.png`](../design-references/collaboration/public-landing-v3.png)  
- For Businesses — [`../design-references/business/for-businesses-v2.png`](../design-references/business/for-businesses-v2.png)  
- Creator hub — [`../design-references/collaboration/creator-hub.png`](../design-references/collaboration/creator-hub.png)  
- Terminology addendum — [`Influrios_Influencer_Terminology_Development_Addendum_v1.pdf`](./Influrios_Influencer_Terminology_Development_Addendum_v1.pdf)  
**Sequencing authority:** [`../FULL_IMPLEMENTATION_PLAN.md`](../FULL_IMPLEMENTATION_PLAN.md) for DONE vs Deferred-external; this document for Collab OS phase detail. Still subordinate to money invariants in [`../DEVELOPMENT_STATE_AND_NEXT_PLAN.md`](../DEVELOPMENT_STATE_AND_NEXT_PLAN.md) and the marketplace ledger.

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
| Public landing | `/collaboration` + CMS | ✅ Matches approved v3; admin at `/admin/collaboration-landing` |
| Business marketing | `/business` + CMS | ✅ Matches approved v2; admin at `/admin/business-landing` |
| Influencer terminology | Public UI migrated | ✅ Role labels Influencer; self-descriptions admin-managed; legacy `creator_*` technical fields kept |
| Influencer hub | `/collaboration/hub` | ✅ P2 shipped |
| Business hub | `/collaboration/business` | ✅ P2b shipped |
| Match objects | Prisma marketplace match records | ✅ P1b |
| Business requests / influencer opportunities | Prisma marketplace objects | ✅ P1b |
| Contract wizard | `/collaboration/contract` | ✅ P3 |
| Milestones / finance | Strong ledger core + P4 domains | Live provider rails Deferred-external |
| Payout readiness | P5 core: profile + corridors + hub panel + ROUTE_READY corridor gate | Live method verification Deferred-external |
| Mentorship | P7 core: find/become hub, eligibility, request lifecycle, paid flag isolated | Paid session commercial pack Deferred-external |
| Admin control plane | P6 core: corridors suspend, versioned thresholds, ops hub, dual-approval gate, deepened provider health | Guest collab quota DONE; P7 paid mentorship surfaces Deferred-external |

---

## 4. Implementation phases (Collaboration OS)

### P0 — Plan & design lock *(this PR)*

- Archive spec + approved PNGs under `docs/collaboration/` and `docs/design-references/collaboration/`.
- Publish this plan; link from Development State.
- Add product switch `collab_os_v1` (default **on** for new landing chrome once shipped). ✅

**Exit:** plan merged; designs in-repo; sequencing clear.

### P1 — Public Collaboration Landing (Figure 1) ✅

**UX (must match approved design):** redesigned `/collaboration` to public-landing-v3 — hero, popular matches, dual path, featured matches + side cards, marketplace rails, suggestions banner, how-it-works, feature lists, protected payments, collab types, Influencer Mentorship, trust bar, dual final CTAs. Copy CMS at `/admin/collaboration-landing`. Match cards remain under Homepage CMS; listings under marketplace-listings admin.

For Businesses marketing (`/business`) matches for-businesses-v2 with CMS at `/admin/business-landing`.

**Exit:** `/collaboration` and `/business` match approved layouts; landing copy admin-editable; CI green; no fake stats.

### P1b — Marketplace objects ✅

- Prisma: `MarketplaceBusinessRequest`, `MarketplaceCreatorOpportunity`, `MarketplaceMatchRecord`, applications + events.
- Application/invitation state machine + timeline events **wired to hubs** (creator Apply, business Invite, status transitions with **visible event timeline** → contract draft; ownership guards; opportunity Connect/Apply; **admin manual/auto expire** + sweep).
- Admin CRUD at `/admin/marketplace-listings`.
- Public `/collaboration` lists read from DB (seeded from former hardcoded arrays when empty).

**Exit:** public lists read from DB; admin can publish without deploy; apply/invite/transition path live — **met**.

### P2 — Creator Collaboration Hub (Figure 2) ✅

- Route: `/collaboration/hub` (signed-in creators with a claimed draft are redirected from `/collaboration`).
- Profile card, status cards, filters, Recommended Matches carousel, payout panel shell, business requests, creator opportunities, Active Collaboration Pipeline stepper (Match → Contract → Funded → In Progress → Review → Released).
- Side nav shortcuts per design.
- Persist Save Match; map pipeline from real `Collaboration` / funding status.
- Guests keep Figure 1 (`/collaboration?landing=1` to force public landing when signed in).

**Exit:** signed-in creator sees Figure 2; guests still see Figure 1.

### P2b — Business Collaboration Hub ✅

- Route: `/collaboration/business` (signed-in accounts without a creator draft are redirected from `/collaboration`).
- Status cards, Campaign Intent → suggestions form (**upsert + Refresh suggestions**), Post Request, applicants/inquiries, shortlist, pipeline, spend summary (funded/held/released/refunded/fee) from ledger.
- Legacy `/business/workspace` redirects to the hub.

**Exit:** business session lands on business hub, not creator chrome.

### P3 — Contract & milestone wizard ✅

- Route: `/collaboration/contract` (linked from Business Hub).
- Wizard: parties → scope → commercial → milestones → payment readiness → preview → accept → funding instruction.
- Pre-contract gates: identity, ROUTE_READY, payout route known (`evaluatePreContractGates`).
- Entitlement: `customMilestones` on Business Pro/Agency; custom requires influencer accept + 100% validation.
- Immutable financial plan snapshot embedded in `CollaborationFunding.feeSnapshotJson.financialPlan` on funding (fee rule version locked).
- `requestPrefund` accepts optional custom milestone schedules.

**Exit:** cannot fund without gates; fee rule change does not alter locked deals.

### P4 — Finance domains & provider adapter — DONE (core); Airwallex / live rails Deferred-external

- Logical account purposes: OPERATIONS, COLLABORATION_HOLDING, PLATFORM_FEE_CLEARING, …
- Fee earned only when milestone release condition met; linked creator + fee release legs.
- `PaymentProviderAdapter` interface; marketplace webhook mapping behind it.
- Airwallex adapter **only after** §22 sandbox validation checklist is signed (L5 Deferred-external).

**Exit (core):** domain tests prove $0 Operations until fee earned; adapter swap does not change domain rules — **met**.

### P5 — Payout readiness & corridor engine — DONE (core); live verify Deferred-external

- Creator primary/secondary payout methods (friendly labels) + `InfluencerPayoutProfile`.
- Global Payout Ready = identityVerified + corridor + gateway + ≥1 verified route.
- Country Activation Matrix; ROUTE_READY includes corridor before funding.
- Exact fee/FX quote helper before confirm (contract preview + approve).
- Admin corridor ops at `/admin/corridors` (P6).

**Exit (core):** fundable only when ROUTE_READY; creator hub payout panel real — **met**. Live method verification — Deferred-external.

### P6 — Admin Collaboration control plane — DONE (core)

- Nav: Collaboration ops + Corridors; fees/gateways/marketplace/trust linked from ops hub.
- Versioned control plane + audit for dual-approval, mentorship eligibility, guest collab thresholds.
- Corridor suspend/activate without deploy; account-purpose catalog.
- Deepened provider health; guest collab quota; `collab_finance.*` RBAC + step-up.

**Exit (core):** ops can suspend a corridor / change fee future-deals without code deploy — **met**.

### P7 — Mentorship module — DONE (core); paid pack Deferred-external

- Public mentor landing; Find a Mentor / Become a Mentor hub with Emerging/Experienced language.
- Eligibility rules (admin control plane); request/accept/decline; availability.
- Paid mentoring behind `paid_mentoring` feature flag; never mixes into collab holding.

**Exit (core):** acquisition loop live; free mentorship does not touch collaboration funds — **met**. Paid commercial pack — Deferred-external.

### P8 — Migration & teardown — DONE (core); SKU soak Deferred-external

- Inventory: `docs/collaboration/legacy-inventory-p8.md`
- Feature-flag cutover + freeze: `legacy_demo_payments` off purges JSON demos and blocks writes
- Signing: keep `/admin/signing` shell; e-sign non-goal until counsel
- `creator_*` SKU deprecation telemetry on checkout

**Exit (core):** one collaboration money engine when demos are off; demos purged/gated — **met**. SKU/cookie rename soak — Deferred-external.

---

## 5. Acceptance criteria (from spec §21) — tracking

| # | Criterion | Phase | Status |
|---|---|---|---|
| 1 | Public landing usable logged-out; category cards, search, requests, opportunities, suggestions CTA + **guest anonymized sample**, mentor banner | P1 | DONE |
| 2 | Creator & business dashboards role-aware, same backend | P2 / P2b | DONE |
| 3 | Business can create request and/or ask for suggestions | P1b / P2b | DONE |
| 4–6 | Admin milestone templates; entitlements; 100% + creator accept | P3 | DONE |
| 7–10 | Fee snapshots; Operations vs Holding; per-milestone dual release | P4 | DONE (core) |
| 11–12 | Payout routes; ROUTE_READY before fund | P5 | DONE (core) |
| 13–16 | Idempotent webhooks; cancellation math; disputes; corridor suspend | ledger + W3 + P6 | DONE |
| 17 | Airwallex only in adapter | P4 / L5 | Adapter boundary DONE; Airwallex impl Deferred-external |
| 18 | Auditable financial actions | P4 / P6 | DONE |

---

## 6. Immediate next

**Authority:** [`../FULL_IMPLEMENTATION_PLAN.md`](../FULL_IMPLEMENTATION_PLAN.md) §8.

P0–P8 **code cores shipped**. Next work is Deferred-external only:

1. Phase M staging evidence when credentials are available (L1).
2. Landing QA operator sign-off (W2.1).
3. Airwallex checklist signatures before any adapter hard-wire (L5).
4. Live provider rails / paid mentorship pack / Phase 4 INFLR.me — only when product asks.

---

## 7. Out of scope for P1

- Airwallex integration  
- Full payout KYC  
- Mentorship matching engine  
- Replacing marketplace ledger  
- Fabricating analytics numbers to match concept art  
