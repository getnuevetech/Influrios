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
| Jurisdiction capability flags (`protected_payment_enabled`, `escrow_term_allowed`, full/staged/recurring, managed intro/negotiation, approved providers, legal review) | Dev Addendum §6; Collab OS §10 | W3.3 **DONE** |
| Funding modes: full / staged / none (+ recurring deferred) | Product Addendum §7; Collab OS §7 | W3.4 |
| Review, revisions, auto-approval, kill fees, chargebacks | Product Addendum §9–12; Dev Addendum §8–14 | W3.5–W3.6 |
| Relationship attribution / repeat deals | Product Addendum §14; Dev Addendum §15 | W3.7 |
| Content rights separate from payment release | Product Addendum §13 | W3.10 |
| Funding/milestone notifications | Dev Addendum §18 | W3.11 **DONE** |
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
| Dev P2 operations | Disputes, cancellation, reports, change orders, notifications | PARTIAL ledger; W3.6 / W3.11 done; **P6** admin |
| Dev P3 expansion | Staged/recurring, more countries, advanced attribution | W3.4 / W3.7 after P4 stable |
| Dev P4 advanced | Revenue sharing, complex splits, enterprise rules | Explicitly deferred (§11) |
| — | UX hubs / marketplace / mentorship | Collab **P0–P3 DONE**; **P5–P8 core shipped** |

---

## 2. Current maturity snapshot (four engines)

| Engine (Strategy v2.2) | Status | What exists | What remains |
|---|---|---|---|
| Influence Discovery | **PARTIAL → largely DONE** | Directory, taxonomy, filters, guest gates, claim wedge | SEO synonyms depth (W1); no Meilisearch |
| Influencer Collaboration Network | **PARTIAL** | Matching, propose, hubs, contract wizard, marketplace objects, ledger core | Finance domains P4, payouts P5, commercial depth W3, mentorship P7 |
| Influencer Card + INFLR.me | **PARTIAL** | Tier-aware card, shortlinks, opaque QR, admin short-links, Pro self-serve dynamic destination + history/rollback | Full INFLR.me DoD, Phase 4 campaign/NFC, advanced analytics |
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
| D22 | Jurisdiction payment capability flags | `CollaborationJurisdiction` full matrix + `jurisdiction-capabilities.ts` + admin marketplace + prefund/wizard gates | Dev Addendum §6; PA004/PA007 |
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

#### W2.2 Influencer hub residuals — DONE
| Exists | Missing | Exit |
|---|---|---|
| Status cards, matches, pipeline, payout panel with Global Payout Ready; Messages dead nav removed; honest empty earnings copy | — | Zero 404 / misleading nav; empty/not-ready copy only |

#### W2.3 Business hub residuals — DONE (intent refresh deferred)
| Exists | Missing | Exit |
|---|---|---|
| Requests, suggestions, spend summary, contract link; applicant reply/decline/shortlist in hub UI | Intent refresh / multi-creator team proposals (Collab OS §3.3) deferred | Reply/decline/shortlist without admin workarounds |
| Pipeline chrome mapped to funding/milestone states via `derivePipelineStage` + funding badges | — | No cosmetic-only steps — **DONE** |

#### W2.4 Mentorship stub — DONE (full module = P7 core shipped)
| Exists | Missing | Exit |
|---|---|---|
| Banner + `/mentorship` find/become hub + eligibility + request flow | Paid commercial pack; richer scheduling | Residuals under **P7 still open** |

#### W2.5 Product UX funding surfaces — DONE (hub + payments)
**Source:** Product Addendum §16  

| Exists | Missing | Exit |
|---|---|---|
| Funding badges on payments + hub pipelines; immutable fee snapshot on funding + hub fee locked line; revision counters on payments + hub; review deadline on submitted milestones | Unified admin transaction view (Dev §19) remains under P6 deepen | Badges + timeline + fee + revisions visible to both sides |

---

