# Influrios — Implementation Plan

**Status:** Phases A–I are implemented, and the short-link resolver boots only when its tables are readable. Phase 12.3 is the marketplace ledger: a prefund stays unfunded until a signed provider webhook confirms it, milestone release is a ledger entry, and the word escrow appears only when that jurisdiction allows it. Phase 12.4 records a milestone dispute and can cancel an unconfirmed prefund. A dispute decision does not post a ledger entry, and a refund still waits for a signed provider webhook. Phase 12.5 freezes an attribution source on each prefund and can repeat a provider-confirmed deal without copying its ledger or its fee snapshot. Phase 12.6 can split a prefund into stages or open a recurring series. Each tranche stays unfunded until its own signed webhook. Phase 12.7 converts a non-USD prefund, routes the jurisdiction to one marketplace provider, and writes revenue-share lines when that provider releases a milestone. Those lines are not cash. A missing rate or a provider that is not ready creates no funding row. Phase 12.8 pulls that rate from the Wise user quote for the saved profile. A typed minor-unit figure is not used. If Wise is not ready or does not return a rate, nothing is funded. Phase 12.9 copies a revision limit onto each milestone. Asking for a revision sends submitted work back to the creator and does not move the ledger. A later limit edit does not raise the count already saved on that milestone. Public Home, Discover, profile, card, and collaboration layouts stay as designed. Live charges, live model replies, and a signed envelope still wait for the assigned provider to confirm. New product behavior must be editable in admin, not left only as a source constant.  
**Sources:** Technical Development Specification v2.2 and the design templates, reviewed against the repo.  
**Date:** 2026-09-30  
**Supersedes for sequencing:** the “build Phase 0–1 next” close of `docs/RECOMMENDATIONS_AND_EXECUTION_PLAN.md`, and any impulse to keep extending JSON demo modules.  
**Does not replace:** Product Strategy / Spec v2.2 (behavior), or `docs/ADDENDUM_IMPLEMENTATION_RECOMMENDATIONS.md` (later collaboration-fee compliance).

---

## 1. Verdict

The app is a wide, branded demo. Public pages for Home, Discover, Categories, creator profile, Influencer Card, Collaboration, claim, and admin already exist and follow the template hierarchy closely enough that another visual rewrite is not the critical path.

Spec v2.2’s MVP (section 33) is a **configurable platform**. That baseline is not met.

| Spec expects | Repo today |
|---|---|
| Admin-managed plans, limits, CMS sections, country rules, providers | Launch defaults hard-coded in `src/lib/entitlements.ts`. CMS is four banners + featured cards + one value-proposition strip in `data/cms.json`. |
| Postgres as the directory | Prisma schema is pushed on boot and never read. `src/` has no Prisma client. Search, cards, and matching use `SEED_CREATORS`. |
| Claim → live searchable profile | Claim writes `claim-funnel.json`. Published drafts resolve only on `/c/{slug}` and `/creators/{slug}`. Discover ignores them. |
| Server-side entitlements by feature key | `InfluencerCardView` still branches on `planTier === "PRO"`. |
| Guest gates, audit, queues, provider adapters | Absent. Admin RBAC is the only real access-control surface, and it is file-backed. |
| Versioned migrations and tests | `prisma db push` only. No tests, no CI. |

Existing Phase 2–12 screens (collaboration scoring, business workspace, billing demo, escrow, trust, agency, fee simulator) are useful prototypes. Spec section 31 lists full escrow, contract lifecycle, and e-sign as **non-goals** for the initial build. The addendum still applies later, behind the provider and ledger work. Do not add another demo store before the configuration model exists.

**Next build:** make the directory, entitlements, claim, and CMS actually configurable and durable. Keep the current UI. Rebind it.

---

## 2. Design templates

The attached comps (Home, profile, Discover, Collaboration, Card marketing, Starter / Plus / Pro cards, three backgrounds) match what recent PRs already chased. Treat them as layout and density references only.

Rules while finishing visual fidelity:

