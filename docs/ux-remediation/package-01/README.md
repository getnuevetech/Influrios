# Package 1 — Shared navigation, dashboards, payout readiness, notifications

**Status:** Visual remediation ready for **Ola review** (design only — not implemented)  
**Root cause:** RC-DASHBOARD  
**Tracker:** IPS-35 · parent IPS-34  
**Master rules:** [../master-spec.md](../master-spec.md)  
**Flows:** [flows.md](./flows.md) · **Backlog:** [backlog.md](./backlog.md)  
**Boards:** [designs/](./designs/) · **PNG media:** [`../../../media/ux-remediation/package-01/`](../../../media/ux-remediation/package-01/)  
**Audit evidence (before):** [#539](https://github.com/getnuevetech/Influrios/pull/539) — RC-DASHBOARD / dashboard-consistency (separate audit PR; not bundled here)

Constraints honored: live deposits closed · Agency deferred · centered popups preserved · original influencer card preserved · no product code.

---

## Defect → design → impl task → acceptance

| Defect ID | Observed (AUDIT) | Design board | Impl task | Acceptance |
|-----------|------------------|--------------|-----------|------------|
| **INV-DC-001** | Home Invitations **1** / banner / attention vs hub Invitations **0** + “No invitations are waiting”; Collaborations badge **1** | [influencer-home](./designs/influencer-home.html) · [collaborations-hub](./designs/collaborations-hub.html) · [sidebar-badges](./designs/sidebar-badges.html) | P1-T1 Single open-invitation projection | **DB1** |
| **INV-DC-002** | Home “Complete payout setup” + hub **Not ready** vs earnings **Ready** + Earnings badge **1** | [earnings-payout](./designs/earnings-payout.html) · home/hub boards (Ready path) | P1-T2 Single payout-readiness projection | **DB2** |
| **INV-C-014** | Setup reminder cues alone ≠ conditional vs Ready | Same Ready path + [states](./designs/states.html) | P1-T2 | **DB2** + reminder only when Not ready |
| **INV-N-004** | Setup reminders conditional unproven (paired) | Same | P1-T2 | **DB2** |
| **INV-DC-006** | Home Active **3** vs hub Active **2** | home + hub boards | P1-T3 Single active-membership filter | **DB3** |
| **INV-DC-015** | Team invite: Pending your response + “No further action needed” + no CTAs | [team-invite-respond](./designs/team-invite-respond.html) | P1-T4 Team invite respond gating | **DB4** |
| **INV-DC-012** | Action-required cannot clear (dead-end destination) | team-invite + [flows](./flows.md) § Respond | P1-T4 + P1-T5 clear attention after respond | **DB4** |
| **INV-DC-020** (Pass — preserve) | Open Unread clears bell; read ≠ action complete | [notifications](./designs/notifications.html) | P1-T6 regression | **DB5** |
| **INV-DC-005** (Pass — preserve) | Unread ≠ action-required copy/filters | notifications | P1-T6 | **DB5** |
| **INV-DC-030/031** (Pass) | Refresh / re-login badge stability | flows § Stability | P1-T7 | **DB6** |
| **MOBILE-NAV** (signed-in) | Chip scroller hides destinations / badges | [mobile-auth-nav](./designs/mobile-auth-nav.html) | P1-T8 More drawer | **MOB1** |
| Business chrome | Collaborations badge **2** stable (contrast Pass) | [business-chrome](./designs/business-chrome.html) | P1-T9 keep projection discipline | Regression vs AUDIT Pass |
| Admin | Shared chrome overlap light | [admin-shared-note](./designs/admin-shared-note.html) | Defer depth to pkg5 | Jobs alert = count on opener |

---

## Visual boards index

| Board | Desktop | Mobile | Popup / list |
|-------|---------|--------|--------------|
| Influencer home (aligned Ready + 1 invite) | [HTML](./designs/influencer-home.html) · [PNG](../../../media/ux-remediation/package-01/influencer-home-desktop.png) | [PNG](../../../media/ux-remediation/package-01/influencer-home-mobile.png) | — · original influencer card |
| Collaborations hub (same counts) | [HTML](./designs/collaborations-hub.html) · [PNG](../../../media/ux-remediation/package-01/collaborations-hub-desktop.png) | [PNG](../../../media/ux-remediation/package-01/collaborations-hub-mobile.png) | — |
| Earnings / payout readiness | [HTML](./designs/earnings-payout.html) · [PNG](../../../media/ux-remediation/package-01/earnings-payout-desktop.png) | [PNG](../../../media/ux-remediation/package-01/earnings-payout-mobile.png) | — |
| Notifications centre + open | [HTML](./designs/notifications.html) · [PNG](../../../media/ux-remediation/package-01/notifications-desktop.png) | [PNG](../../../media/ux-remediation/package-01/notifications-mobile.png) | Centered open popup |
| Team invite respond | [HTML](./designs/team-invite-respond.html) · [PNG](../../../media/ux-remediation/package-01/team-invite-respond.png) | included | Respond CTAs (not dead-end) |
| Sidebar badge semantics | [HTML](./designs/sidebar-badges.html) · [PNG](../../../media/ux-remediation/package-01/sidebar-badges.png) | — | Legend board |
| Mobile authenticated nav | [HTML](./designs/mobile-auth-nav.html) · [PNG](../../../media/ux-remediation/package-01/mobile-auth-nav.png) | primary | More drawer open |
| Business shared chrome | [HTML](./designs/business-chrome.html) · [PNG](../../../media/ux-remediation/package-01/business-chrome.png) | strip | Badge ↔ attention |
| States (loading / empty / error / success / retry / permission) | [HTML](./designs/states.html) · [PNG](../../../media/ux-remediation/package-01/states.png) | — | — |
| Admin shared-chrome note | [HTML](./designs/admin-shared-note.html) · [PNG](../../../media/ux-remediation/package-01/admin-shared-note.png) | — | Light |

**Scenario used on remediated boards:** Payout **Ready** · Open invitations **1** (Free Tech Support) · Active **2** · Collaborations badge **1** · Earnings badge **0** · Bell unread as labeled. Same numbers on home, hub, earnings, sidebar.

---

## Before vs proposed (summary)

| Surface | Before (evidence) | Proposed |
|---------|-------------------|----------|
| Hub Invitations | 0 / empty copy | **1** · lists Free Tech Support |
| Payment readiness | Not ready | **Ready** (matches earnings) |
| Home setup banner | Shown | **Hidden** while Ready |
| Earnings badge | 1 | **0** |
| Active | 3 vs 2 | **2** both |
| Team invite | Dead-end copy | Respond CTAs · clear after action |

---

## Out of scope for Package 1

- Product implementation / PRs  
- Live deposit, withdraw, fund, refund  
- Agency role  
- Collaboration list→popup field redesign (Package 2)  
- Billing annual / portal / invoices (Package 3)  
- Contract viewer / messages / card redesign (Package 4 — card **preserved**, not redesigned)  
- Admin job recovery depth (Package 5)