### W3 — Collaboration finance & commercial depth — PARTIAL (next major)

**Source:** Product Addendum v1.1; Development Addendum v1.1; Collab OS §5–14  

Much ledger work exists; the following are still incomplete vs addenda.

#### W3.1 Fee matrix completeness — PARTIAL → fee types + report columns shipped
| Exists | Missing | Exit |
|---|---|---|
| Versioned rules, simulator, snapshots; **`feeType` column** + labels; funding_mode / relationship_source / promotion_channel conditions; funding `feeSnapshotJson.feeType`; ledger totals + monthly report **feesByType** columns | TIERED/WAIVED/CUSTOM_ENTERPRISE methods | Snapshots store fee type; condition matching DONE; reports separate fee-type columns **DONE** |
| Conditions include serviceLevel | Full condition set beyond jurisdiction/service/gross | Rule tester explains winner (**done**) |
| Priority/specificity + §22.1 overlap test | — | Test asserts documented winner |
| Fee methods percent/fixed/combo | TIERED/WAIVED/CUSTOM_ENTERPRISE | Deferred |

#### W3.2 Service levels — DONE
| Exists | Missing | Exit |
|---|---|---|
| `serviceLevel` on rules + funding; **wizard select** + admin selects; payments console select uses jurisdiction-allowed **fundable** levels only | — | Every contracted deal can record Product §3 enum |
| Hard-coded `"contracted"` removed from wizard/actions **and** payments/`requestPrefund` (require explicit fundable level via `requireFundableServiceLevel`) | — | No silent contracted / managed default when form omits level (W3.3 gates still refuse disabled managed modes) |

#### W3.3 Jurisdiction / terminology gates — DONE
| Exists | Missing | Exit |
|---|---|---|
| Full capability set on `CollaborationJurisdiction`: protected/escrow + full/staged/recurring funding, managed_introduction/negotiation, `approvedProviderIds`, `legalReviewStatus`, effective dates; admin marketplace toggles; `jurisdiction-capabilities.ts` gates | — | Capability flags override features (PA007) end-to-end |
| `requestPrefund` + contract wizard refuse managed modes / schedule kinds until jurisdiction enables (even if fee rule exists) | — | Dev Addendum §24 managed-service gate |

#### W3.4 Funding modes — DONE (recurring deferred)
| Exists | Missing | Exit |
|---|---|---|
| Explicit `fundingMode` FULL / STAGED / NONE on funding; badges + staged phase start gate; UI labels | Recurring/ambassador as a fourth product mode | Staged: later phases cannot start unfunded; NONE never shows Fully Funded |
| Schedule kinds still support `recurring` | Product-mode expansion for ambassador cycles | Deferred until Dev P3 — do not block |

#### W3.5 Milestone lifecycle depth — DONE
| Exists | Missing | Exit |
|---|---|---|
| Templates, submit/approve; auto-approval job; revision tracking; §22.6 exhausted → change order/dispute; Dev §8 labels; plan/jurisdiction/settings lifecycle snapshot frozen on milestones + fee snapshot | — | Dev Addendum §8 + §22.5–6 |

#### W3.6 Disputes / cancellations / refunds / chargebacks — PARTIAL (kill-fee + §13 + chargeback ops shipped)
| Exists | Missing | Exit |
|---|---|---|
| Dispute + partial refund + change-order; `calculateCancellation` kill-fee matrix + admin kill-fee settings; `funding.chargeback` → `payment_risk`; held cancel + dispute refund queue adapter `provider_instruction` jobs (`mkt_refund_*` / `mkt_cancel_*`); admin chargeback/cancel ops UI; Dev §13 reason catalog + resolution outcomes | Live provider rails beyond marketplace instruction queue; deeper chargeback evidence pack | Product Addendum §11–12 acceptance (core ops path DONE) |
| Milestone-specific disputes with reason codes + evidence + outcomes (release/refund/split/settle/escalate) | — | §22.7–8 reason/outcome depth DONE; provider live rails still open |