- Production wordmark stays **Influrios**. The comps still say “Influence Connect” and `influenceconnect.com`. That raster branding is obsolete (`BRAND-001`, `BRAND-002`, `UI-IC-007`). A repo search of `src/` shows the retired name is already gone from application code. Keep it that way; add a lint check so it cannot return.
- Cards stay live components. Do not ship the portrait PNGs as the card. Background art (`starter` light, `plus` cosmic, `pro` dark) may be optional CSS/SVG layers (`UI-IC-002`).
- Starter shows one social, profile URL, no QR. Plus shows up to three specialties, four socials, shortlink, standard QR. Pro adds dynamic QR, extra specialties, brand inquiry, gold used only on badge and edge. Capability comes from entitlement keys, not from the tier name (`IC-002`, `UI-IC-001`).
- The approved footer stats strip (50K+ / 100+ / 12K+ / 5K+, script line “A growing creator economy together.”) is live and edited at `/admin/stats`. Those figures are marketing copy the stakeholder asked to restore; Discover result counts stay live directory totals. The homepage value-proposition section is a separate CMS block.
- Profile demographics, brand logos, and “key stats” on the template are labeled samples until a source and freshness timestamp exist (`R032`, `R126`). Do not present seed math as verified audience data.

Remaining design work is a **thin pass inside Phase C**, not a separate redesign project: entitlement-driven card chrome, Influrios shortlink copy, and confirmation that gold never appears on Starter or Plus.

---

## 3. Gap matrix

Priority is what blocks section 33, not how polished the screen looks.

| Area | Spec | Current evidence | Plan action |
|---|---|---|---|
| Brand | `BRAND-001`–`003` | Influrios in `layout.tsx`, chrome, cards | Centralize product-name strings in site settings. Lint-ban “Influence Connect”. |
| Persistence | `R143`, `R031` | Schema in `prisma/schema.prisma`; runtime JSON under `data/` (not in git); Docker has no `data/` volume | Migrations. App reads/writes Postgres. Temporary volume only while a module is still on JSON. |
| Entitlements | `R019`–`R024`, `IC-001`–`IC-007` | `PLAN_ENTITLEMENTS` constants; `getEntitlements(plan)` | Seed those constants once into `plan_feature_entitlement`. Runtime evaluates feature keys. Remove plan-name checks. |
| CMS | `R025`–`R030` | `SiteCms`: hero, sponsored, CTA, card promo, featured cards, value proposition. Nav is a const in `site-chrome.tsx`. | Section list with draft/publish. Menus from data. Homepage renders the list. |
| Profiles | `R031`–`R034` | `Creator` model exists; six seed creators in code; no provenance | Seed into `Creator`. Field source + verification dimensions. Taxonomy admin. |
| Search | `R057`–`R061` | Discover filters `SEED_CREATORS` in memory | Same filters over Postgres. Sponsored flag separate from relevance. Synonym table. |
| Claim / onboard | `ONB-001`–`ONB-018`, `R042`–`R045` | `/claim` funnel and creator cookie in `src/lib/claim.ts`; verify step is a generated 6-digit code | `onboarding_session` + explicit states. Publish inserts `Creator` + card. Email verification before public claim. |
| Card / QR | `R052`–`R056`, `IC-008`–`IC-012` | inflr.me resolver, `short_link`, opaque `qr_identity`. QR payload is `https://{primary}/q/{token}`. | Keep alias history and do not cache destination redirects. |
| Guest gates | `R015`–`R018`, `R154` | None | Server usage counters. Soft prompt vs hard block on protected actions. |
| Auth | `R010`–`R014` | Admin HMAC cookie. No end-user accounts. | Email/password accounts, verification, reset, consent versions. One identity, many workspaces later. |
| Collab | `R062`–`R067` | Records persist draft → sent → accepted. Offers and needs point at a specialty. “Why this match” is stored with the row. Proposal max is `collaboration.proposals.max`. | Keep the explanation text. Business briefs persist in Phase G. |
| Business / managed | `R068`–`R073` | Briefs, shortlists, inquiries, opt-ins, and introductions persist. `managed_promotion` is edited on `/admin/matching`. Fit ranking stays the platform rule until `business_creator_match` has a live provider. | Keep the queue honest: a request is not an introduction until admin records one. |
| Outreach | `R046`–`R051`, `ONB-019`–`ONB-023` | Not built | Invitation records, opaque claim links, pipeline, suppression. |
| Payments | `R081`–`R088`, section 31 | Stripe Checkout scaffold in `src/lib/billing.ts`; plan not written onto the creator the UI reads | Provider registry. Stripe is provider #1 for **subscriptions**. Do not extend escrow. |
| Email | `R089`–`R095` | None | Notification service. SMTP settings in admin, secrets encrypted. |
| AI | `R074`–`R080`, `ONB-011` | Match copy is deterministic code | Function router. Deterministic matcher is the fallback. One external provider is optional and off until configured. |
| Jobs / audit | `R108`–`R111`, `R118`, `R096` | None | Postgres job table. Audit log on sensitive admin writes. |
| Privacy split | `R006`, `R121`, `R150` | Email sits on the draft/creator shape used by public pages | Public profile DTO must omit private contact, admin notes, and CRM fields. |
| Tests | Section 29 | No test script | Unit tests for entitlement evaluation and state machines before calling a phase done. |

