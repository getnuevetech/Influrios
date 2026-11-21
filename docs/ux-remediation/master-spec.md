# Master remediation specification

**Scope today:** Package 1 rules (nav · dashboards · payout readiness · notifications). Expand when packages 2–5 land.  
**Builds on:** [#533 shared-ui-spec](https://github.com/getnuevetech/Influrios/blob/cursor/ux-design-package-e893/docs/ux-design-package/shared-ui-spec.md), [#533 navigation-map](https://github.com/getnuevetech/Influrios/blob/cursor/ux-design-package-e893/docs/ux-design-package/navigation-map.md)  
**Audit feed:** RC-DASHBOARD · INV-DC-* · INV-C-014 · INV-N-004  
**Constraints:** Live deposits closed · Agency deferred · Centered popups mandatory for list detail · Original influencer card unchanged

Tokens (preserve unless Ola changes brand): indigo text `#1B1464`, violet `#6D4AFF`, lavender washes, white surfaces, canvas `#F5F7FB`, rounded controls, display serif for titles.

---

## 1. Single-projection rule (Package 1)

For a given account + session, these surfaces must read the **same** derived values:

| Projection | Surfaces that must agree |
|------------|--------------------------|
| **Open invitations** | Influencer home banner · Invitations stat · Needs attention (invite rows) · Hub Invitations status card · Hub Invitations tab/list · Collaborations sidebar badge (invite portion) |
| **Active collaborations** | Home “Active collaborations” · Hub Active status card · Hub Active tab count |
| **Payout readiness** | Home setup reminder (show **only** when Not ready) · Hub “Payment readiness” · Earnings “Payout Setup” / Receive payments STATUS · Earnings & Payouts sidebar badge |
| **Bell unread** | `aria-label="Notifications, N unread"` · Notification centre Unread rows |
| **Action-required** | Needs attention · Action inbox tasks · Centre “Action required” filter for **live** open tasks (historical kind filters may be larger — must be labeled as such) |

Business role uses the same projection discipline for Collaborations badge ↔ Needs attention / collab destination.

---

## 2. Status labels

| Label | Meaning | Color intent | Where |
|-------|---------|--------------|-------|
| **Ready** | Identity verified + payout account on file; eligible to receive collab payouts | Green wash | Earnings Payout Setup, Receive payments STATUS, Hub Payment readiness |
| **Not ready** | Missing verified payout method (primary or secondary) or identity | Rose / amber | Same surfaces; home shows “Complete payout setup” banner |
| **Pending your response** | Invitee must act (interested / decline / ask / accept if product defines) | Violet / amber | Team or marketplace invitation detail |
| **No further action needed** | Invitee has completed response **or** invitation is not awaiting them | Neutral gray | Invitation detail **only when** respond CTAs are not required |
| Funded / Expecting funding / Payment pending / Match | Existing collab lifecycle vocabulary | Per shared-ui-spec §5 | Home list, hub rows |

**Forbidden pairing:** `Pending your response` + `No further action needed` on the same invitation.  
**Forbidden pairing:** Earnings `Ready` + home “Complete payout setup” + hub `Not ready` + Earnings badge `1`.

---

## 3. Badge semantics

| Badge | Counts | Clears when | Destination must explain |
|-------|--------|-------------|--------------------------|
| **Collaborations** (influencer) | Open invitations + work attention (per `sidebar-badges` contract) | Invite responded / work action completed | Hub Overview shows matching invite + work counts |
| **Earnings & Payouts** | `1` only while **Not ready** AND product rule (active collabs > 0) | Payout becomes Ready (or no active collabs per rule) | Earnings page shows Not ready + blockers; never Ready while badge = 1 |
| **Bell** | Unread notices only | Opening / marking an **Unread** notice (`?open=` or Open) | Centre Unread rows = bell N |
| **Action required** (centre filter) | Notices still needing underlying task | Completing the task (not read alone) | Copy: “Opening marks read; it does not complete the task.” |
| **Messages** | None (out of badge contract) | — | Home “Unread messages” may show count; sidebar stays unbadged unless product changes contract |

Business Collaborations badge = attention scale matching Needs-your-attention / collab destination (AUDIT pass pattern).

Admin: no member badge contract; jobs failure alert surface may use a distinct ops badge (Package 5). Package 1 only requires that any shared chrome count follow “count on the item that opens it.”

---

## 4. Button enablement

| Context | Enabled when | Disabled / hidden when |
|---------|--------------|------------------------|
| Home “Review invitation” | Open invitation exists | Count = 0 |
| Team invite **Interested / Ask a question / Decline** | Status = pending your response | Status already responded, withdrawn, expired, or closed |
| Team invite “No further action needed” copy | Only after response or when not the invitee’s turn | Never while pending your response |
| Earnings “Continue” payout setup | Not ready | Ready (replace with “Update payout account” secondary) |
| Notification popup **Open** | Notice has a destination | — |
| Notification popup does **not** complete action-required | Always | Completing task happens on destination |

Destructive (Decline): rose outline + confirm dialog (centered, stack confirm-on-editor only).

---

## 5. Notifications rules

1. **Unread ≠ action-required** — centre subtitle stays; filters remain separate.  
2. Opening an **Unread** notice (`?open=` or Open → centered popup) marks it **Read** and decreases bell by 1.  
3. Opening an already-Read notice does **not** change the bell.  
4. Completing the underlying invitation/work/payment task clears action-required indicators (home attention, related centre row, Collaborations badge portion) **without** requiring a second open.  
5. List detail for notices uses the **centered popup** pattern (preserve); primary CTA routes to the task destination.  
6. Centre historical kind counts (Invitations 6, Action required 9) may exceed live sidebar badges — label filters as notice kinds, not live attention.

---

## 6. Navigation (authenticated)

### Desktop
- Left sidebar; active = violet wash + left bar  
- Influencer / Business destinations per [#533 navigation-map](https://github.com/getnuevetech/Influrios/blob/cursor/ux-design-package-e893/docs/ux-design-package/navigation-map.md)  
- Agency deferred — hide or “Coming soon”

### Mobile (signed-in) — Package 1
- Horizontal chips for primary destinations **plus** a **More** control that opens a drawer listing **all** sidebar destinations (including Billing & Plan / Collaboration Payments) with the same badges  
- Bell remains reachable in the top utility row  
- Counts must match desktop (no viewport-only divergence)

### Public mobile
- Prior [#533 mobile-public-nav](https://github.com/getnuevetech/Influrios/blob/cursor/ux-design-package-e893/docs/ux-design-package/designs/mobile-public-nav.md) remains valid (hamburger → full menu + Log in + Join)

### Admin
- Package 1: shared projection rules only if a member-like badge appears; otherwise defer chrome redesign to Package 5. Jobs expire/sweep alert stays an ops surface note.

---

## 7. Popups & influencer card (non-negotiable)

- List detail / notification open / invitation review: **centered** modal (desktop); full-screen sheet on mobile when content > ~½ viewport  
- Do not replace with under-table expand or right-rail detail  
- **Original influencer card** on home / profile / public `/c/[slug]`: full card, no crop, no alternate chrome

---

## 8. States (all Package 1 surfaces)

| State | Spec |
|-------|------|
| Loading | Skeleton for stats + list regions; `aria-busy`; badges show last-known or suppress until ready (no flash of wrong count) |
| Empty | Honest copy (“No invitations are waiting”) **only when** projection = 0; one CTA |
| Error | Inline banner; Retry; preserve prior counts where possible |
| Success | Toast/banner after respond / mark-read; lists refresh to agreed projection |
| Retry | Visible Retry on failed load of home/hub/earnings/notifications |
| Permission | Signed-out → login; wrong role → role home; no silent empty |

---

## 9. Acceptance anchors (Package 1 → implementation)

| ID | Pass when |
|----|-----------|
| DB1 | Home invite count = hub Invitations; Collaborations badge ≥ invites and explained |
| DB2 | Earnings Ready ⇔ hub Ready ⇔ no “Complete payout setup” ⇔ Earnings badge 0 (when rule says so); INV-C-014 / INV-N-004 conditional |
| DB3 | Home Active = hub Active |
| DB4 | Pending team invite shows respond CTAs; after respond, attention + counts clear; hub agrees |
| DB5 | Open Unread decreases bell; action-required unchanged by read alone |
| DB6 | Refresh + re-login keep agreed counts |
| MOB1 | Mobile More drawer exposes all destinations + badges matching desktop |

---

## 10. Expansion hooks (later packages)

- **Pkg2:** Request/active overview popup field schemas, withdraw/delete gates  
- **Pkg3:** Money/tax/discount line rules, annual unavailable gate  
- **Pkg4:** Contract viewer, message reply a11y, card public presentation  
- **Pkg5:** Admin permissions, job failure recovery UI

Do not invent commercial prices in designs. Do not reopen live deposits in design or acceptance.