#### W3.7 Attribution / repeat deals — DONE
| Exists | Missing | Exit |
|---|---|---|
| Attribution sources + expiry window; `AttributionClaim` contest workflow; funding `attributionStatus` / `attributionExpiresAt`; fee resolution remaps managed levels for pre-existing | — | Dev Addendum §15 |
| Admin marketplace contest UI (file / uphold / reject) | — | Contested pre-existing claims resolvable |

#### W3.8 Financial domains & provider adapter — DONE (→ P4)
| Exists | Missing | Exit |
|---|---|---|
| Logical OPERATIONS vs COLLABORATION_HOLDING; `PaymentProviderAdapter`; fee earned on release | — | Collab OS P4 / Dev Addendum §1, §10–11 |

#### W3.9 Payout readiness & corridors — PARTIAL (→ P5 core shipped)
| Exists | Missing | Exit |
|---|---|---|
| Hub payout panel + payout profile / corridors; ROUTE_READY includes corridor; fee/FX quote helper | Admin corridor matrix UI (P6); live method verification rails | Collab OS §9–10 |

#### W3.10 Content rights vs payment — DONE
**Source:** Product Addendum §13  

| Exists | Missing | Exit |
|---|---|---|
| `rightsStatus` / `rightsActivateOn` / `rightsActivatedAt` on milestones; activate on release (default) or acceptance; financial plan snapshot; payments UI separates rights from acceptance | — | Rights state separate from milestone acceptance |

#### W3.11 Notifications — DONE
**Source:** Dev Addendum §18  

| Exists | Missing | Exit |
|---|---|---|
| Event kinds + Influencer templates; `collab_notification` jobs; hooks on funding/milestones/revisions/approvals/payouts/disputes/cancel/refund/change-order/attribution/jurisdiction limits; review-deadline sweep | — | Event kinds + templates use Influencer terminology |

#### W3.12 Legal pack commercial sync — DONE
**Source:** Product Addendum §17  

| Exists | Missing | Exit |
|---|---|---|
| Marketplace Terms + Protected Payments Policy v1.2 reference live fee snapshot; explicit fee-disclosure checkbox + timestamp on contract fund; legal acknowledgements recorded | — | Fee disclosure acceptance + snapshot-referenced legal pack |

---

### W4 — Business matching & managed services — PARTIAL

**Source:** Strategy §9; Platform Spec §13 R073; Product Addendum managed fees  

| Exists | Missing | Exit |
|---|---|---|
| Business briefs, shortlists, `/admin/matching` intros; **R073 copy + gates**: intro ≠ protected payment; discovery/platform_match not fundable; intro “paid” = intro fee settled | Managed campaign commercial pack deepen; verified stats | Copy + flows enforce distinction |
| Managed matching queue; jurisdiction-gated `managed_intro` / `managed_campaign` | End-to-end intro-fee settlement provider path | Service levels live for fundable contracted/managed deals |
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
| Dynamic destination without QR regen | No | No | Yes | DONE (Pro self-serve + history/rollback; admin path retained) |
| Analytics depth | Basic profile | Standard | Advanced | DONE (entitlement-gated privacy-safe summaries) |

#### INFLR.me residuals

| Exists | Missing | Exit |
|---|---|---|
| `ShortLink*` models, resolver, opaque QR, `/admin/short-links`, domain records; **branded failure pages** with Influrios CTA + outcome marker; **alias policy** (admin enable/disable redirect + creator warn-before-change) | Domain verification admin UX deepen | Spec §20 criteria 11–24 (branded failure + open-redirect + suspend + alias policy — **core DONE**) |
| Pro `dynamic` flag + destination setter | Pro **self-serve** dynamic destination + destination history + rollback | Spec §9 + Phase 3 — DONE (Phase 4 campaign/NFC still later) |
| Basic analytics events | Privacy-safe async analytics + CTA/conversion events; entitlement-gated creator analytics; **resolver ops metrics** | Spec §10 — DONE; Spec §20 observable resolver metrics — **DONE** |
| — | Campaign links `/c/`, NFC, scheduled destinations (Phase 4) | Explicitly later; do not block P4 finance |
| Card design system | Align remaining chrome to Platform Spec §39 assets; live data not raster | Card matches approved vertical standard |
| OG / social sharing | Influrios-branded preview; canonical SEO on influrios.com | Spec §11 — DONE (card/profile OG + INFLR crawler interstitial) |

