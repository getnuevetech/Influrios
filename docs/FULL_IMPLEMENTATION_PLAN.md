# Influrios — Full Implementation Plan

**Date:** 2026-10-03  
**Baseline:** `main` after #82 (landing redesign v3/v2 + public Influencer terminology)  
**Authority:** this document for all remaining product work. Subordinate money invariants remain in [`DEVELOPMENT_STATE_AND_NEXT_PLAN.md`](./DEVELOPMENT_STATE_AND_NEXT_PLAN.md) and the marketplace ledger.  
**Collab OS detail:** [`collaboration/COLLABORATION_OS_PLAN.md`](./collaboration/COLLABORATION_OS_PLAN.md) + [`collaboration/COLLABORATION_OS_SPEC_v1.txt`](./collaboration/COLLABORATION_OS_SPEC_v1.txt)  
**Terminology:** [`collaboration/Influrios_Influencer_Terminology_Development_Addendum_v1.pdf`](./collaboration/Influrios_Influencer_Terminology_Development_Addendum_v1.pdf)

---

## 1. Purpose

This plan consolidates every **partially done** surface and every **not-started** Collab OS / platform slice into one sequenced backlog. It replaces ad-hoc “next slice” notes that mixed finished UX with unfinished finance and mentorship work.

**Rule going forward:** do not mark a design, doc, or phase done until acceptance criteria below are met. Partial landings and partial terminology are closed as of #82; residual engineering migration and deeper OS phases remain open.

---

## 2. Baseline — already shipped (do not rebuild)

| Area | Evidence | Notes |
|---|---|---|
| Phases J–O foundation | Postgres directory, claim, CMS, billing, fees, intelligence, hardening | Keep dual JSON only for quarantined Phase 9/10 demos |
| Homepage UX | Category/collab carousels, guest gates | #71 |
| Collab OS P0–P3 | Plan, marketplace listings, influencer hub, business hub, contract wizard | #73–#80 |
| Category images + CTA routing | Distinct assets; login deep-links | #75 |
| Claim Contact CTA removed | Publish signup card | #79 |
| Branded gender-aware media | Default avatars/banners; change UI | #81 |
| Public Influencer terminology | Acquisition, discovery, hubs, pricing, legal labels, CMS defaults | #82 |
| Landing redesigns | `/collaboration` v3, `/business` v2, admin CMS | #82 |
| Self-description labels | Claim select + `/admin/influencer-identity` | #82 |

**Out of scope unless product asks:** Meilisearch, Stripe Connect hard-on, e-sign counsel path, Airwallex domain hard-coding, fabricated public stats, Influence Connect branding, raster cards as live Influencer Card.

---

## 3. Remaining work map

```
PARTIAL RESIDUALS ──► close before / in parallel with P4
        │
        ▼
   P4 Finance domains & provider adapter
        │
        ▼
   P5 Payout readiness & corridor engine
        │
        ▼
   P6 Admin Collab control plane
        │
        ▼
   P7 Mentorship module (full hub)
        │
        ▼
   P8 Legacy teardown & API deprecations
        │
        ▼
   Phase M evidence (parallel anytime credentials exist)
```

---

## 4. Workstream A — Partial residuals (close gaps)

These were started earlier but are not fully complete against designs/docs. Ship as **A1–A5** before treating the surface as finished.

### A1 — Landing pixel & CMS QA

| Item | Current | Required exit |
|---|---|---|
| Collab/business hero collage fidelity | Structure + copy match approved; collage uses live directory faces | Compare to `public-landing-v3.png` / `for-businesses-v2.png`; fix remaining layout gaps (nav labels if design requires Discover Influencers wording, floating note placement, plan card feature parity) |
| Admin CMS smoke | Pages exist | Operator can edit hero/features/plans/identity and see public refresh without deploy |
| Match card CMS | Homepage collaboration matches + remap script | Admin-edited titles never reintroduce Creator-as-role; remap script documented in deploy notes |

### A2 — Hub polish (P2 / P2b residuals)

| Item | Current | Required exit |
|---|---|---|
| Influencer hub payout panel | Shell UI | Wire to real payout readiness once P5 lands; until then show honest empty/not-ready states only |
| Influencer hub messaging/contracts nav | Shortcuts present | Routes either work or hide; no dead ends |
| Business hub applicants | List/basic pipeline | Status transitions + shortlist actions match design; no fake counts |
| Role redirects | Signed-in routing works | Guest `?landing=1` and business-vs-influencer redirects covered by smoke checklist |

