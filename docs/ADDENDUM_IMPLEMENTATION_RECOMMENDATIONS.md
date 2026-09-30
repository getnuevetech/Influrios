# Addendum Implementation Recommendations

Reviewed:
- `Influrios_Development_Addendum_v1` — Collaboration Commission & Protected Payment Engine (v1.1)
- `Influrios_Product_Addendum_v1` — Collaboration Monetization & Protected Payments (v1.1)

These documents extend Product Strategy / Dev Spec v2.2. They should be treated as **mandatory** for paid-collaboration work. Where they conflict with earlier phase notes on escrow naming or hard-coded fees, the addenda win.

---

## Executive recommendation

Add a dedicated **Phase 12 — Collaboration Transaction Engine** to the execution plan (after Agency / Trust / Payments foundations already shipped). Do **not** bolt fee % or “escrow” labels into existing Phase 9 protected-payments demos without the rule engine + jurisdiction gates described below.

Also schedule a **parallel Homepage Content Pass (Phase 12a / P0 content)** for the mandatory Value Proposition Strip (Dev §23 / Product §21), which is launch-blocking copy/UI work independent of payments.

---

## Map addenda → plan phases

| Addendum theme | Priority | Suggested plan slot | Depends on |
|---|---|---|---|
| Fee rules engine + immutable fee snapshots (never hard-code %) | P0 | Phase 12.1 | Admin config store, RBAC |
| Collaboration commercial snapshot on accept | P0 | Phase 12.1 | Collaboration entity model |
| Jurisdiction / provider capability matrix + “escrow” term gate | P0 | Phase 12.2 | Country config (v2.2) |
| Prefunding via one approved marketplace provider | P1 | Phase 12.3 | Payment adapter, webhooks |
| Milestone workflow (submit / review / auto-approve / release) | P1 | Phase 12.3 | Ledger abstractions |
| Ledger + idempotent webhooks / reconciliation | P1 | Phase 12.3 | Provider adapter |
| Disputes (milestone-scoped) + cancellation/refund engine | P2 | Phase 12.4 | Trust module (Phase 10) |
| Admin: commission matrix simulator, provider health, collab ops | P2 | Phase 12.4 | Admin sidebar / RBAC |
| Attribution / repeat deals | P3 | Phase 12.5 | Snapshot + ledger |
| Staged/recurring funding, multi-provider, revenue share | P3–P4 | Later | Stable ledger |
| Homepage Value Proposition Strip (CMS-managed, replace placeholder stats) | P0 content | Phase 12a (can ship now) | CMS banners model |

---

## Non-negotiables to encode in the plan (PA001–PA007)

1. **No hard-coded** fee %, fixed charges, review windows, milestone templates, attribution periods, or funding thresholds — all admin-versioned.
2. Accepted collaborations are an **immutable commercial snapshot** + mutable operational state.
3. Protected funds stay in **provider architecture**, not Influrios operating balance.
4. Do **not** label UI/contracts “escrow” unless jurisdiction/provider config allows the term.
5. Webhooks & release/refund ops must be **idempotent, auditable, ledger-backed**.
6. Later admin rule changes must **not recalculate** accepted deals without a documented amendment.
7. **Jurisdiction flags override** feature availability even if code supports the feature.

---

## Product MVP scope to adopt (Product §18)

Ship first:
1. Fee engine + admin matrix + immutable snapshots  
2. One approved provider + full prefunding in launch jurisdiction  
3. Milestone templates, submission, approval, limited revisions, auto-approval, payout, partial refund  
4. Dispute create + evidence + admin decision (milestone-level)  
5. Jurisdiction activation controls before more providers/managed modes  

Defer: staged/recurring funding, advanced change orders, revenue-sharing splits.

---

## Homepage / marketing impact (Dev §23 + Product §21)

**Immediate plan update:** replace footer/homepage placeholder statistics (50K+ / 100+ / etc.) with a CMS-managed **HomepageValuePropositionStrip** (four pillars: Influrios Card, Influence Intelligence, Collaboration Network, Protected Payments — copy from addendum). Admin must enable/reorder/edit items. Keep SocialProofStats only for *verified* metrics later.

This is orthogonal to the payment engine and should not wait for Phase 12.3.

---

## Admin portal expansion (Dev §19)

Extend the new admin sidebar with modules (when Phase 12 starts):
- Commission / Fee Rules (CRUD, versioning, simulator)
- Jurisdiction Matrix
- Provider Health
- Collaboration Operations (funding, milestones, payouts, disputes)
- Financial Reports
- Risk Controls  

Reuse existing RBAC (`admin/access`) with new permissions; require step-up auth for high-risk actions.

---

## Relationship to current codebase

- Phase 9 `protected-payments` and Phase 10 `trust` are useful **prototypes** but do not yet satisfy the addendum’s fee matrix, immutable snapshots, provider adapter contract, or escrow-term gating.
- Treat those modules as the seed for Phase 12 refactor rather than production compliance.
- Subscription billing (Phase 6) stays separate from collaboration transaction fees (Product §2 revenue layers).

---

## Suggested execution-plan wording (drop-in)

> **Phase 12 — Collaboration Transaction Engine (Addenda v1.1)**  
> Implement configurable collaboration fees, immutable commercial snapshots, jurisdiction/provider gates, milestone funding/release, ledger + webhooks, and milestone disputes — per Development & Product Addenda v1.1. No hard-coded commercial constants.  
> **Phase 12a — Homepage Value Proposition Strip**  
> Replace placeholder homepage stats with CMS-managed value pillars per Dev Spec addendum §23 / Product §21.

---

## Acceptance gate before calling “protected payments” complete

Use Dev §22 tests (fee simulator, snapshot immutability, funding webhook, milestone auto-approve, duplicate webhook, jurisdiction disable, escrow-term false, ledger reconcile) as the Definition of Done for Phase 12 — not UI demos alone.
