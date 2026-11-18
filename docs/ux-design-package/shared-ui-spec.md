# Shared UI specification

Target system for the coordinated redesign. Builds on existing patterns (`AccountDialog`, admin dialogs, member chips) without implementing UI in this phase.

Tokens (current product — preserve unless Ola changes brand): indigo text, violet accent `#6D4AFF`, lavender washes, white surfaces, `#F5F7FB` app canvas, rounded-xl controls, `font-display` for titles.

---

## 1. Page header

| Element | Spec |
|---------|------|
| Title | One H1; task language |
| Subtitle | One short sentence max |
| Primary action | Single solid violet button, top-right (e.g. + New request) |
| Secondary | Outline / text buttons only |
| Meta | Sparse (e.g. “Funded to date”) — never compete with H1 |

---

## 2. Navigation & mobile menus

### Public marketing

- Desktop: text links + Log in + Join
- Mobile: **hamburger** → full-screen or sheet menu with same links + Log in + Join
- Focus trap in open menu; Esc/close returns focus to button
- `aria-expanded` / `aria-controls` on menu button

### Authenticated member

- Desktop: left sidebar, active item with violet wash + left bar
- Mobile: either (a) improved horizontal chips + “More”, or (b) drawer from menu button — **must** expose all destinations including Billing vs Collaboration Payments
- Badges: attention counts; document if badge ≠ “active” count

### Admin

- Desktop: ops sidebar groups; **no marketing nav** in proposed chrome
- Mobile: sidebar drawer; top bar search optional collapse

---

## 3. Search, filters, tabs, pagination

| Control | Spec |
|---------|------|
| Search | Rounded field; Apply explicit or debounce 300ms — be consistent per surface |
| Filter pills | One selected solid; others outline; include All |
| Tabs | Underline active; counts in parentheses when helpful (`Active (2)`) |
| Pagination | “1–n of N” + page control; preserve filters on page change |
| Empty filter result | Dedicated empty copy + Clear filters |

---

## 4. Tables & mobile list cards

### Desktop table

- Columns: primary entity, status badge, key meta, actions
- Row primary action: **View** opens centered detail popup (lists governed by §7)
- Overflow: `⋯` menu for secondary lifecycle actions
- Do **not** expand detail under the table
- Do **not** use a persistent right sidebar as the detail pane for requests/active collabs

### Mobile

- Stack as cards: title, status, one meta line, primary button
- Same popup system as desktop

---

## 5. Status badges

| Kind | Examples | Color intent |
|------|----------|--------------|
| Positive | Open, Fully signed, Funded | Green wash |
| Neutral | Draft, Invite only, Expecting funding | Gray / lavender |
| Warning | Payment pending, ATTENTION | Amber |
| Danger | Closed, Delivery due, Blocked | Rose |
| Brand | Active tab/selection | Violet |

Copy must match lifecycle vocabulary across inbox, lists, and popups.

---

## 6. Forms

- Labels above fields; required marker
- Inline validation on submit (pattern already on login/signup/propose)
- Primary submit always visible (sticky footer in popups)
- Destructive actions never primary-colored violet — use rose outline + confirm

---

## 7. Empty / loading / error / success

| State | Spec |
|-------|------|
| Empty | Illustration optional; one sentence; one CTA |
| Loading | Skeleton rows or aria-busy on region — avoid blank flash |
| Error | Banner inside popup/page; keep user data |
| Success | Toast or inline banner; popup may close returning to list with filter intact |

---

## 8. Confirmations

Use centered confirm dialog (stacking allowed **only** confirm-on-top-of-editor, then dismiss confirm first):

- Withdraw participant: required reason; states notification will be recorded
- Delete request: only if eligible; else route to cancel/close
- Cancel signed/funded: explicit cancellation — never silent delete

---

## 9. Money, %, dates, time zones

| Rule | Spec |
|------|------|
| Money | Currency code + amount; do not invent prices in designs — use labeled examples from staging captures (e.g. plan cards already shown) |
| Tax | **One** tax line in breakdown; allow $0 / Exempt |
| Discount | Own line above tax |
| Total | Emphasized once |
| Dates | ISO or localized consistently; show timezone when deadlines matter |
| Annual plans | Show billed annual amount **and** monthly equivalent |

---

## 10. Notifications & action counts

| Surface | Role |
|---------|------|
| Action inbox | **Tasks** that complete when action done |
| Notification bell / rail | **Alerts**; opening does not complete (keep honest copy) |
| Sidebar badges | Attention aggregates; tooltip or aria-label explaining meaning |

Avoid duplicating the same row three times (INBOX-DUP-001).

---

## 11. Centered popups (mandatory for list detail/edit)

### Geometry

- Desktop: centered modal, max-width ~640px (standard) / ~920px (wide), max-height ~90vh, rounded ~28px, dimmed backdrop
- Mobile: **full-screen** sheet when content exceeds ~half viewport
- Existing reference: `/workspace/src/components/account-dialog.tsx`

### Behavior checklist

- [ ] Clear title (+ optional subtitle)
- [ ] Close control (X) + backdrop + Esc
- [ ] Visible primary & secondary actions (sticky footer if scroll)
- [ ] Scrollable body; actions remain accessible
- [ ] Focus trap; restore focus to invoking control
- [ ] `aria-modal="true"` + labelled title
- [ ] Unsaved-change protection when dirty
- [ ] Preserve underlying list filters & scroll on close
- [ ] No under-table expansion
- [ ] No right-sidebar substitute for approved popup
- [ ] Avoid stacking multiple content popups (confirm-only exception)

### When **not** to use a small popup

- Contract document / PDF → full-screen viewer
- Milestone workroom → dedicated route
- Multi-step payment checkout → dedicated flow (sandbox)

---

## 12. Influencer card presentation

- Public profile / Discover live view: show **full original card**, scaled proportionally
- Do not crop QR, social row, or CTAs
- Do not rebuild a different card chrome for “web preview”
- Demo directory cards may differ but must stay labeled Demo

---

## 13. Subscription & pricing surfaces

- Plan cards first; Compare features collapsed behind button
- Monthly | Annual toggle everywhere prices appear
- Strip FAQ / implementation prose from public pricing
- Member billing page: subscription only + link out to Collaboration Payments

---

## 14. Admin tax configuration (simplified)

```
Country → Product/charge → rate/rules preview
```

- Remove duplicate “Applied to” if synonymous
- Filing-owner/status **out** of calc setup
- Preview breakdown: Base · Discount · Tax · Total