### A3 — Contract wizard residuals (P3)

| Item | Current | Required exit |
|---|---|---|
| Pre-contract gates | Identity / ROUTE_READY / payout known | Messages use Influencer terminology; gate failures are actionable |
| Custom milestones | Entitlement + 100% + accept | End-to-end test: propose → accept custom → fund locks `financialPlan` |
| Fee snapshot immutability | On funding | Regression test that fee-rule edit does not change locked deals |

### A4 — Terminology engineering residual

Public UI is migrated. Remaining is **controlled technical migration** (addendum §4), not string cosmetics.

| Item | Required exit |
|---|---|
| Inventory `creator_*` fields, enums, events, notification templates | Written inventory under `docs/collaboration/terminology-inventory.md` |
| New code prefers `influencer_*` names / `INFLUENCER_*` enums | Aliases for old names where clients depend on them |
| Analytics display labels | Dashboards show Influencer even if warehouse columns stay legacy |
| Search synonyms | Keep creator / content creator / influencer related (already in filter); add admin taxonomy note |
| Do **not** rename Prisma `Creator` model or `/creators/` routes in one shot | Explicit deprecation plan in P8 |

### A5 — Claim / profile self-description depth

| Item | Current | Required exit |
|---|---|---|
| Claim preview select | Saves title | Title appears on published Influencer Profile + card |
| Dashboard edit | Profile fields exist | Self-description editable post-claim from same admin-managed list |
| “Content Creator” specialty | Must remain selectable designation | Taxonomy must not collapse it into platform role |

**A-stream exit:** residuals checklist signed in this plan §8; no open “partial landing / partial terminology” items.

---

## 5. Workstream B — Not started Collab OS phases

### B1 — P4 Finance domains & provider adapter

**Why next:** ledger is strong; domain separation and adapter boundary are still incomplete vs spec §7–8 / OS plan P4.

**Build:**

1. Logical account purposes: `OPERATIONS`, `COLLABORATION_HOLDING`, `PLATFORM_FEE_CLEARING`, …  
2. Fee earned **only** on milestone release; linked influencer + fee release legs  
3. `PaymentProviderAdapter` interface; marketplace webhooks call capabilities, not provider endpoints  
4. Prove `$0` Operations until fee earned (unit tests)  
5. Airwallex adapter **only after** spec §22 sandbox checklist is signed  

**Exit:** domain tests green; adapter swap does not change commercial rules; no provider brand in domain code.

### B2 — P5 Payout readiness & corridor engine

**Depends on:** P4 adapter boundary (can start UI shell earlier, but fundability rules need P4).

**Build:**

1. Influencer primary/secondary payout methods (friendly labels: M-Pesa, Local Bank, USD Bank)  
2. Global Payout Ready = KYC + ≥1 verified route  
3. Country Activation Matrix + route decision before funding  
4. Payout status machine; exact fee/FX quote before confirm  
5. Replace hub payout **shell** with real readiness panel  

**Exit:** cannot fund unless `ROUTE_READY`; hub UI matches payout design; Influencer terminology throughout.

### B3 — P6 Admin Collaboration control plane

**Build:**

1. Admin nav: corridors, account purposes, mentorship eligibility, dual-approval thresholds  
2. Versioned config + audit for fee/corridor/account mapping  
3. Guest thresholds for collab actions (extend guests admin)  
4. Suspend corridor / change future-deal fees without code deploy  

**Exit:** ops can operate Collab OS config from admin alone; landing CMS already shipped stays linked from admin home.

### B4 — P7 Mentorship module (full)

**Current partial:** public banner + `/mentorship` stub + Influencer Mentor CTAs.

**Build:**

1. Full Find a Mentor / Become a Mentor hub  
2. Emerging vs Experienced Influencer acquisition language  
3. Eligibility rules (admin); request / accept / decline; availability  
4. Paid mentoring **behind feature flag**; never mix into collaboration holding unless enabled  

**Exit:** acquisition loop live; free mentorship does not touch collab funds.

### B5 — P8 Migration & teardown

**Build:**

1. Inventory legacy endpoints and JSON demo paths  
2. Dry-run migration; feature-flag cutover; freeze legacy writes  
3. Remove deprecated paths after verification (spec §19)  
4. Optional phased `creator_*` → `influencer_*` API deprecation with telemetry  

**Exit:** no dual money engines; no silent Creator-as-role public strings; legacy demos only behind explicit switch.

---

## 6. Workstream C — Platform / launch (parallel)