---

## 4. Decisions (spec section 36)

These are defaults. Each sits behind a replaceable boundary.

| Choice | Default | Why |
|---|---|---|
| App shape | Keep the Next.js modular monolith | `R007`. Domains live in `src/lib` now; they become server modules over Prisma, not new services. |
| Auth | Auth.js (credentials) on this app | Spec requires email/password, verification, and reset. Admin-managed SMTP matters more than a hosted IdP. OAuth stays an adapter. |
| Search | Postgres filters + `tsvector` | Discover’s filter set fits SQL at seed scale. Hide it behind a search module so Meilisearch can replace it later (`R057`). |
| Queue | `job` table in Postgres, polled by the web process | Lightsail should not gain Redis for the MVP. Move to a worker only when extraction volume requires it (`R108`). |
| Files | `Storage` interface. Local `public/uploads` in dev. S3-compatible bucket in production | `R128`. Banners already write to `public/uploads/banners`. |
| Analytics | First-party `analytics_event` rows | Schema already has `AnalyticsEvent`. No warehouse (`R112`). |
| Payments | Registry + Stripe adapter for subscriptions | Country routes exist as data. Kenya / M-Pesa is a row shape, not an MVP integration (`R081`). |
| AI | `AiClient` with function keys. Fallback = current deterministic match and taxonomy hints | Enrichment must fail open (`R136`). No provider key in the client (`R147`). |
| Secrets | Env for bootstrap only (`AUTH_SECRET`, `DATABASE_URL`, first admin). Admin-entered provider secrets encrypted with AES-GCM | `R115`, `R141`. |
| Schema change | `prisma migrate`, stop relying on `db push` for ongoing work | `R143`. |

---

## 5. Build sequence

Phases are vertical slices. Each one leaves the current screens working. `R144`: registries, entitlements, audit, and CMS shape land in Phase A–B even if some admin screens stay minimal.

Demo modules that spec section 31 defers (escrow, disputes, contract briefs, agency workspace, fee matrix) stay reachable but get a feature flag defaulting to **on in demo / off for the MVP checklist**. They are not in the critical path.

### Phase A — Durable configuration kernel

**Proves:** an admin change to a limit changes the next request, and a container rebuild does not erase it.

1. Introduce Prisma migrations from the current schema. Generate the client and use it from server code.
2. Add tables (names may follow Prisma style; behavior is fixed):
   - `platform_setting`, `country`, `feature_flag`
   - `plan`, `feature`, `plan_feature_entitlement`, `entitlement_snapshot`
   - `audit_log`
   - `job`