---

### W6 — Platform CMS / homepage / admin completeness — PARTIAL

**Source:** Platform Spec §5, §17; Dev Addendum §23 VP001–VP008  

| Exists | Missing | Exit |
|---|---|---|
| Banners, categories, value-prop strip, landing CMS | Verified `SocialProofStats` with source/as-of + disable-when-stale; never show placeholder 50K+/12K+ as factual | §23.8–23.9 — **DONE** (footer strip verifies source/as-of; placeholders disabled) |
| Value-prop four pillars; responsive matrix ≥1200 / 768–1199 / &lt;768; pillar click analytics; jurisdiction-aware Protected Payments claim | — | §23.9 acceptance tests — **DONE** |
| Admin modules wide; **collab finance RBAC** (`collab_finance.view/manage/high_risk`) + password step-up on held cancel / dual-approval threshold | — | Collab OS §11; Platform Spec §34 — **DONE** (core) |
| RBAC permission groups for collab finance; step-up for high-risk actions | — | Platform Spec §34; Dev §20 — **DONE** |

---

## 5. NOT STARTED — Collab OS P4–P8 (Workstream P)

### P4 — Finance domains & provider adapter — PARTIAL (core shipped)

**Sources:** Collab OS §7–8; Dev Addendum §1, §10–11; PA003  

**Shipped**
1. `AccountPurpose` + `LedgerEntry.accountPurpose` (HOLDING on hold; OPERATIONS on earned fee)  
2. Fee no longer booked on `funding.held`; dual legs on `payout.released` (creator `release` + platform `fee`)  
3. `PaymentProviderAdapter` + marketplace signed-webhook adapter; webhook route uses adapter  
4. Domain tests: Operations $0 until release; reconcile subtracts earned fees from Holding  

**Still open**
- Full adapter method surface for live provider funding/release (stubs remain)  
- Airwallex after §8.3 checklist (L5)  
- Admin account-purpose control plane (P6)

**Exit (core):** $0 Operations until fee earned — met in unit tests. Adapter swap does not change domain rules — marketplace adapter is the boundary.

---

### P5 — Payout readiness & corridor engine — PARTIAL (core shipped)

**Sources:** Collab OS §9–10  

**Shipped**
1. `InfluencerPayoutProfile` (primary/secondary methods + statuses) + `CountryActivationCorridor` matrix  
2. `computePayoutReadiness` → Global Payout Ready = identityVerified + active corridor + ready gateway + ≥1 verified method  
3. Hub payout panel shows Global Payout Ready, method, corridor, blockers (not a shell)  
4. Contract wizard ROUTE_READY includes corridor activation; identity gate uses `identityVerified` only  
5. Exact fee/FX quote helper (`buildPayoutFeeFxQuote`) on contract preview + approve-before-release  

**Still open**
- Admin corridor control plane (P6)  
- Live provider connected-account verification flows for method status  
- Full route-decision matrix (limits, settlement time, fallback provider)  

**Exit (core):** Fundable only when ROUTE_READY (corridor + route + identity) — met. Hub UI real — met.

**Depends on:** P4 domains stable.

---

### P6 — Admin Collaboration control plane — PARTIAL (core shipped)

**Sources:** Collab OS §11; Dev Addendum §19  

