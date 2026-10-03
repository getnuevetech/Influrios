# Influrios — Detailed Full Implementation Plan

**Date:** 2026-10-03  
**Version:** 2.0 (detailed — supersedes thin v1 from #83)  
**Baseline:** `main` after #82 / #83 / #84 (landing redesign, public terminology, detailed plan)  
**Code audit:** 2026-10-03 against Prisma, `src/lib/*`, admin routes, Collab OS plan  

**Money / ledger invariants remain absolute** (Development Spec addendum PA001–PA007; Collab OS §1.3). This plan sequences *remaining* work; it does not reopen completed engines.

**Progress:** W1 inventory + dashboard self-description + `influencer_*` analytics mapping shipped (`docs/collaboration/terminology-inventory.md`).

---

## 0. How to use this plan

1. Every work item is tagged **DONE**, **PARTIAL**, or **NOT STARTED**.  
2. **PARTIAL** items list *what exists* (with file evidence) and *what is still missing* with a concrete **Exit**.  
3. Do not mark a phase complete until its Exit checklist is true.  
4. Source authority stack (highest wins where more specific):

| Priority | Document | Governs |
|---|---|---|
| 1 | Influencer Terminology Addendum v1 | Public role language |
| 2 | Collaboration Dev Spec v1 + Product/Dev Addenda v1.1 | Paid collab, fees, protected payments, milestones |
| 3 | Platform Development Spec v2.2 | Platform architecture, admin, entitlements, MVP §33 |
| 4 | INFLR.me Dev Spec v1 | Short-link / QR subsystem |
| 5 | Product Strategy v2.2 | Product engines, monetization intent, MVP sequencing philosophy |
| 6 | Approved designs | `/collaboration` v3, `/business` v2, creator hub, card assets |

Archived copies: `docs/source-specs/`. Living Collab phase detail: `docs/collaboration/COLLABORATION_OS_PLAN.md`. Money/maturity inventory: `docs/DEVELOPMENT_STATE_AND_NEXT_PLAN.md`.

### Status legend

| Tag | Meaning |
|---|---|
| **DONE** | Shipped on `main`; do not rebuild; only deepen if a residual is listed under PARTIAL |
| **PARTIAL** | Meaningful code exists; Exit not met; residual work listed |
| **NOT STARTED** | No product implementation (docs/stubs only) |

---

## 1. Why the previous plan was insufficient (document gap findings)

Comparing thin plan v1 to every attached product/design document found these **missing or under-specified** themes. This v2 plan addresses each.

| Gap in previous plan | Source requirement | Plan section |
|---|---|---|
| Fee types must stay distinct (platform vs collab vs managed vs FX…) | Product Addendum §5 | W3.1 |
| Service levels on every collaboration (discovery → managed campaign) | Product Addendum §3 | W3.2 |
| Jurisdiction capability flags (`protected_payment_enabled`, `escrow_term_allowed`, …) | Dev Addendum §6; Collab OS §10 | W3.3 *(code largely DONE; deepen)* |
| Funding modes: full / staged / none (+ recurring deferred) | Product Addendum §7; Collab OS §7 | W3.4 |
| Review, revisions, auto-approval, kill fees, chargebacks | Product Addendum §9–12; Dev Addendum §8–14 | W3.5–W3.6 |
| Relationship attribution / repeat deals | Product Addendum §14; Dev Addendum §15 | W3.7 |
| Content rights separate from payment release | Product Addendum §13 | W3.10 |
| Funding/milestone notifications | Dev Addendum §18 | W3.11 |
| Legal pack updates referencing live fee snapshots | Product Addendum §17 | W3.12 |
| Product UX: funding badges, fee preview, revision counter, admin transaction view | Product Addendum §16 | W2 / W3 |
| INFLR.me phases 1–4, Pro dynamic destinations, OG, domain admin | INFLR.me Spec | W5 |
| Influencer Card tier matrix (Starter link / Plus QR / Pro dynamic) | Strategy §8; Platform Spec §38–39 | W5 |
| Homepage value-prop strip + verified stats rules (VP001–VP008) | Dev Addendum §23 | W6 |
| Managed matching vs contracted collab distinction (R073) | Platform Spec R073; Strategy §9 | W4 |
| Mentorship money isolation | Collab OS §2.4 / P7 | W2.4 / P7 |
| Terminology *engineering* inventory (enums, events, APIs) | Terminology §4–6 | W1 |
| Phase M live evidence (SMTP/Stripe/social) | Platform Spec §33; Development State | L1 |
| Dev Addendum API surface & background jobs | Dev Addendum §16–17 | W3 / P4–P6 |
| Explicit non-goals (Meilisearch, Connect, e-sign, scraping…) | Platform Spec §31; Strategy | §11 |

### Cross-map: Dev Addendum phases ↔ Collab OS phases

| Dev Addendum finance phase | Meaning | Collab OS / this plan |
|---|---|---|
| Dev P0 core model | Entities, rules, snapshots, milestones, jurisdiction flags | Mostly DONE (ledger + fees + flags); deepen W3 |
| Dev P1 launch provider | One provider, full prefunding, release, partial refund | PARTIAL ledger + Stripe path; **P4** adapter + domains |
| Dev P2 operations | Disputes, cancellation, reports, change orders, notifications | PARTIAL ledger; deepen W3.6 / W3.11; **P6** admin |
| Dev P3 expansion | Staged/recurring, more countries, advanced attribution | W3.4 / W3.7 after P4 stable |
| Dev P4 advanced | Revenue sharing, complex splits, enterprise rules | Explicitly deferred (§11) |
| — | UX hubs / marketplace / mentorship | Collab **P0–P3 DONE**; **P5–P8** remaining |

---

## 2. Current maturity snapshot (four engines)

| Engine (Strategy v2.2) | Status | What exists | What remains |
|---|---|---|---|
| Influence Discovery | **PARTIAL → largely DONE** | Directory, taxonomy, filters, guest gates, claim wedge | SEO synonyms depth (W1); no Meilisearch |
| Influencer Collaboration Network | **PARTIAL** | Matching, propose, hubs, contract wizard, marketplace objects, ledger core | Finance domains P4, payouts P5, commercial depth W3, mentorship P7 |
| Influencer Card + INFLR.me | **PARTIAL** | Tier-aware card, shortlinks, opaque QR, admin short-links | Pro self-serve dynamic destination, full INFLR.me DoD, Phase 4 campaign/NFC |
| Business Matching + Managed Promotion | **PARTIAL** | Briefs, shortlists, admin matching, business hub | R073 UX clarity; managed fee paths end-to-end; verified commercial reporting |

---

## 3. DONE — do not rebuild

| ID | Item | Evidence | Source satisfied |
|---|---|---|---|
| D1 | Postgres directory / taxonomy / CMS sections | `directory.ts`, `CmsSection` | Platform Spec §5, §11 |
| D2 | Claim → verify → publish onboarding wedge | `/claim/*`, Phase K | Strategy §20; Platform Spec §8 |
| D3 | Guest usage gates | `/admin/guests`, `guest-usage.ts` | Platform Spec §3 |
| D4 | Plan entitlements DB | `/admin/plans`, `entitlements-db.ts` | Platform Spec §4 |
| D5 | Marketplace ledger 12.3–12.13 core | `marketplace-ledger.ts` + unit tests | Dev Addendum ledger/disputes/change-order base |
| D6 | Fee rules on Postgres + admin | `collaboration-fees.ts`, `/admin/fees` | Product Addendum §4 (base) |
| D7 | Collab OS P0 plan + designs archived | `docs/collaboration/*`, `docs/design-references/*` | Collab OS P0 |
| D8 | Marketplace listings P1b | Prisma listings + `/admin/marketplace-listings` | Collab OS §4 |
| D9 | Public collab landing redesign v3 | `/collaboration`, CMS `/admin/collaboration-landing` | Collab OS §2.1 + design v3 |
| D10 | Business marketing redesign v2 | `/business`, CMS `/admin/business-landing` | Design for-businesses-v2 |
| D11 | Influencer hub P2 | `/collaboration/hub` | Collab OS §2.2 (shell) |
| D12 | Business hub P2b | `/collaboration/business` | Collab OS §2.3 (shell) |
| D13 | Contract & milestone wizard P3 | `/collaboration/contract`, `contract-wizard.ts` | Collab OS §5 (wizard path) |
| D14 | Public Influencer terminology | #82 surfaces | Terminology §3 acceptance (public) |
| D15 | Self-description options admin | `/admin/influencer-identity`, claim select | Terminology §2.1 |
| D16 | Branded gender-aware defaults | profile-media + assets | Product UX |
| D17 | Homepage value-prop strip CMS | `homepage-value-proposition-strip.tsx`, `/admin/value-prop` | Dev Addendum VP001–VP004 (base) |
| D18 | Category images + CTA deep-links | #75 | Platform CMS |
| D19 | Hide Contact CTA on claim publish | #79 | Acquisition UX |
| D20 | Phase M probe/runbook scaffolding | `scripts/staging-evidence-probe.ts`, `docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md` | Ops scaffold (not live evidence) |
| D21 | Docker build memory hardening | #69–#70 | Deploy |
| D22 | Jurisdiction payment capability flags | `CollaborationJurisdiction.protectedPaymentsEnabled`, `escrowTermAllowed`; admin marketplace toggles; `fundingTerm` in `ledger.ts` | Dev Addendum §6; PA004/PA007 (base) |
| D23 | Legal acceptance versioning | `LegalAcceptance.documentVersion` / `documentHash`; `legal.ts` | Dev Addendum §24 hooks (base) |
| D24 | Agency seat CRUD behind switch | `AgencySeat`, `agency_seats` product switch | Platform Spec agency (CRUD only) |
| D25 | Protected-payments / trust JSON quarantine | `legacy_demo_payments` off by default; ledger is product path | Development State Phase L / R4 |
| D26 | Phase L ops migrations | CMS, billing, intelligence, fee rules, admin auth → Postgres | Development State Phase L |

---

## 4. PARTIAL — residual backlog (Workstreams W1–W6)

### W1 — Terminology engineering & consistency — PARTIAL → largely done this PR

**Source:** Terminology Addendum §4–6  
**Public UI:** DONE (#82). **Engineering inventory + dashboard self-description + event mapping:** DONE (W1 PR). **P8 API rename:** still later.

| Exists | Missing | Exit |
|---|---|---|
| Public UI uses Influencer | ~~Written inventory~~ → `docs/collaboration/terminology-inventory.md` | Done |
| Self-description on claim + **dashboard select** from admin list | Optional card/profile edit surfaces beyond dashboard | Designation ≠ platform role on claim + dashboard |
| Role search synonyms + Discover/profile SEO keywords | — | Searching creator/content creator/influencer returns same class |
| Legacy badge key `Top Creator` mapped | — | — |
| New events `influencer_profile_viewed` / `influencer_search_submitted` with `legacyEventType` | Additional planned events (`influencer_invited`, …) when those flows instrument | Mapping helper in `terminology-events.ts` |
| Routes `/creators/` kept | Deprecation plan only (no big-bang rename) | Tracked under P8 |
| Billing SKUs / legal triggers still `creator_*` | Compatibility aliases + deprecation telemetry before removal | Terminology §4.2 / P8 |

---

### W2 — Collaboration UX residuals — PARTIAL

**Source:** Collab OS §2; Product Addendum §16; approved designs

### W2.1 Landing pixel / CMS QA — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Section structure matches v3/v2; checklist doc | Operator sign-off against PNGs | `docs/collaboration/LANDING_QA_CHECKLIST.md` signed |
| Admin landing editors | Operator E2E still to run in staging | Documented smoke |
| Match titles remapped + **normalize-on-save** | — | `normalizeInfluencerRoleTitle` on homepage CMS save; Content Creator preserved |

#### W2.2 Influencer hub residuals — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Status cards, matches, pipeline shell, payout shell | Honest empty states (no fake earnings); payout panel is shell → `/payments` only | Empty/not-ready copy only until P5 wires real readiness |
| Side nav shortcuts | Dead-end routes hidden or implemented — **Messages** has no `/messages` route; Analytics shortcut is `/dashboard` not collab analytics | Zero 404 / misleading nav items |
| Influencer Opportunities wording | Align any leftover Creator hub strings | Terminology clean |

#### W2.3 Business hub residuals — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Requests, suggestions, spend summary, contract link | Applicant status transitions: `replied` / `declined` exist in `business.ts` but **unused in hub UI**; shortlist-from-applicant | Business can reply/decline/shortlist without admin-only workarounds |
| Pipeline chrome | Map every step to real funding/milestone states | No cosmetic-only steps |
| Campaign Intent + suggestions | Intent refresh as new influencers appear; multi-creator team proposals (Collab OS §3.3) | Suggestion → invite / draft / team proposal paths documented and shipped or deferred with owner |

#### W2.4 Mentorship stub — PARTIAL (full module = P7)
| Exists | Missing | Exit |
|---|---|---|
| Banner + `/mentorship` stub + Influencer Mentor CTAs | Full Find/Become hub, eligibility, request flow, Prisma models | Moved to **P7** |

#### W2.5 Product UX funding surfaces — PARTIAL
**Source:** Product Addendum §16  

| Exists | Missing | Exit |
|---|---|---|
| Prefund / payments UI, fee snapshot on funding | Funding badges: Fully Funded / Partially Funded / Awaiting Funding / Protected Payment Unavailable | Badges driven by reconciled ledger + jurisdiction |
| Milestone timeline pieces | Amount, due date, submission status, review deadline, payout status in one timeline | Product §16 timeline complete |
| Fee preview before accept | Immutable fee summary after accept (hub + contract) | Visible both sides |
| — | Revision counter + change-order action in hub UI | UX matches §16 |
| Admin ledger/trust views | Unified admin transaction view: collab, milestones, provider, fee rule, funds status, audit | Dev Addendum §19 Collaboration Operations |

---

### W3 — Collaboration finance & commercial depth — PARTIAL (next major)

**Source:** Product Addendum v1.1; Development Addendum v1.1; Collab OS §5–14  

Much ledger work exists; the following are still incomplete vs addenda.

#### W3.1 Fee matrix completeness — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Versioned `CollaborationFeeRule`, simulator, snapshots on funding (`collaboration-fees.ts`, `/admin/fees`) | Distinct fee **types** enforced in product/reporting (Platform Service / Collaboration / Managed Intro / Managed Campaign / Success / Processing / FX / Cancellation-Dispute / Referral) | Snapshots store fee type; reports separate columns |
| Conditions include `serviceLevel` | Full condition set: relationship_source, promotion, staged funding_mode, payer allocation UX | Rule tester explains winner (Dev Addendum §5) |
| Priority/specificity base tests | Overlap acceptance tests from Dev Addendum §22.1 | Test suite asserts documented winner |
| Fee methods (partial) | Full method set: PERCENTAGE, FLAT, PERCENT_PLUS_FLAT, TIERED, MIN/MAX, WAIVED, CUSTOM_ENTERPRISE + commission basis enum | Matches Dev §4 |

#### W3.2 Service levels — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| `serviceLevel` field on rules + funding path | First-class UX in wizard + admin; affects fee + legal + availability | Every contracted deal records service level from Product Addendum §3 enum: discovery_only / platform_match / contracted / managed_intro / managed_campaign |
| Contract path often hard-codes `"contracted"` | Wizard choice + jurisdiction availability gate | No silent default when managed modes disabled |

#### W3.3 Jurisdiction / terminology gates — DONE (base) / PARTIAL (depth)
| Exists | Missing | Exit |
|---|---|---|
| `protectedPaymentsEnabled`, `escrowTermAllowed`; UI `fundingTerm`; contract gates | Full capability set: full/staged/recurring funding flags, managed_introduction/negotiation, approved_provider_ids, legal_review_status | Capability flags override features (PA007) end-to-end |
| — | Managed modes refuse API even if fee rule exists until jurisdiction enables | Dev Addendum §24 managed-service gate |

#### W3.4 Funding modes — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Prefund / ledger funding; schedule kinds `once` \| `staged` \| `recurring` (`schedule.ts`); `stagedFundingEnabled` setting | Explicit product modes FULL vs STAGED vs NONE with clear “outside protected coverage” marking for NONE | Staged: later phases cannot start unfunded; NONE never shows Fully Funded badge |
| — | Recurring/ambassador funding | Deferred until Dev P3 (after base ledger stable) — do not block P4 |

#### W3.5 Milestone lifecycle depth — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Templates, custom milestones entitlement, submit/approve paths, `shouldAutoApprove` / `sweepAutoApprovals` on ledger reads | Configurable review windows by jurisdiction/type/service level from **accepted snapshot**; dedicated idempotent auto-approval **job** kind | Dev Addendum §8 + §22.5–6 |
| Revision tracking | Revision limits → change order or dispute only | §22.6 |
| — | Full milestone state machine labels aligned to Dev §8 / Collab §6.4 (RELEASE_AUTHORIZED → PROVIDER_RELEASE_REQUESTED → RELEASE_CONFIRMED) | State names + transitions audited |

#### W3.6 Disputes / cancellations / refunds / chargebacks — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Dispute + partial refund + change-order modules/tests (`milestone-disputes.ts`, `disputes.ts`) | Kill-fee templates; jurisdiction-aware cancellation matrix; chargeback / payment-risk workflow | Product Addendum §11–12 acceptance |
| Milestone-specific disputes (base) | Reason codes + evidence + outcomes fully matching Dev §13 | §22.7–8 |

#### W3.7 Attribution / repeat deals — PARTIAL
| Exists | Missing | Exit |
|---|---|---|
| Attribution lib/tests (`deal-attribution.ts`) wired into ledger/payments | Admin contest workflow; fee resolution uses attribution status; configurable `attribution_expiry` (never forever) | Dev Addendum §15 |

#### W3.8 Financial domains & provider adapter — NOT STARTED (→ P4)
| Exists | Missing | Exit |
|---|---|---|
| Strong ledger | Logical OPERATIONS vs COLLABORATION_HOLDING vs FEE_CLEARING; `PaymentProviderAdapter`; $0 Operations until fee earned | Collab OS P4 / Dev Addendum §1, §10–11 |

#### W3.9 Payout readiness & corridors — PARTIAL thin / NOT STARTED product (→ P5)
| Exists | Missing | Exit |
|---|---|---|
| Hub payout shell; thin `paymentRoutes()` / `ROUTE_READY` gates in contract wizard | Primary/secondary methods; Global Payout Ready = KYC + ≥1 verified route; Country Activation Matrix; exact fee/FX quote before confirm | Collab OS §9–10 |

#### W3.10 Content rights vs payment — NOT STARTED
**Source:** Product Addendum §13  

| Exists | Missing | Exit |
|---|---|---|
| Usage/rights fields in wizard scope (partial) | Explicit rule: usage rights activate when corresponding payment released unless parties agree otherwise | Rights state separate from milestone acceptance in UI + snapshot |

#### W3.11 Notifications — NOT STARTED
**Source:** Dev Addendum §18  

| Exists | Missing | Exit |
|---|---|---|
| Jobs mail for invitations/verification | Notify on funding, milestones, review deadlines, revisions, approvals, payouts, disputes, cancellations/refunds, provider/jurisdiction limitations | Event kinds + templates use Influencer terminology |

#### W3.12 Legal pack commercial sync — PARTIAL
**Source:** Product Addendum §17  

| Exists | Missing | Exit |
|---|---|---|
| `LegalAcceptance` versioning | Collaboration Marketplace Terms, Creator-Brand / Creator-Creator / Managed Promotion agreements updated to reference live fee snapshot (not hard-coded %) | Legal pack checklist signed |
| Fee disclosure timestamp path | Explicit fee-disclosure acceptance on contract accept | Dev §24 |

---

### W4 — Business matching & managed services — PARTIAL

**Source:** Strategy §9; Platform Spec §13 R073; Product Addendum managed fees  

| Exists | Missing | Exit |
|---|---|---|
| Business briefs, shortlists, `/admin/matching` intros | Clear product separation: intro ≠ contracted protected payment (R073) | Copy + flows enforce distinction |
| Managed matching queue | Managed introduction/campaign fee paths via fee matrix + jurisdiction enablement | Service levels `managed_intro` / `managed_campaign` live end-to-end |
| Intelligence surfaces | Verified commercial reporting (no fake stats) | Stats only with source/as-of (Dev Addendum §23.8) |

---

### W5 — Influencer Card & INFLR.me — PARTIAL

**Source:** Strategy §8, §19; Platform Spec §38–39; INFLR.me Spec  

#### Card tier matrix (Strategy / Platform)

| Capability | Starter | Plus | Pro | Code status |
|---|---|---|---|---|
| Canonical Influrios profile | Yes | Yes | Yes | DONE |
| INFLR.me short link | No (default) | Yes | Yes | PARTIAL (entitlement-driven) |
| Custom slug | No | Yes | Yes | PARTIAL |
| Standard QR (opaque token) | No | Yes | Yes | PARTIAL / largely DONE |
| Dynamic destination without QR regen | No | No | Yes | PARTIAL (admin `setShortLinkDestination`; not full Pro self-serve UX) |
| Analytics depth | Basic profile | Standard | Advanced | PARTIAL |

#### INFLR.me residuals

| Exists | Missing | Exit |
|---|---|---|
| `ShortLink*` models, resolver, opaque QR, `/admin/short-links`, domain records | Phase 1–2 DoD fully evidenced (domain verification admin UX, alias policy, branded failure pages) | Spec §20 criteria 11–24 |
| Pro `dynamic` flag + destination setter | Pro **self-serve** dynamic destination + destination history + rollback | Spec §9 + Phase 3 |
| Basic analytics events | Privacy-safe async analytics + CTA/conversion events; entitlement-gated creator analytics | Spec §10 |
| — | Campaign links `/c/`, NFC, scheduled destinations (Phase 4) | Explicitly later; do not block P4 finance |
| Card design system | Align remaining chrome to Platform Spec §39 assets; live data not raster | Card matches approved vertical standard |
| OG / social sharing | Influrios-branded preview; canonical SEO on influrios.com | Spec §11 |

---

### W6 — Platform CMS / homepage / admin completeness — PARTIAL

**Source:** Platform Spec §5, §17; Dev Addendum §23 VP001–VP008  

| Exists | Missing | Exit |
|---|---|---|
| Banners, categories, value-prop strip, landing CMS | Verified `SocialProofStats` with source/as-of + disable-when-stale; never show placeholder 50K+/12K+ as factual | §23.8–23.9 |
| Value-prop four pillars | Responsive matrix ≥1200 / 768–1199 / &lt;768; pillar analytics events; jurisdiction-aware Protected Payments claim | §23.9 acceptance tests |
| Admin modules wide | Collab control plane corridors/account purposes (P6) | Collab OS §11 |
| RBAC | Permission groups for new collab finance modules; step-up for high-risk actions | Platform Spec §34; Dev §20 |

---

## 5. NOT STARTED — Collab OS P4–P8 (Workstream P)

### P4 — Finance domains & provider adapter — NOT STARTED

**Sources:** Collab OS §7–8; Dev Addendum §1, §10–11; PA003  

**Build**
1. Account purposes: OPERATIONS, COLLABORATION_HOLDING, PLATFORM_FEE_CLEARING, …  
2. Fee earned only on milestone release; dual release legs (creator + platform fee)  
3. `PaymentProviderAdapter` interface: `createFundingIntent`, `getFundingStatus`, `cancelFunding`, `createReleaseOrTransfer`, `createPartialRefund`, `createFullRefund`, `getPayoutStatus`, `verifyWebhook`, `parseWebhook`, `reconcileTransaction`, `getCapabilities`  
4. Domain tests: Operations $0 until fee earned; webhook idempotency  
5. Airwallex only after Collab OS §22 / §8.3 checklist signed — never hard-code Airwallex into domain rules  

**Exit:** P4 acceptance from Collab OS criteria 7–10 + adapter swap does not change domain rules.

**Depends on:** W3.1–W3.2 fee-type/service-level tests preferred first (low risk); can start P4 in parallel once those tests are green.

---

### P5 — Payout readiness & corridor engine — NOT STARTED (thin gates exist)

**Sources:** Collab OS §9–10  

**Build**
1. Influencer payout profile (primary/secondary friendly methods)  
2. Global Payout Ready = KYC + ≥1 verified route  
3. Country Activation Matrix + route decision  
4. Replace hub payout shell with real panel  
5. Exact fee/FX quote before confirm  

**Exit:** Fundable only when ROUTE_READY; hub UI real.

**Depends on:** P4 domains stable.

---

### P6 — Admin Collaboration control plane — NOT STARTED

**Sources:** Collab OS §11; Dev Addendum §19  

**Build**
1. Corridors, account purposes, mentorship eligibility, dual-approval thresholds  
2. Versioned config + audit  
3. Guest thresholds for collab actions  
4. Suspend corridor / change future fees without deploy  
5. Admin surfaces: Commission/Fee Rules (exists), Jurisdiction Matrix (partial), Provider Health, Collaboration Operations, Financial Reports, Risk Controls  

**Exit:** Ops operates Collab OS from admin alone.

**Depends on:** P4–P5 concepts exist to configure.

---

### P7 — Mentorship module (full) — NOT STARTED

**Sources:** Collab OS §2.4; Terminology §3.4  

**Build**
1. Find an Influencer Mentor / Become an Influrios Influencer Mentor hubs  
2. Emerging vs Experienced Influencer language  
3. Eligibility (admin-configurable), request/accept/decline, availability  
4. Paid mentoring behind flag; never mix into collab holding unless enabled  

**Exit:** Acquisition loop live; funds isolated.

---

### P8 — Migration & teardown — NOT STARTED

**Sources:** Collab OS §19; Terminology §4.2; Platform Spec §31  

**Build**
1. Inventory legacy endpoints + JSON demos (`protected-payments`, `trust`)  
2. Feature-flag cutover; freeze legacy writes  
3. Remove deprecated paths after verification  
4. Optional `creator_*` → `influencer_*` API deprecation with telemetry  
5. Delete quarantined JSON demos (`data/protected-payments.json`, `data/trust.json`) after freeze verification  
6. Decide fate of `/admin/signing` shell vs accept-only wizard (e-sign remains non-goal until counsel; do not claim provider success)

**Exit:** One collaboration money engine; no silent Creator-as-role public strings; optional demos gone or permanently gated.

---

## 6. Parallel launch / quality (Workstream L)

### L1 — Phase M staging evidence — PARTIAL (scaffold DONE)
| Exists | Missing | Exit |
|---|---|---|
| Probe + runbook | SMTP, Stripe sandbox, social OAuth, marketplace webhook evidence packs signed by operator | Platform Spec §33 items 8–10 demonstrated live |

### L2 — Smoke / integration tests — PARTIAL / thin
| Exists | Missing | Exit |
|---|---|---|
| Broad unit suite (`tsx --test`) | Playwright/HTTP smoke: landings, claim self-description, hub→contract, fee snapshot lock, custom-milestone E2E | CI or staging checklist per release |

### L3 — Agency seats — DONE (CRUD) / PARTIAL (auth)
| Exists | Missing | Exit |
|---|---|---|
| Seat CRUD behind `agency_seats` switch (default **off**) | Invite/accept flow + multi-seat session auth when switch on | Design + ship only when product enables |

### L4 — Collab OS feature flag — NOT STARTED
| Exists | Missing | Exit |
|---|---|---|
| Collab surfaces always on | `collab_os_v1` (or equivalent) in `product-switches.ts` as planned in Collab OS P0 | Ops can disable collab OS surfaces without deploy |

### L5 — Airwallex validation checklist artifact — NOT STARTED
| Exists | Missing | Exit |
|---|---|---|
| Collab OS §8.3 / §22 items listed in specs | Checklist doc under `docs/collaboration/` (or deploy) with sandbox sign-off columns | Signed before any Airwallex adapter hard-wires |

---

## 7. Per-document residual checklist (what each source still requires)

### 7.1 Product Addendum v1.1 — Recommended MVP (§18)

| # | MVP item | Status |
|---|---|---|
| 1 | Fee engine + admin matrix + immutable snapshots | PARTIAL (types/conditions/explain-winner missing) |
| 2 | One approved marketplace provider + full prefunding | PARTIAL (Stripe path; P4 adapter/domains) |
| 3 | Milestone templates, submit, approve, revisions, auto-approval, payout release, partial refund | PARTIAL (auto-approval job; kill fees) |
| 4 | Dispute create + evidence + admin decision | PARTIAL (deepen reason codes/outcomes) |
| 5 | Jurisdiction activation controls | DONE base; deepen managed flags |
| 6 | Staged / recurring / advanced change orders / revenue-sharing | Deferred after base (Dev P3–P4) |

**Locked decisions still binding:** no hard-coded fee %; default protected milestone funding where allowed; never say “escrow” unless authorized; accepted deals keep frozen snapshots; milestone-specific disputes; jurisdiction gating mandatory.

### 7.2 Development Addendum v1.1 — Acceptance tests (§22)

| # | Test | Status |
|---|---|---|
| 1 | Overlapping fee rules → expected winner | PARTIAL |
| 2 | Accepted collab keeps fee after rule change | DONE |
| 3 | Fully Funded only after provider reconciliation | PARTIAL |
| 4 | Submit+approve → exact net/fee from snapshot | PARTIAL |
| 5 | Auto-approval once-only job | PARTIAL (sweep on read, not job) |
| 6 | Revision limit → change order/dispute | PARTIAL |
| 7 | Dispute blocks only disputed milestone | PARTIAL |
| 8 | Cancellation/kill fee math | NOT STARTED / thin |
| 9 | Duplicate webhook idempotency | DONE base |
| 10 | Jurisdiction disables protected payments in UI/API | PARTIAL / largely DONE |
| 11 | Escrow term gated by capability | DONE base |
| 12 | Ledger reconciles to provider | PARTIAL |
| 13 | Change order dual acceptance | PARTIAL |

### 7.3 Development Addendum — Homepage strip (§23.9)

| # | Test | Status |
|---|---|---|
| 1 | No placeholder 50K+/12K+ as factual scale | PARTIAL (value-prop shipped; audit footer/stats) |
| 2 | Four default pillars exact copy + accessible icons | PARTIAL / largely DONE |
| 3 | Admin edit/reorder without deploy | DONE |
| 4 | Disable pillar → balanced layout | Needs QA |
| 5 | Protected Payments claim market-aware | PARTIAL |
| 6 | Mobile accessible, no overflow | Needs QA |
| 7 | Analytics pillar events | NOT STARTED / thin |
| 8 | Live text/SVG not raster | DONE (component) |

### 7.4 Terminology Addendum §6

| Criterion | Status |
|---|---|
| No “Create a Creator Account” public path | DONE |
| Join as Influencer / Create / Claim CTAs | DONE |
| Business Find Influencers / Suggestions | DONE |
| Collab Influencer Opportunities wording | DONE |
| Mentorship Influencer Mentor language (stub) | DONE |
| Content Creator remains self-description | DONE |
| Legacy `creator_*` migrated or deprecated with mapping | NOT STARTED (W1/P8) |
| Notification/email/legal/CMS templates audited | NOT STARTED (W1) |
| Search treats creator/content creator/influencer as related | PARTIAL (base synonyms) |

### 7.5 Collab OS §21 acceptance

| # | Criterion | Status |
|---|---|---|
| 1 | Public landing logged-out with required sections | DONE (#82) |
| 2 | Role-aware hubs | DONE (#76/#78) |
| 3 | Business request + suggestions | DONE (#74/#78) |
| 4–6 | Milestone templates + entitlements + 100% + accept | DONE (#80) |
| 7–10 | Fee snapshots + Operations vs Holding + dual release | NOT STARTED (P4) |
| 11–12 | Payout routes + ROUTE_READY | PARTIAL thin → P5 |
| 13–16 | Webhooks/cancellation/disputes/corridor suspend | PARTIAL ledger; deepen W3 + P6 |
| 17 | Airwallex only in adapter | NOT STARTED (P4) |
| 18 | Auditable financial actions | PARTIAL; extend with domains |

### 7.6 Platform Spec §33 MVP (live proof)

| Item | Status |
|---|---|
| Admin CMS without deploy | DONE for many; landings added |
| Taxonomy + search | DONE |
| Seed → invite → claim | Code DONE; live mail evidence OPEN (L1) |
| Influencer manages profile | DONE |
| Guest gates | DONE |
| Stable profile URL + QR | PARTIAL (INFLR.me DoD incomplete) |
| Plans/entitlements enforced | DONE |
| Live payment provider evidenced | OPEN (L1) |
| AI provider routing | Code path; evidence open |
| Google SMTP evidenced | OPEN (L1) |
| Audit + retryable jobs | Structurally DONE |

### 7.7 INFLR.me Spec §20

| Criterion | Status |
|---|---|
| Valid slug resolves | PARTIAL / largely DONE |
| Alias after slug change | PARTIAL |
| Permanent QR survives slug change | PARTIAL / largely DONE |
| Pro dynamic destination without QR regen | PARTIAL (admin path; self-serve UX open) |
| Suspended link blocked | PARTIAL |
| Entitlement-driven behavior | PARTIAL |
| Admin reserve/suspend/audit | PARTIAL |
| Branded failure UX | PARTIAL |
| Open-redirect protection | PARTIAL |
| Analytics privacy + entitlements complete | NOT STARTED / thin |
| Canonical SEO on Influrios profile | PARTIAL |
| Domain config change without code | PARTIAL |
| Observable resolver metrics | NOT STARTED |

### 7.8 Product Strategy v2.2 — still binding product rules

- Four engines remain the product spine (Discovery, Collaboration Network, Card/INFLR.me, Business Matching).  
- Card is a monetizable product in its own right (Starter/Plus/Pro), not only a profile chrome.  
- Matching must stay explainable (“Why this match?”).  
- Do not begin new scope with Meilisearch, scraping, or fabricated scale stats.  
- Acquisition wedge remains claimable profiles + free Influencer Card before full marketplace complexity.

---

## 8. Recommended sequence (detailed)

```
NOW (low risk / residual)
 ├─ W1 Terminology inventory + profile self-description depth
 ├─ W2.1 Landing design QA + CMS smoke
 ├─ W2.2–W2.3 Hub honest empty states / dead-end nav
 ├─ W2.5 Funding badge / fee summary UX polish
 └─ W3.1–W3.2 Fee-type / service-level completeness + §22.1 tests
        │
        ▼
P4  Financial domains + PaymentProviderAdapter
        │
        ├─ deepen W3.3–W3.7, W3.10–W3.12 (jurisdiction depth, staged/NONE,
        │   auto-approval job, disputes/kill fees, attribution contest,
        │   content rights, notifications, legal pack)
        │
        ▼
P5  Payout readiness + corridors (unlocks W2 hub payout panel)
        │
        ▼
P6  Admin Collab control plane
        │
        ▼
P7  Mentorship full hub
        │
        ▼
P8  Legacy teardown + API deprecations
        │
PARALLEL anytime:
  L1 Phase M evidence (when secrets available)
  L2 smoke tests
  L4 collab_os_v1 switch (low risk)
  L5 Airwallex checklist artifact (docs)
  W5 INFLR.me Phase 3 (Pro dynamic self-serve) — do not block P4
  W6 SocialProofStats only with verified data

LATER / gated:
  Dev P3 staged/recurring expansion already sketched in W3.4
  Dev P4 revenue sharing / complex splits
  W5 Phase 4 campaign/NFC/scheduled
  L3 agency multi-seat invite/auth
  Airwallex adapter implementation after L5 checklist signed
  Collab Messages / inbox product (Figure 2 nav) — only if product promotes beyond hiding dead nav
```

### Immediate next coding slices (ordered)

| # | Slice | Streams | Risk |
|---|---|---|---|
| 1 | Landing QA checklist + CMS smoke + terminology inventory doc | W1, W2.1 | Low |
| 2 | Dashboard/profile self-description from admin list (not free-text) | W1 | Low |
| 3 | Hub dead-end nav cleanup + honest empty states; business applicant reply/decline | W2.2–W2.3 | Low |
| 4 | Fee-type / service-level enforcement + rule-tester acceptance tests | W3.1–W3.2 | Medium |
| 5 | Contract residual E2E: custom milestones + immutable fee lock + service-level UX | W3 / P3 residual | Medium |
| 6 | Funding badges + immutable fee summary in hubs | W2.5 | Low |
| 7 | **P4** account purposes + provider adapter interface | P4 | High (money) |
| 8 | Dedicated auto-approval job + kill-fee/cancellation matrix | W3.5–W3.6 | Medium |
| 9 | Jurisdiction capability depth + managed-mode gates | W3.3 | Medium |
| 10 | **P5** payout readiness | P5 | High |
| … | P6 → P7 → P8 (incl. JSON demo deletion) | | |
| ∥ | Phase M evidence when secrets available | L1 | Ops |
| ∥ | `collab_os_v1` switch + Airwallex checklist doc | L4, L5 | Low |
| ∥ | INFLR.me Pro dynamic self-serve | W5 | Medium |

---

## 9. Background jobs & API surface still owed (Dev Addendum §16–17)

### Jobs to implement or harden

| Job | Status |
|---|---|
| Funding reconciliation | PARTIAL |
| Milestone review deadline / auto-approval | PARTIAL (read-path sweep) |
| Scheduled release / payout reconciliation | PARTIAL |
| Provider hold-period warnings | NOT STARTED |
| Failed payout retry | PARTIAL |
| Dispute SLA reminders | NOT STARTED |
| Recurring funding-cycle creation | Deferred |
| Financial reconciliation / mismatch alerts | PARTIAL |

### APIs still incomplete vs Dev §16

`POST /collaborations/quote`, accept, funding-intent, GET funding, milestones CRUD/submit/approve/revision/disputes, change-orders, cancel, ledger-summary, `webhooks/payments/{provider}`, admin fee-rules (exists), admin jurisdiction-payment-capabilities (partial). Map each to existing App Router handlers before inventing parallel routes; prefer extending current collaboration + marketplace-ledger surfaces.

---

## 10. Explicit non-goals (until product asks)

From Platform Spec §31, Strategy, Collab OS, Development State, Dev Addendum deferred list:

- Meilisearch / separate search microservice  
- Stripe Connect hard-enable without switch + secrets  
- Formal e-sign / counsel contracts as default  
- Airwallex hard-coded domain rules  
- Scraping / unofficial social APIs  
- Fabricated public stats (“150K+ Collaborations”, placeholder 50K+/12K+)  
- Revival of “Influence Connect” branding  
- Raster images as the live Influencer Card  
- Mixing mentorship payouts into collaboration holding without paid-mentoring flag  
- Blind Prisma `Creator` table rename in one deploy  
- Revenue-sharing collaborations / complex split payouts / enterprise negotiated rules (Dev P4)  
- Campaign/NFC/scheduled INFLR.me routes (INFLR.me Phase 4) before P4–P5 finance  
- Recurring ambassador funding before base ledger + P4 stable  
- Full collab **Messages / inbox** product until product promotes it (until then: hide dead hub nav — W2.2)  
- Claiming e-sign provider success from the contract wizard (`/admin/signing` shell stays non-goal until counsel)  

---

## 11. Doc & design references

| Asset | Path |
|---|---|
| This plan | `docs/FULL_IMPLEMENTATION_PLAN.md` |
| Development state | `docs/DEVELOPMENT_STATE_AND_NEXT_PLAN.md` |
| Collab OS plan | `docs/collaboration/COLLABORATION_OS_PLAN.md` |
| Collab OS spec | `docs/source-specs/Influrios_Collaboration_Dev_v1.txt` |
| Platform Spec v2 | `docs/source-specs/Influence_Platform_Development_Specification_v2.txt` |
| Product Strategy v2.2 | `docs/source-specs/Influrios_Product_Strategy_v2.txt` |
| Product Addendum v1.1 | `docs/source-specs/Influrios_Product_Addendum_v1.pdf` |
| Dev Addendum v1.1 | `docs/source-specs/Influrios_Development_Addendum_v1.pdf` |
| Terminology | `docs/source-specs/Influrios_Influencer_Terminology_Development_Addendum_v1.pdf` |
| INFLR.me Spec | `docs/source-specs/INFLRme_Dev_Spec_v1.pdf` |
| Designs | `docs/design-references/collaboration/public-landing-v3.png`, `.../business/for-businesses-v2.png`, `creator-hub.png`, card assets |

---

## 12. Definition of “complete” for this program

The remaining program is complete when:

1. All **PARTIAL** W1–W6 exits are checked or explicitly deferred with owner sign-off.  
2. **P4–P7** exits are met.  
3. **P8** teardown inventory is executed or scheduled with owners.  
4. **L1** Phase M evidence pack exists for SMTP + Stripe + social.  
5. No attached source-doc MUST in §7 remains unchecked without a written deferral pointing to a later phase.  
6. Money invariants (PA001–PA007 / Collab OS §1.3) still hold under automated tests.
