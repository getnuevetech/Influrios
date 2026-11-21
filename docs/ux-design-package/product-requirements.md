# Applied product requirements (Ola §7)

Source: Ola design-package brief (transcript msg 198). Full extraction: `/cursor/stores/self/internal/ola-product-ux-directions-extraction.md`.

| Area | Required correction direction | Evidence posture |
|------|-------------------------------|------------------|
| **Requests** | Clear list; details + editing in **centered popups**; visible lifecycle actions | List captured (`biz-collab`); request editor exists as modal route — **detail/edit popup states not fully evidenced** |
| **Request deletion** | Eligible delete only; accepted participants require explicit **withdraw + reason + notification record** first | **Blocked** — would notify real users / mutate live collabs |
| **Signed or funded work** | Deletion must not erase contracts, payments, history, obligations → cancellation/closure | Partially visible (Closed requests still link “Open collaboration”); closure UX **gap** |
| **Active collaborations** | Consistent list + overview popup (status, participants, next action, milestones, workroom link) | Lists captured (influencer hub, business tabs); overview popup / workroom milestone states **gap** |
| **Influencer public profile** | Full original influencer card, scaled proportionally; no crop/rebuild | Live card `/c/ag-olomola-2` captured; Discover demos are separate presentation cards |
| **Messages** | Conversation list, unread, latest message, collab context, accessible reply | List/inbox state captured; reply flow **gap** |
| **Contracts** | Professional document: clauses, tables, parties, schedules, signatures, headers/footers/pages | List captured; preview/signing/PDF **gap / blocked** for completion actions |
| **Contract integrity** | Fix placeholders / contradictory statuses; preserve executed docs; changes → new version | Needs document-level evidence |
| **Subscription plans** | Monthly + annual wherever prices offered; show annual billed + monthly equivalent | Pricing + billing toggles captured |
| **Comparison** | Detailed compare collapsed; clear “Compare plans” | Captured on public pricing / business billing |
| **Public pricing** | Plan-first; remove unrelated FAQ / impl explanation | Largely plan-first in capture |
| **Tax configuration** | Country + Product/charge; remove duplicate “Applied to” if same | Admin payment settings denser than this model — redesign needed |
| **Tax presentation** | One tax line in breakdowns; base/discount/tax/total consistent preview↔checkout | Checkout totals with discount+tax **blocked/gap** |
| **Tax filing controls** | Remove filing-owner/status from calc setup | Confirm on tax tab (evidence incomplete) |
| **Admin plans & billing** | Separate plan prices/features from subscriptions/invoices/activity | Tabs Plans vs Billing exist; keep distinct |

**Tax coda:** Keep UI simple; do not force a positive tax when calculation is zero/exempt.

## Popup placement (Ola §6)

- Centered popups for list detail/edit
- **Not** under the table
- **Not** a right sidebar substitute
- Title + close; primary/secondary actions; scrollable content; keyboard/focus trap/return; unsaved protection; mobile full-screen when needed; preserve list filters/scroll
- Long docs / complex workrooms → dedicated viewer or full-screen dialog; avoid stacking popups

## Terminology / IA (Ola §5)

- Customer-facing term: **Influencer**
- Separate public nav vs authenticated workspace nav
- Subscription billing ≠ collaboration funds/earnings
- Admin Users ≠ Access Level Management
- Task-based labels; no duplicate destinations; do not remove function just to shorten menus