3. Seed specialty taxonomy, the three card plans, and the launch-default keys in `IC` (social max, QR, shortlink, analytics level) from today’s `PLAN_ENTITLEMENTS`. Mark the seed as data, then stop reading the constants in product code.
4. `getEffectiveEntitlements(subject)` merges plan + country + admin grant. Server actions call it. UI may only display the result.
5. Mount a Docker volume for `data/` and `public/uploads` until each store has moved. Pass admin secrets from `.env` into the web service (they are not in `docker-compose.yml` today).
6. Write unit tests for entitlement merge and “limit exceeded”.

**Exit:** changing `card.social_links.max` for Starter in the database changes card rendering and the server-side “add social” check with no deploy. Audit row written for the change.

### Phase B — Directory and CMS on that kernel

**Proves:** spec DoD items 1 and 2.

1. Seed `Creator`, `SocialAccount`, `CreatorSpecialty`, `InfluenceCard` from `src/lib/seed-data.ts`. Profiles gain state: `unclaimed | claimed | verified | restricted` (`R031`) and a provenance enum already sketched as `DataSource`.
2. Point Home, Discover, Categories, `/creators/[slug]`, and `/c/[slug]` at one profile query. Delete the parallel “seed first, JSON claim second” lookup once claims write real rows (Phase C). Until then, union them so nothing disappears.
3. Taxonomy admin: tree, synonyms, enable/disable (`R033`, `R061`).
4. Replace the hard-coded header/footer nav with menu rows (`R026`).
5. Model the homepage as ordered sections: hero, category showcase, featured grid, sponsored band, value proposition, collaboration preview, card promo, CTA, FAQ, statistics. Statistics ship **disabled**. Existing banner and value-proposition editors become section editors instead of a second CMS.
6. Draft / published / `updated_by` on CMS rows (`R029`).
7. Search analytics event `search_submitted` plus `profile_viewed` (`R112`).

**Exit:** admin reorders a section and edits a specialty synonym; public pages follow. Discover lists database creators.

### Phase C — Claim, card, and the template pass

**Proves:** spec DoD items 4 and 6, and the onboarding acceptance path that does not need a live social API yet.

1. Replace the claim JSON document with `onboarding_session`, `profile_claim`, `verification_attempt`.
2. States from `ONB-006`. Separate email-verified from social-verified from data-fresh (`ONB-007`). The current 6-digit code may remain as a **manual/demo verification method** behind the provider list, labeled unverified-for-social until OAuth exists (`ONB-010`).
3. Publish creates/updates `User` (once Phase D auth exists, link it), `Creator`, socials, and `InfluenceCard`, then the profile appears in Discover.
4. Card component:
   - Portrait ~4:5, live text/QR/icons (`IC-004`).
   - Render from entitlement snapshot: social cap, specialty cap, shortlink, QR on/off, dynamic vs standard, branding visibility, contact.
   - Delete `isPro` / `isPlus` styling switches. Map theme tokens (light / violet / indigo+gold) from `card.custom_theme` and analytics level, with gold gated by the Pro **seed** entitlement `theme=full`, still overridable by admin.
5. `qr_identity` opaque token. `/q/{token}` resolves the table. Standard QR encodes the card or short URL (`IC-010`, `IC-011`). Scan recording must not block the redirect (`IC-012`).
6. Completeness rules in `profile_completion_rule`. Dashboard next actions read them (`ONB-015`, `ONB-016`).
7. Attempting a second social on Starter returns a structured denial (`feature`, `limit`, `upgradePlanCode`) (`ONB-017`).
8. Public DTO strips email and admin notes (`ONB-034`).

**Exit:** anonymous visitor enters a handle, sees a private Starter preview, claims, verifies email, publishes, and the new card is on Discover and at a stable `/c/{slug}`. Starter has no QR. Plus and Pro match the template density because their **stored** entitlements say so.

### Phase D — Accounts and guest gates

**Proves:** spec DoD item 5 and scenario 1.

