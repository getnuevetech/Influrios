# Package 1 — Shared navigation, dashboards, payout readiness, invitations, notifications

**Status:** Corrected after Ola review, round-2 targeted review and round-3 consistency fixes (2026-11-21). Design only, not implemented. Not approved as a whole; re-submitted for review.
**Root cause:** RC-DASHBOARD · **Tracker:** IPS-35 (parent IPS-34)
**Master rules:** [../master-spec.md](../master-spec.md) · **Flows:** [flows.md](./flows.md) · **Backlog:** [backlog.md](./backlog.md)
**Boards:** [designs/](./designs/) · **PNGs:** [`media/ux-remediation/package-01/`](../../../media/ux-remediation/package-01/)
**Audit evidence (before):** [#539](https://github.com/getnuevetech/Influrios/pull/539)

Constraints: live deposits closed · Agency deferred · centered popups · original influencer card · no product code.

---

## Finding-to-file checklist

| # | Finding | Correction | HTML | PNG (desktop / mobile) | Spec / flow / acceptance |
|---|---------|-----------|------|------------------------|--------------------------|
| 1 | Original influencer card | Live card component (captured), proportional, uncropped, all content on mobile; placeholder card + CSS removed | [influencer-home](./designs/influencer-home.html) | [desktop](../../../media/ux-remediation/package-01/influencer-home-desktop.png) · [mobile](../../../media/ux-remediation/package-01/influencer-home-mobile.png) · asset [card](./designs/assets/influencer-card-original.png) | master-spec §8 · CARD1 |
| 2 | Internal notes inside customer UI | All notes moved to panels outside frames; “setup reminder hidden”, “badge = 0”, “same counts as desktop” and similar removed; real customer copy throughout | All boards (shared [`_build/chrome.py`](./designs/_build/chrome.py) separates `app()` from `notes()`) | every `*-desktop.png` / `*-mobile.png` | master-spec §0 annotation rule · VIS1 |
| 3 | Payout readiness states | Six states with message, CTA, home, hub and badge each; saved account ≠ Ready; pending never re-asks finished steps | [earnings-payout](./designs/earnings-payout.html) · [influencer-home](./designs/influencer-home.html) · [collaborations-hub](./designs/collaborations-hub.html) · [sidebar-badges](./designs/sidebar-badges.html) · [states](./designs/states.html) | [desktop (pending)](../../../media/ux-remediation/package-01/earnings-payout-desktop.png) · [mobile (action required)](../../../media/ux-remediation/package-01/earnings-payout-mobile.png) · [all six](../../../media/ux-remediation/package-01/earnings-payout.png) | master-spec §2.1, §3 · flows §B · DB2, DB2a–c |
| 4 | Invitation transitions | Pending, question sent, interested, accepted, declined, expired, withdrawn + team; product semantics; clear rules; failure, retry, concurrent withdrawal | [team-invite-respond](./designs/team-invite-respond.html) · [collaborations-hub](./designs/collaborations-hub.html) · [notifications](./designs/notifications.html) · [influencer-home](./designs/influencer-home.html) | [desktop](../../../media/ux-remediation/package-01/team-invite-respond-desktop.png) · [mobile](../../../media/ux-remediation/package-01/team-invite-respond-mobile.png) · [all states](../../../media/ux-remediation/package-01/team-invite-respond.png) · [notifications desktop](../../../media/ux-remediation/package-01/notifications-desktop.png) / [mobile](../../../media/ux-remediation/package-01/notifications-mobile.png) | master-spec §2.2, §4, §5 · flows §A, §D, §E · DB1, DB4, DB4a–b, DB5 |
| 5 | Complete business dashboard | Full desktop + mobile dashboard, opened popup + sheet, empty/loading/error; replaces `business-chrome` | [business-dashboard](./designs/business-dashboard.html) · [mobile-auth-nav](./designs/mobile-auth-nav.html) | [desktop](../../../media/ux-remediation/package-01/business-dashboard-desktop.png) · [mobile](../../../media/ux-remediation/package-01/business-dashboard-mobile.png) · [desktop popup](../../../media/ux-remediation/package-01/business-dashboard-desktop-popup.png) · [mobile sheet](../../../media/ux-remediation/package-01/business-dashboard-mobile-popup.png) · [nav](../../../media/ux-remediation/package-01/mobile-auth-nav-mobile-business.png) | flows §G · DB7 |
| 6 | Shared visual consistency | Serif rule removed; Plus Jakarta Sans + Sora, live tokens, `icons.tsx` icons, live shell, controls and dialog | [_design-system.css](./designs/_design-system.css) · [assets/](./designs/assets/) · all boards | all PNGs | master-spec §0 · VIS1 |
| + | Inbox dedupe (from #533) | Task identity rule; distinct tasks preserved | [action-inbox](./designs/action-inbox.html) | [desktop](../../../media/ux-remediation/package-01/action-inbox-desktop.png) · [mobile](../../../media/ux-remediation/package-01/action-inbox-mobile.png) | master-spec §7 · flows §H · INB1 |
| + | Terminology (from #533) | “Discover Influencers”; no customer-facing “Creator” | [business-dashboard](./designs/business-dashboard.html) · [mobile-auth-nav](./designs/mobile-auth-nav.html) · [sidebar-badges](./designs/sidebar-badges.html) | as above | master-spec §6 · TERM1 |

### Round 2 follow-ups (Ola targeted review, 2026-11-21)

| # | Issue | Correction | Board / PNG | Spec · flow · acceptance |
|---|-------|-----------|-------------|--------------------------|
| R2-1 | Mobile nav clipped More | Fixed four-slot nav bar (3 destinations + More); no horizontal scroll | all `*-mobile*.png`, e.g. [business mobile](../../../media/ux-remediation/package-01/business-dashboard-mobile.png) · [mobile-auth-nav](../../../media/ux-remediation/package-01/mobile-auth-nav.png) | master-spec §6 · flows §F · MOB1 |
| R2-2 | Dead end after asking a question | “{Business} replied” state returns the invitee's turn with I'm interested · Ask another question · Decline; code gap logged as **defect P1-D1** | [team-invite-respond](../../../media/ux-remediation/package-01/team-invite-respond.png) | master-spec §2.2, §4 · flows §D1 · DB4a · backlog P1-D1 |
| R2-3 | Failure copy promised “Nothing changed” | “We couldn't confirm your response” → status re-read → saved state or safe retry; idempotency key | [team-invite-respond](../../../media/ux-remediation/package-01/team-invite-respond.png) | master-spec §4.1 · flows §D3 · DB4b |
| R2-4 | Completion cleared “every merged notice” | Clears action-required only; notices stay in history; read state unchanged; unrelated notices untouched | [action-inbox](../../../media/ux-remediation/package-01/action-inbox.png) · [notifications](../../../media/ux-remediation/package-01/notifications.png) | master-spec §5.3a, §7 · flows §H · INB1 |
| R2-5 | Unsupported payout promises | Removed “1–2 business days” and “We'll email you” (payout) and “We'll notify you” (invitation) | [earnings-payout](../../../media/ux-remediation/package-01/earnings-payout.png) | master-spec §2.1 copy rule · DB2b |
| R2-6 | No payout history undefined | “Status unavailable”, never infer Ready/Setup required; no home message; badge 0 | [earnings-payout](../../../media/ux-remediation/package-01/earnings-payout.png) (7th panel) | master-spec §2.1 · flows §B · DB2d |
| — | Ledger reference | Approved mockup committed; figures illustrative only | [package-05/reference](../package-05/reference/README.md) | master-spec §12 |

### Round 3 consistency checklist (Ola, 2026-11-21)

Each rule is defined once and every place that applies it was checked against that definition.

| # | Rule | Defined in | Applied in (checked) | Acceptance |
|---|------|-----------|----------------------|------------|
| C1 | *Waiting for your reply* = open, not expired, **turn = invitee** (new, business replied, team invited) | master-spec §1 | master-spec §2.2, §3, §4 · flows §A, §D1 · boards: influencer-home notes, collaborations-hub, team-invite-respond, sidebar-badges · backlog P1-T1 | DB1 |
| C2 | Turn is persisted and changes only on actions; **reading never changes it** | master-spec §2.2a | master-spec §1, §2.2, §4 · flows §A, §D1 (reads row) · team-invite-respond notes · backlog P1-D1 | DB4a, DB4c |
| C3 | No blanket “nothing changed” after a write | master-spec §4.1, §9 | flows §D3, §K · team-invite-respond · states (earnings error copy now “Try again to see your latest balances”) | DB4b |
| C4 | Timeout recovery via **idempotency record**: saved / rejected / processing / unable to confirm; draft kept; same key | master-spec §4.1 | flows §D3 · team-invite-respond (4 outcome panels) · backlog P1-T5 | DB4b |
| C5 | Empty earnings ≠ setup incomplete; readiness shown independently | master-spec §9 (Empty) | flows §K · states (new “Empty · earnings on a Ready account” panel) · backlog P1-T2 | DB2e |

Search check: “unread business answer”, “Setup required card” and in-UI “Nothing changed” / “wasn't saved” no longer appear. Remaining mentions of “nothing changed” are the prohibitions themselves.

---

## Defect → design → acceptance

| Defect | Board | Impl task | Acceptance |
|--------|-------|-----------|------------|
| INV-DC-001 invite counts | influencer-home · collaborations-hub · sidebar-badges | P1-T1 | DB1 |
| INV-DC-002 · INV-C-014 · INV-N-004 payout readiness | earnings-payout (+ home, hub) | P1-T2 | DB2, DB2a–c |
| INV-DC-006 active count | influencer-home · collaborations-hub | P1-T3 | DB3 |
| INV-DC-015 · INV-DC-012 invitation dead-end / clearing | team-invite-respond · notifications | P1-T4, P1-T5 | DB4, DB4a–b |
| INV-DC-020 · INV-DC-005 (Pass, preserve) | notifications | P1-T6 | DB5 |
| INV-DC-030–033 stability (Pass, preserve) | flows §J | P1-T7 | DB6 |
| MEMBER-MOBILE-NAV | mobile-auth-nav | P1-T8 | MOB1 |
| Business dashboard (finding 5) | business-dashboard | P1-T9 | DB7 |
| INBOX-DUP-001 (#533) | action-inbox | P1-T12 | INB1 |
| TERM-CREATOR-001 (#533) | business-dashboard · mobile-auth-nav | P1-T13 | TERM1 |
| Original card · visual system | influencer-home · all | P1-T14, P1-T15 | CARD1, VIS1 |
| Admin (light) | admin-shared-note | defer to Pkg 5 | count-on-opener |

---

## Boards

| Board | HTML | PNGs |
|-------|------|------|
| Influencer home | [influencer-home.html](./designs/influencer-home.html) | full · desktop · mobile |
| Collaborations hub | [collaborations-hub.html](./designs/collaborations-hub.html) | full · desktop · mobile |
| Payout readiness (6 states) | [earnings-payout.html](./designs/earnings-payout.html) | full · desktop · mobile |
| Invitations — respond and transitions | [team-invite-respond.html](./designs/team-invite-respond.html) | full · desktop · mobile |
| Notifications | [notifications.html](./designs/notifications.html) | full · desktop · mobile |
| Business dashboard | [business-dashboard.html](./designs/business-dashboard.html) | full · desktop · mobile · desktop-popup · mobile-popup |
| Action inbox | [action-inbox.html](./designs/action-inbox.html) | full · desktop · mobile |
| Sidebar badges | [sidebar-badges.html](./designs/sidebar-badges.html) | full |
| Mobile navigation | [mobile-auth-nav.html](./designs/mobile-auth-nav.html) | full · mobile · mobile-business |
| Shared states | [states.html](./designs/states.html) | full · mobile |
| Admin shared note | [admin-shared-note.html](./designs/admin-shared-note.html) | full · desktop |

PNG names: `media/ux-remediation/package-01/{board}.png` (full board), `{board}-desktop.png`, `{board}-mobile.png`, plus extra frames as listed. Rebuild: `python3 designs/_build/build.py`, then `node designs/_build/render.js designs ../../../media/ux-remediation/package-01` (Playwright, 2x).

**Removed:** `business-chrome.html` / `.png` (partial example; replaced by business-dashboard).

---

## Out of scope for Package 1

Implementation · live deposits · Agency · Package 2 popup field schemas (design prep only) · billing (Pkg 3) · contract viewer / messages (Pkg 4) · admin depth, ledger, reconciliation (Pkg 5, master-spec §12).
