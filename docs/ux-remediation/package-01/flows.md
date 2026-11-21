# Package 1 — Complete flows

Roles: **Influencer**, **Business**, **Admin** (shared chrome / jobs alert note).  
All count surfaces for a role must use the projections in [../master-spec.md](../master-spec.md).

---

## A. Influencer — invitation count consistency (INV-DC-001 / DB1)

```
Open invitation exists (marketplace OR team member invited/PENDING)
        │
        ├─► /creator banner “N new invitation(s)”
        ├─► /creator Invitations stat = N
        ├─► /creator Needs attention (invite rows)
        ├─► /collaboration/hub Invitations status card = N
        ├─► Hub Invitations tab/list shows the same rows
        └─► Sidebar Collaborations badge ≥ N (invite portion explained on hub)
```

**CTA:** Review invitation → invitation detail (team route or centered review popup per list pattern).  
**Empty:** Hub may say “No invitations are waiting” **only if** N = 0 on home too.

---

## B. Influencer — payout readiness (INV-DC-002 / INV-C-014 / INV-N-004 / DB2)

```
globalPayoutReady (or documented equivalent)
  │
  ├─ true  → Earnings STATUS Ready
  │          Hub Payment readiness Ready
  │          Home setup banner HIDDEN
  │          Earnings sidebar badge = 0
  │
  └─ false → Earnings STATUS Not ready + blockers
             Hub Payment readiness Not ready + same blockers
             Home “Complete payout setup” SHOWN
             Earnings badge = 1 if activeCollabs > 0 (existing product rule)
```

**Continue** on home → `/creator/earnings#payouts` (or Receive payments).  
Never show Ready on earnings while home/hub still demand setup.

---

## C. Influencer — active collaboration count (INV-DC-006 / DB3)

```
Same membership filter
  ├─► /creator “Active collaborations” = A
  └─► Hub Active status card + Active tab = A
```

---

## D. Influencer — team invite respond + clear action-required (INV-DC-015 / 012 / DB4)

```
Needs attention “Review invitation”
  → /collaboration/team/[id]  (or centered invitation popup)
  → Status: Pending your response
  → CTAs enabled: Interested | Ask a question | Decline
  → Footer must NOT say “No further action needed”

User completes response (e.g. Decline → confirm, or Interested)
  → Persist response
  → Home attention clears (or decrements)
  → Invitations N decrements on home + hub
  → Collaborations badge updates
  → Related action-required notice clears
  → Destination shows responded state + “No further action needed” (now valid)
```

Read-only open of the invitation **without** responding does **not** clear action-required.

---

## E. Influencer — notifications unread vs action (INV-DC-020 / 005 / DB5)

```
Bell = U unread
  → /creator/notifications
  → Open Unread row (?open=) → centered popup
  → Notice marked Read · Bell = U−1
  → Action-required filter unchanged by this open alone

Complete underlying task on destination
  → Action-required clears (centre + home attention as applicable)
```

Opening an already-Read notice: bell unchanged.

---

## F. Influencer — mobile authenticated chrome (MOB1)

```
Mobile top: brand utilities (bell + avatar)
Horizontal chips: primary destinations with badges
More → drawer listing ALL CREATOR_NAV destinations
  + Billing & Plan
  + same badge numbers as desktop sidebar
Focus trap · Esc · aria-expanded
```

Public mobile hamburger remains per prior UX package (out of RC-DASHBOARD but still valid).

---

## G. Business — shared chrome consistency

```
Collaborations sidebar badge = B
  ↔ Needs-your-attention rows (response-to-review + submission review, etc.)
  ↔ /collaboration/business destination attention scale

Refresh / re-login → B stable (INV-DC-032/033 Pass pattern)
Bell unread follows same Unread≠action rules on /notifications
```

No AUDIT invite/payout split on business this pass — design still forbids contradictory projections if they appear later.

---

## H. Admin — shared chrome + jobs alert (light)

```
/admin/jobs (or jobs alert entry)
  → Alert/count opens the jobs surface that explains it
  → Failure rows: readable + Retry reachable (full recovery UI → Package 5)

Member badge rules do not apply inside admin chrome.
Do not add marketing nav fixes here (Package 5 / prior ADMIN-CHROME).
```

---

## I. Stability (DB6)

After aligned projections load:

1. Soft refresh → same invite / active / payout / badges  
2. Sign out → sign in → same  
3. Desktop ↔ mobile → same numbers

---

## J. State matrix (all roles, Package 1 surfaces)

| State | Home | Hub | Earnings | Notifications | Team invite |
|-------|------|-----|----------|---------------|-------------|
| Loading | Skeleton stats | Skeleton cards | Skeleton STATUS | Skeleton list | Skeleton card |
| Empty | Zero invite copy only if N=0 | Same | Ready with $0 activity OK | “No notices” | N/A if deep-linked |
| Error | Banner + Retry | Banner + Retry | Banner + Retry | Banner + Retry | Banner + Back |
| Success | Toast after respond | Counts refresh | — | Bell updates | Responded state |
| Permission | → login / role home | same | same | same | same |

See [designs/states.html](./designs/states.html).