1. Email/password register, verify, reset. Store consent version, time, and source (`R014`).
2. Preserve `onboarding_session` across register/login (`ONB-008`).
3. `guest_usage_policy` as in the spec example. Enforce on the server for search, profile views, and protected actions: proposal, inquiry, export, contact reveal, claim, checkout, managed match, profile edit (`R017`, `R018`).
4. Soft gate shows CMS-configured copy. Hard gate redirects to register and returns to the original action.

**Exit:** a guest hits the configured profile-view limit, registers, and lands back on the profile they were opening.

### Phase E — Invitations and outreach

Implemented at `/admin/invitations` and `/invite/{token}`. SMTP delivery is still Phase H.

**Proves:** spec DoD item 3’s human path (enrichment provider can be “manual/admin” until Phase H).

1. `creator_invitation` + event history (`ONB-022`). Opaque token tied to profile, campaign, expiry.
2. Admin action on a profile: choose template, queue send, set follow-up (`R046`–`R049`).
3. Opening the link shows **that** draft, not a generic signup (`ONB-019`).
4. Status pipeline and do-not-contact suppression (`R048`, `R051`, `ONB-035`).
5. Actual send waits on Phase H’s notification service. Until then, queue + copy-link is an honest admin tool (`R146`: label “send” inactive until SMTP is configured).

**Exit:** admin invites a seeded profile; creator opens the signed link, claims, publishes; invitation status becomes `published`.

### Phase F — Collaboration records

Implemented at `/collaboration/records` and `/admin/collaborations`. Proposal max is edited on `/admin/plans`.

**Proves:** scenario 3. Uses the scorer already in `src/lib/matching.ts`.

1. Add `Collaboration` (the missing `Opportunity`) with states in `R066`.
2. Offers and needs stay structured and tied to taxonomy (`R062`).
3. Propose page inserts a `sent` row. Recipient can accept or decline.
4. “Why this match” stays the current factor list (`R064`).
5. Proposal rate limits read entitlements (`R067`).

**Exit:** two seeded creators complete draft → sent → accepted, and a refresh still shows the record.

### Phase G — Business briefs and managed work queue

Implemented at `/business` and `/admin/matching`. The `managed_promotion` flag is edited on the matching page.

**Proves:** scenario 4. Moves `/business` and `/admin/matching` off JSON.

1. `business_brief`, shortlist, inquiry, intro with the pipeline in section 13.
2. Creator opt-in fields for managed promotion (`R071`).
3. Fit ranking can keep `fitCreatorToBrief`. Label it as a platform rule, not an AI provider, until Phase H maps `business_creator_match`.
4. Feature flag `managed_promotion` (`R133`).

**Exit:** a business brief returns matches; “request managed matching” becomes an admin queue item; admin records an introduction.

### Social account sync — current

Implemented at `/admin/social` and the creator dashboard. This is a current development path, not a later optional add-on.

**Proves:** a creator connects their own social account and the profile shows that network’s follower count and likes.

1. One admin provider per network: Instagram, TikTok, YouTube, X, Facebook, LinkedIn, and Pinterest. Each stays off until its client id and secret are saved. Authorize, token, and profile URLs must stay on that network’s official https host.
2. The integration terms and policy are edited in admin, with a version. Every connection requires the creator to accept the current version. Changing the text requires a new version, and the next sync waits for that agreement.
3. OAuth starts only after that agreement and only when the provider is ready. The callback exchanges the code and reads the profile. Followers and likes are written, and the source becomes `PROVIDER_SYNCED`, only when both numbers are present. A missing field, a disabled provider, or a failed call does not invent a count and does not mark the account live.
4. Public templates are unchanged. Home, Discover, the profile, the Influencer Card, and collaboration keep their current layout. A confirmed sync replaces the follower figure already rendered for that account. Likes are stored with it and shown on the creator’s connection panel.
5. Disconnect stops further sync and clears the synced counts. The page layout stays.

**Exit:** with a network’s API details saved, a creator accepts the terms, returns from that network, and the existing follower figure updates from the returned count and likes. Without those API details, the same pages look as they do today.

### Phase H — Provider platform