**Shipped**
1. `/admin/corridors` — Country Activation Matrix: suspend/activate + edit methods/FX/holding without deploy  
2. `/admin/collaboration-ops` — versioned control plane (dual-approval threshold, mentorship eligibility, guest collab thresholds) + account-purpose catalog + audit trail  
3. Dual-approval gate on Trust ledger dispute decisions when override USD ≥ threshold  
4. Admin nav cards + sidebar for Collaboration ops / Corridors  

**Still open**
- Deeper Provider Health dashboard beyond gateways page  
- Mentorship product surfaces reading eligibility (P7)  
- Guest collab propose/apply quota enforcement in public flows — **DONE** (control-plane soft/hard on propose page + save/apply intents)  
- RBAC permission group dedicated to collab finance high-risk actions — **DONE** (`collab_finance.*` + password step-up)  

**Exit (core):** Ops can suspend a corridor and change control-plane thresholds without deploy — met. Fee future-deals already on `/admin/fees`. High-risk money actions require dedicated permission + step-up — met.

**Depends on:** P4–P5 concepts exist to configure.

---

### P7 — Mentorship module (full) — PARTIAL (core shipped)

**Sources:** Collab OS §2.4; Terminology §3.4  

**Shipped**
1. `/mentorship` dual hub: Find an Influencer Mentor + Become an Influrios Influencer Mentor  
2. Emerging vs Experienced Influencer language (follower band)  
3. `MentorshipProfile` / `MentorshipRequest` + eligibility from P6 control plane; request/accept/decline/cancel  
4. `paid_mentoring` product switch (default off); fund-isolation invariant — never uses Collaboration Holding  

**Still open**
- Richer matching / scheduling UI  
- Paid session pricing, terms, and tax pack when flag is enabled for production  
- Mentor discovery on public collaboration landing beyond existing banner  

**Exit (core):** Acquisition loop live (find/become/request); free mentorship does not touch collab funds — met.

---

### P8 — Migration & teardown — PARTIAL (core shipped)

**Sources:** Collab OS §19; Terminology §4.2; Platform Spec §31  

**Shipped**
1. Legacy inventory doc (`docs/collaboration/legacy-inventory-p8.md`)  
2. Freeze hardened: when `legacy_demo_payments` is off, demo stores never rehydrate/seed JSON and **purge** existing `protected-payments.json` / `trust.json`  
3. `creator_*` SKU deprecation telemetry on checkout (`terminology.creator_field_deprecated`)  
4. `/admin/signing` copy: non-goal shell until counsel; accept-only wizard stands  

**Still open**
- Optional rename of billing SKUs / cookies after a dual-write window (do not break Stripe metadata yet)  
- Full removal of `protected-payments.ts` / `trust.ts` modules after a longer soak  

**Exit (core):** One collaboration money engine when demos are off; no silent Creator-as-role public strings; demos purged/gated — met.

---

## 6. Parallel launch / quality (Workstream L)

### L1 — Phase M staging evidence — PARTIAL (scaffold DONE)
| Exists | Missing | Exit |
|---|---|---|
| Probe + runbook | SMTP, Stripe sandbox, social OAuth, marketplace webhook evidence packs signed by operator | Platform Spec §33 items 8–10 demonstrated live |

### L2 — Smoke / integration tests — PARTIAL → catalog shipped
| Exists | Missing | Exit |
|---|---|---|
| Broad unit suite (`tsx --test`); **HTTP smoke catalog** (`http-smoke.ts`) covering landing/discover/claim/collab/pricing/resolver | Playwright browser E2E; default CI still offline (set `SMOKE_BASE_URL` + `SMOKE_LIVE=1` for live fetch) | CI or staging checklist per release — catalog gate **DONE**; live Playwright later |

### L3 — Agency seats — DONE (CRUD) / PARTIAL (auth)
| Exists | Missing | Exit |
|---|---|---|
| Seat CRUD behind `agency_seats` switch (default **off**) | Invite/accept flow + multi-seat session auth when switch on | Design + ship only when product enables |