### C1 — Phase M staging evidence

**Current:** probe script + runbook exist; live credentials incomplete.

**Build (operator + agent assist):**

1. SMTP test send recorded  
2. Stripe sandbox checkout + webhook evidence  
3. Social OAuth consent path evidence  
4. Marketplace webhook fixture against staging  
5. Update `docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md` checkboxes  

**Exit:** Phase M evidence pack attached; MVP gate still structural until live proof accepted.

### C2 — Integration & smoke tests

**Current:** strong unit suite; almost no HTTP/Playwright smoke.

**Build:**

1. Smoke: guest collab landing → business landing → claim preview self-description  
2. Smoke: business hub → contract wizard happy path (demo funding)  
3. Webhook contract tests against Stripe/marketplace fixtures  

**Exit:** CI runs at least one smoke or documented staging checklist step per release train.

### C3 — Agency seats (when switch on)

**Current:** multi-seat CRUD behind `agency_seats`; auth incomplete.

**Build:** seat invite/accept auth when product enables the switch. Do not start until asked or switch turns on in staging.

---

## 7. Recommended execution order

| Order | Slice | Streams | Invasive? | Dependencies |
|---|---|---|---|---|
| 1 | **A1 + A3** Landing QA + contract residual tests | A | Low | None |
| 2 | **A4 inventory + A5** Terminology engineering inventory + self-description on profile | A | Low–medium | None |
| 3 | **A2** Hub polish (honest empty states) | A | Low | P5 later for real payouts |
| 4 | **B1 / P4** Finance domains & adapter | B | High (money path) | Ledger invariants absolute |
| 5 | **B2 / P5** Payout readiness & corridors | B | High | P4 |
| 6 | **B3 / P6** Admin control plane | B | Medium | P4–P5 configs |
| 7 | **B4 / P7** Mentorship hub | B | Medium | Mentorship money flag |
| 8 | **B5 / P8** Teardown + API deprecations | B | High (compat) | After P4–P7 stable |
| ∥ | **C1 Phase M** whenever credentials available | C | Ops | Staging host |
| ∥ | **C2 smoke tests** after A1 | C | Low | Stable landing routes |

**Immediate next coding slice:** **A1 + A3**, then start **P4 (B1)**. Run **C1** in parallel as soon as staging secrets exist.

---

## 8. Acceptance checklist (remaining)

### Residuals (A)

- [ ] Landing pages match approved designs on desktop + mobile (no missing sections vs v3/v2)  
- [ ] Admin landing + identity CMS verified end-to-end  
- [ ] Contract custom-milestone + fee-lock regression tests green  
- [ ] Terminology inventory filed; no public Creator-as-role regressions  
- [ ] Self-description editable on published profile  

### Collab OS (B)

- [ ] P4: Operations vs Holding proven; adapter boundary exists  
- [ ] P5: ROUTE_READY gates funding; hub payout panel real  
- [ ] P6: corridors/account purposes admin-operable  
- [ ] P7: mentorship hub live; funds isolated  
- [ ] P8: legacy paths frozen/removed per inventory  

### Launch (C)

- [ ] Phase M evidence pack complete  
- [ ] Smoke coverage for landings + contract path  

---

## 9. Doc updates required with this plan

| Doc | Change |
|---|---|
| This file | Full remaining backlog (authoritative) |
| `DEVELOPMENT_STATE_AND_NEXT_PLAN.md` | Point §7 at this plan; drop “continue terminology” as open UX debt |
| `collaboration/COLLABORATION_OS_PLAN.md` | Mark P1–P3 done; next = P4; link here for residuals |

---

## 10. Non-goals (repeat)

- Fabricating analytics numbers to match concept art  
- Blind Prisma table renames without compatibility  
- Mixing mentorship payouts into collaboration holding without a paid-mentoring flag  
- Hard-coding Airwallex/Flutterwave/Escrow.com into domain rules  
- Starting Meilisearch / Connect / e-sign without an explicit product ask  

---

## 11. Success metrics to instrument while building

| Loop | Metric |
|---|---|
| Supply | Published claims / week; self-description fill rate |
| Discovery | search → profile view (creator/influencer query parity) |
| Collab | suggestion → request → contract accept → fund |
| Finance | milestone release → fee earned; Operations balance stays $0 until then |
| Payout | ROUTE_READY rate before first fund |
| Mentorship | mentor applications / matches (after P7) |
| Ops | Failed jobs; webhook duplicates skipped; SMTP test OK |