Implemented at `/admin/mail`, `/admin/jobs`, and the provider health strip on `/admin`. Checkout writes `User.planTier` through a unique event id. The creator dashboard confirms specialty suggestions; `/collaboration` is unchanged.

**Proves:** spec DoD items 7–12. This is the first time Stripe, email, and AI become real dependencies.

1. **Subscriptions.** `payment_provider`, country route, idempotency key, normalized subscription states (`R081`–`R086`). Stripe adapter creates Checkout and consumes webhooks exactly once (`R107`, scenario 9). Webhook updates `User.planTier` / card entitlement snapshot. Customer Portal can follow.
2. **Notifications.** `notification_template`, SMTP provider, test send (`R089`–`R094`). Wire verification mail and the invitation queue.
3. **AI.** Provider registry, encrypted keys, function map (`R074`–`R078`). Implement `profile_topic_classification` and `collaboration_match_explanation` with the deterministic code as fallback. Suggestions are confirm/edit, never auto-published (`ONB-011`).
4. **Jobs.** Enqueue enrichment, mail, and webhooks. Admin list of failed jobs with retry (`R108`–`R110`).
5. **Health.** Admin strip for payment, email, and AI failures (`R139`).

**Exit:** duplicate Stripe webhooks do not double-apply a plan. Disabling the AI provider leaves profiles and match explanations up. Admin SMTP test send delivers the claim invitation template.

### Phase I — MVP gate

Implemented in `.github/workflows/ci.yml`. `src/lib/mvp-gate.test.ts` runs the section 33 checklist against the shipped code. Claim stages, collaboration states, webhook idempotency, entitlements, and the guest gate are unit-tested. CI lints, runs those tests, diffs migrations against the schema, and rejects the retired brand in `src/`.

Only after that gate does the addendum’s Phase 12.3 (marketplace provider, milestone ledger, escrow-term gating) start. Current `protected-payments` and `trust` code stays prototype until it speaks that ledger.

### Phase 12.3 — Marketplace ledger

Implemented in `src/lib/ledger.ts`, `src/lib/marketplace-ledger.ts`, `/admin/marketplace`, and `/api/marketplace/webhook`. `/payments` and the creator dashboard read this ledger. The Phase 9 JSON store remains the demo console at `/admin/payments`.

**Proves:** a prefund is not marked held without a signed provider event; a duplicate event does not post a second hold; a milestone releases only after approval and only for the amount the provider is holding; the escrow label follows the jurisdiction flag.

1. One marketplace provider, admin-edited, ready only when it is enabled and a webhook secret is saved.
2. Jurisdictions turn protected payments on or off and decide whether the UI may say escrow.
3. Milestone templates are admin shares that must add up to 100%. Each prefund copies those shares and the review window.
4. The fee quote is frozen on the funding row. Later fee-rule edits do not change it.
5. Webhooks are idempotent. Release and refund are ledger entries. The balance is what the provider holds, not an Influrios cash account.

**Exit:** with the provider not ready, requesting a prefund does not create a funded deal. With a signed `funding.held` event, the deal is held once. Approving a milestone does not release it. A signed `payout.released` event releases that milestone once.

### Phase 12.4 — Milestone disputes and cancellation

Implemented in `src/lib/disputes.ts`, `src/lib/milestone-disputes.ts`, `/payments`, the creator dashboard, `/admin/marketplace`, and `/admin/trust`. The Phase 10 JSON trust store stays the demo queue.

**Proves:** an unconfirmed prefund can be cancelled without a ledger hold; an open dispute blocks `payout.released`; asking for a refund does not change the held balance; a signed `payout.refunded` event is what reduces the hold and closes the request.

1. Dispute reasons and the cancel-unconfirmed policy are admin settings. The reason label is copied onto the dispute.
2. A business or the matching creator can open a dispute only after the provider confirms the prefund, and only on a milestone that is not already released or refunded.
3. Ops decisions (`trust.mediate`) are review, allow release, request refund, request partial refund, or withdraw. None of them post cash.
4. `payout.released` is rejected while a dispute on that milestone is open. `payout.refunded` still applies when the amount is within what the provider holds, and it closes a matching refund request.

