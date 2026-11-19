# Journeys (revision r3.3 — non-funding J18/J19/J22 + Partials deepen)

Operator attestation checkboxes are **not** a gate. Local dedicated Postgres + Mailpit + synthetic `@example.com` fixtures execute mutating journeys. **No live money.** J13 product gate left intact (no silent-fix).

| ID | Status | Notes |
|----|--------|-------|
| J01 | Pass | email=audit.r3mrvlgh.signup.mwmst7q8@example.com; mailDelta=1 |
| J02 | Pass | Members + admin reconfirm Pass (harness `.env.local` / `ADMIN_SUPER_PASSWORD`) |
| J03 | Partial | Discover/card + shortlist mutate (`BusinessShortlistItem` AUDIT J03 deepen) — not full discover Pass |
| J04 | Pass | briefs create/send/draft |
| J05 | Pass | apps ACCEPTED |
| J06 | Pass | acceptedOrSignedVisible=true |
| J07 | Pass | pureDraft deleted |
| J08 | Pass | ACCEPTED → WITHDRAWN |
| J09 | Pass | Delete blocked; settlement redirect; contract stays signed |
| J10 | Pass | Contract sent (native) |
| J11 | Pass | business/signed · creator/signed |
| J12 | Pass | Status signed 2/2 |
| J13 | Blocked | Secrets present; product `collaborationCollectionGate` refuses card deposit — **await Ola product decision; do not silent-fix** |
| J14 | Blocked | Depends on funded collaboration (J13) |
| J15 | Blocked | Upstream J13 — funding never `held`; payout not executed |
| J16 | Partial | Checkout `cs_test_` + sandbox UI; hosted card confirm incomplete; related API sub active |
| J17 | Blocked | Retry/failure money paths need funded deal after J13 |
| J18 | Partial | Admin DiscountOffer create/activate (AUDITANN/AUDITEXP) + server `ineligibilityReason`/`discountCents` proven; Checkout Apply UI blocked (Plus/Pro temporarily unavailable) |
| J19 | Pass | Tax rule UI save (US · All subscription plans · 8.25% → `TaxPolicyVersion`); launch approvals mutated earlier |
| J20 | Blocked | Withdrawal mutating path blocked pending payout after J13 |
| J21 | Partial | Business shell + workspace/shortlist entity reconcile; account note path incomplete |
| J22 | Pass | Dual-party contract messages (+2 DB) + Mailpit Δ+2 + unrelated denial; draft `ContractDocument` (not funded) |
| J23 | Pass | Mailpit interception |
| J24 | Partial | Unrelated/admin/limited denial samples; full IDOR matrix still fixture-limited |
| J25 | Partial | Admin accounts phone mutate on synthetic unrelated (DB); UI phone field hidden in view |
| J26 | Partial | Admin plans inventory + detail; no destructive plan rewrite |
| J27 | Partial | Admin jobs + CMS surfaces; durable CMS rewrite not claimed |
| J28 | Partial | Matching opt-in + `ManagedIntro` create (draft) without funding — lifecycle not full Pass |
| J29 | Partial | Independent public visual captures (home/pricing/about + mobile) |
| J30 | Partial | Independent visual/responsive/a11y smoke; full checklist still Partial |
| AGENCY | N/A | Deferred |