### L4 — Collab OS feature flag — DONE
| Exists | Missing | Exit |
|---|---|---|
| `collab_os_v1` product switch (default **on**); hubs/contract gated; public landing + propose/records remain; admin marketplace toggle | — | Ops can disable collab OS surfaces without deploy |

### L5 — Airwallex validation checklist artifact — DONE (unsigned)
| Exists | Missing | Exit |
|---|---|---|
| `docs/collaboration/AIRWALLEX_VALIDATION_CHECKLIST.md` with §8.3 items + sign-off columns | Operator sandbox signatures | Signed before any Airwallex adapter hard-wires |

---

## 7. Per-document residual checklist (what each source still requires)

### 7.1 Product Addendum v1.1 — Recommended MVP (§18)

| # | MVP item | Status |
|---|---|---|
| 1 | Fee engine + admin matrix + immutable snapshots | PARTIAL → types/conditions/report columns largely DONE |
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
| 1 | No placeholder 50K+/12K+ as factual scale | DONE (footer requires source/as-of; placeholders disabled) |
| 2 | Four default pillars exact copy + accessible icons | DONE |
| 3 | Admin edit/reorder without deploy | DONE |
| 4 | Disable pillar → balanced layout | DONE (`valuePropPillarGridClass` 1–4) |
| 5 | Protected Payments claim market-aware | DONE (home jurisdiction gate + fundingTerm title) |
| 6 | Mobile accessible, no overflow | DONE (1-col &lt;768 / 2-col tablet / 4-col ≥1200) |
| 7 | Analytics pillar events | DONE (`homepage_value_prop_pillar_click` via beacon API) |
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
| Alias after slug change | DONE (admin redirect toggle + creator confirm) |
| Permanent QR survives slug change | PARTIAL / largely DONE |
| Pro dynamic destination without QR regen | DONE (Pro self-serve + history/rollback) |
| Suspended link blocked | DONE (`finishSlug` / QR path return 403 branded page) |
| Entitlement-driven behavior | PARTIAL |
| Admin reserve/suspend/audit | PARTIAL |
| Branded failure UX | DONE (CTA + outcome marker on resolver fallbacks) |
| Open-redirect protection | DONE (`safeRedirectTarget` allow-list) |
| Analytics privacy + entitlements complete | DONE (views/standard/advanced + bot filter; no precise geo) |
| Canonical SEO on Influrios profile | DONE (OG alternates.canonical → /creators/{slug}) |
| Domain config change without code | PARTIAL |
| Observable resolver metrics | DONE (outcome + latency on every resolve; admin 24h rollup; `x-influrios-resolve-outcome`) |

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
  L4 collab_os_v1 switch — DONE
  L5 Airwallex checklist artifact — DONE (awaiting operator sign-off)
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
| ∥ | `collab_os_v1` switch + Airwallex checklist doc | L4, L5 **DONE** | Low |
| ∥ | INFLR.me Pro dynamic self-serve | W5 | Medium |

---

## 9. Background jobs & API surface still owed (Dev Addendum §16–17)

### Jobs to implement or harden

| Job | Status |
|---|---|
| Funding reconciliation | DONE (stale awaiting_provider + unbalanced held/payment_risk ledger flags; admin queue) |
| Milestone review deadline / auto-approval | DONE (job + review-deadline sweep + frozen window) |
| Scheduled release / payout reconciliation | DONE (approve → release_scheduled → release_requested + mkt_release_*; payout.failed retry; admin authorize + sweep) |
| Provider hold-period warnings | DONE (sweep + admin queue; 7d default) |
| Failed payout retry | DONE (backoff + max attempts; no retry if release ledger exists; admin queue) |
| Dispute SLA reminders | DONE (sweep + admin queue; 72h default) |
| Recurring funding-cycle creation | Deferred |
| Financial reconciliation / mismatch alerts | DONE (funding_recon_mismatch audit + notify; admin queue) |

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