**Exit:** cancelling `awaiting_provider` leaves zero ledger rows. An open dispute makes a signed release fail. A refund decision leaves the held cents unchanged until `payout.refunded`.

### Phase 12.5 — Attribution and repeat deals

Implemented in `src/lib/attribution.ts`, `src/lib/deal-attribution.ts`, `/payments`, the creator dashboard, and `/admin/marketplace`.

**Proves:** a prefund copies the attribution source in use at request time; a later rename of that source does not rewrite the funding; a repeat is a new unfunded prefund for the same business and creator; the prior fee snapshot and ledger stay put.

1. Attribution sources, the window in days, and the repeat minimum are admin settings. The source label is copied onto the funding.
2. A repeat is allowed only after the provider has confirmed the prior deal, inside the current window, at or above the minimum gross.
3. The new prefund still waits for a signed `funding.held` event. It does not inherit the prior hold.
4. Narrowing the window after a repeat was requested does not clear that repeat link.

**Exit:** with the provider not ready, a repeat request creates no funding row. With the provider ready, the new row is `awaiting_provider`, its attribution label stays after the source is renamed, and the prior fee snapshot is unchanged.

### Phase 12.6 — Staged and recurring funding

Implemented in `src/lib/schedule.ts`, `src/lib/marketplace-ledger.ts`, `/payments`, the creator dashboard, and `/admin/marketplace`.

**Proves:** a staged request creates one unfunded prefund per stage and no ledger rows; a provider hold on one stage does not hold the others; a recurring request creates only the first prefund; the next prefund appears after that hold and the frozen interval, still unfunded.

1. Staged funding, recurring funding, the stage cap, the interval, and the occurrence cap are admin settings.
2. The interval and the occurrence count are copied onto the series. A later interval edit does not move a series already requested.
3. Turning the switches off blocks new schedules. It does not delete a series already opened.
4. Each tranche still waits for its own signed `funding.held` event.

**Exit:** with the provider not ready, a staged request creates no rows. With the provider ready, three stages of a gross add back to that gross and stay `awaiting_provider` until each webhook. A second recurring prefund is not created the day after the hold.

### Phase 12.7 — Admin FX and revenue-share splits

Implemented in `src/lib/fx-share.ts`, `src/lib/settlement.ts`, `src/lib/marketplace-ledger.ts`, `/payments`, the creator dashboard, and `/admin/marketplace`.

**Proves:** a GB prefund stores the converted minor units and a frozen admin rate; a later rate edit does not rewrite that snapshot; `funding.held` must match the converted amount; a signed release writes share lines that sum to the milestone and do not change the held balance; a jurisdiction whose provider is not ready creates no row; a webhook is checked with that provider’s secret.

1. FX rates and revenue parties are admin settings, seeded once. USD needs no rate row. A missing or inactive rate refuses the prefund.
2. The jurisdiction chooses one marketplace provider. The prefund uses that provider. An unknown webhook code is rejected. A known provider that is not ready does not move the ledger.
3. The fee is quoted on the USD amount, then converted with the same admin rate. The ledger amounts are in the jurisdiction currency.
4. Share lines are written only inside a successful `payout.released`. Reconcile ignores them. A funding with no share snapshot still releases.

**Exit:** a 100.00 USD brief for GB at 75 minor units per 1.00 USD is stored as 75.00 GBP. Changing the rate afterward leaves that snapshot at 75. A hold for 100.00 is rejected. The release posts share lines and the held amount drops only by the release.

### Phase 12.8 — Wise user rates

Implemented in `src/lib/wise-fx.ts`, `src/lib/wise-quote.ts`, `src/lib/marketplace-ledger.ts`, `/payments`, and `/admin/marketplace`.

**Proves:** a non-USD prefund calls the Wise quote for the saved profile and freezes that user rate; a later stored minor-unit figure does not rewrite the snapshot; Wise disabled, a failed quote, or an inactive currency creates no funding row; USD does not call Wise.

