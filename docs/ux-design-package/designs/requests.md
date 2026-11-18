# Design — Business requests

**Objective:** Manage collaboration requests with clear list + centered detail/edit.  
**Primary action:** + New request  
**Data source:** Business workspace briefs / marketplace requests (staging examples: Fashion to Tech…, 4th Test Campaign…)  
**After action:** Return to filtered list; scroll/filters preserved  
**Roles:** Business owner/admin seat  
**Evidence today:** `/cursor/stores/self/media/visual-audit/screenshots/business/desktop/biz-collab.png`

---

## 1. Desktop list (default)

```
┌ Sidebar … Collaborations ─────────────────────────────┐
│ Funded to date [label from account]                    │
│ Collaborations                        [+ New request]  │
│ [Requests] Opportunities  Active Collaborations        │
│ [All] Open Drafts Published Invite only Closed         │
│ [Search requests……………………]                              │
│ ┌ Request │ Status │ Visibility │ Responses │ Updated │ Actions ┐
│ │ Fashion…│ Open   │ Public     │ No invites│ date    │ View ⋯ │
│ │ 4th Test│ Closed │ Public     │ 3 inv·1 ok│ date    │ View Open collab ⋯ │
│ └──────────────────────────────────────────────────────┘
└────────────────────────────────────────────────────────┘
```

- **View** → centered detail popup  
- **⋯** → Edit (if eligible), Close, Withdraw participants…, Delete (if eligible), Open collaboration (if signed/funded)

---

## 2. Detail popup (desktop)

```
            ╔══════════════════════════════════════╗
            ║ Request · Fashion to Tech…        ✕ ║
            ║ Status: Open · Visibility: Public    ║
            ║──────────────────────────────────────║
            ║ Summary · Budget label · Dates       ║
            ║ Participants / invitations table     ║
            ║ Lifecycle: Publish · Invite · Close  ║
            ║──────────────────────────────────────║
            ║ [Edit]              [Close request]  ║
            ╚══════════════════════════════════════╝
```

- Wide dialog OK  
- If signed/funded history exists: show banner “Contracts & payments are retained — use Cancel/Close collaboration”

---

## 3. Edit popup

Same shell; form fields for brief content; sticky **Save draft** / **Publish** / **Send invites**  
Unsaved guard on ✕/Esc  
Locked fields when `campaignEditLocked` (existing product rule)

---

## 4. Mobile

Full-screen popup; list as cards with Status + View  
Menu ⋯ → action sheet

---

## 5. Empty / error

- Empty: “No requests yet” + + New request  
- Error: inline banner in popup; list unchanged

---

## 6. Withdraw & delete confirmations

**Withdraw participant** (required before delete when accepted participants exist):

```
╔ Withdraw participant ══════════════╗
║ Who: [Influencer label]            ║
║ Reason * [________________]        ║
║ A notification record will be kept ║
║ [Cancel]     [Withdraw]            ║
╚════════════════════════════════════╝
```

**Delete request** (only if eligible):

```
╔ Delete request? ═══════════════════╗
║ Permanent for this draft/open item ║
║ Does not erase contracts/payments  ║
║ [Cancel]              [Delete]     ║
╚════════════════════════════════════╝
```

If not eligible → route to **Cancel/close collaboration** workspace instead of delete.