1. The host is one of `api.wise.com`, `api.wise-sandbox.com`, or `api.transferwise.com`. The API token and profile id are admin settings. The token is encrypted.
2. The quote is `POST /{version}/profiles/{profileId}/quotes` with the USD amount. The `rate` on that quote is the user rate. Wise transfer fees are not added to the prefund.
3. The next recurring occurrence asks Wise again. If that call fails, the occurrence is skipped.
4. Redirects are not followed, so the token is not sent to another host.

**Exit:** with Wise not ready, a GB prefund creates no row. With a user rate of 0.75, 100.00 USD is stored as 75.00 GBP and the snapshot keeps 0.75 after the stored minor units change.

### Phase 12.9 — Limited milestone revisions

Implemented in `src/lib/ledger.ts`, `src/lib/marketplace-ledger.ts`, `/payments`, the creator dashboard, and `/admin/marketplace`.

**Proves:** a submitted milestone can be sent back until the limit copied onto that milestone; a later admin limit does not raise it; an open dispute blocks the request; the ledger is unchanged.

1. The revision limit is an admin setting, seeded at 2. Zero means a submitted milestone cannot be sent back.
2. The limit is copied onto each milestone when the prefund is created. A later edit does not rewrite milestones already saved.
3. A revision applies only to submitted work on a provider-confirmed prefund. It returns the milestone to pending and clears the auto-approve deadline.
4. The request does not post a hold, release, refund, or share line. Approval and release stay on their existing path.

**Exit:** a milestone saved with a limit of 1 accepts one revision and refuses the next after the admin limit is raised. The provider hold is still the only ledger row.

---

## 6. Do not build next

- Another JSON store or another admin page that does not read the configuration kernel.
- Stripe Connect, e-sign, or marking a refund complete without a signed provider webhook.
- M-Pesa or a second live acquirer. The route table is enough.
- Meilisearch, Redis, a separate AI service, or native apps.
- A universal influencer score (`R034`, section 31).
- Scraping infrastructure. Ingestion stays an adapter with a `manual` source (`R035`, `R120`).
- Raster “Influence Connect” cards, fake 50K statistics, or gold styling on non-Pro entitlements.

---

## 7. First coding slice (Phase A + the card seam)

This is the smallest change that makes later phases cheaper.

1. Branch from `main`. Add an initial migration matching `prisma/schema.prisma`, then the entitlement and audit tables.
2. Seed plans from `PLAN_ENTITLEMENTS` and taxonomy from `SPECIALTY_TAXONOMY`.
3. Implement `getEffectiveEntitlements` against the database.
4. Switch `InfluencerCardView` and the “add social / add specialty” checks to that result. Remove plan-name conditionals.
5. Add the Docker `data/` volume and document it so current demos stop vanishing on rebuild while the rest of the stores are migrated.
6. Unit-test the entitlement function.

Touch `src/lib/entitlements.ts`, `src/components/influencer-card-view.tsx`, `prisma/schema.prisma`, `prisma/seed.ts`, `docker-compose.yml`, and a new `src/lib/entitlements-db.ts` (name flexible). Do not rewrite Home or Discover in this slice.

---

## 8. Spec coverage after Phase I

| Section 33 item | Phase |
|---|---|
| 1. CMS logo/menu/hero/sections | B |
| 2. Taxonomy drives search | B |
| 3. Seed profile, review, invite, claim | B + E (+ manual enrichment until H) |
| 4. Creator manages socials, specialties, collab, visibility | C + F |
| 5. Guest policy | D |
| 6. Stable card URL and QR by entitlement | C |
| 7. Admin plan limits enforced | A |
| 8. One payment provider behind a registry | H |
| 9. One AI function behind routing, with fallback | H |
| 10. SMTP via notification service | H |
| 11. Audit log | A, used everywhere after |
| 12. Failed jobs visible and retryable | H |

Design-template fidelity is accepted as **already mostly implemented** and closed inside Phase C, under Influrios branding and entitlement rendering.
