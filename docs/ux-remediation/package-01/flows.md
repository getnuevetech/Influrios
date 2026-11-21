# Package 1 — Complete flows

Roles: **Influencer**, **Business**, **Admin** (shared count rule only).
Projections, labels and badge rules: [../master-spec.md](../master-spec.md). Boards: [designs/](./designs/).
In-app copy below is customer copy. Engineering notes are marked *Rule*.

---

## A. Influencer — invitation counts (INV-DC-001 · DB1)

```
Invitations waiting for your reply = W   (open, not expired, turn = invitee:
                                          REQUESTED/VIEWED + NEGOTIATING after business answered + team member invited)
Open invitations                   = O   (W + turn = business [RESPONDED, NEGOTIATING awaiting answer]
                                          + team accepted-awaiting-teammates)
turn is persisted and changes only on actions; reading never changes it (master-spec §2.2a)

/creator  banner “W new invitation(s)” · Invitations stat W “Waiting for your reply” · Needs your attention W rows
/collaboration/hub  Invitations card O, sub-line “W waiting for your reply” · tab badge W · list shows O rows with status
Sidebar Collaborations badge = W + collaboration tasks on your turn
```

*Rule:* “No invitations are waiting” appears only when O = 0. Board: [influencer-home](./designs/influencer-home.html) · [collaborations-hub](./designs/collaborations-hub.html).

---

## B. Influencer — payout readiness (INV-DC-002 · INV-C-014 · INV-N-004 · DB2)

```
Resolve readiness ONCE → one of:
 setup ─ identity or payout account not submitted
 pending ─ all submitted; provider/KYC reviewing
 ready ─ identity verified AND provider payouts enabled   (saved account alone ≠ ready)
 restricted ─ provider requests a specific item / payouts paused
 unsupported ─ no payout route for the country
 unavailable ─ provider/status service unreachable → last confirmed state + timestamp
 unavailable, no history ─ unreachable and never confirmed → “Status unavailable” (never infer ready/setup)
```

| State | Earnings › Receive payments | Home | Hub card | Earnings badge |
|-------|-----------------------------|------|----------|----------------|
| setup | Setup required · steps to do · **Set up payouts** | Banner “Set up payouts to get paid” + CTA | Set up payouts | 1* |
| pending | Verification pending · done steps ✓, review step ⏱ · View details | Notice “Payout verification in progress”, no CTA | In review | 0 |
| ready | Ready · method ••last4 · Update payout account | **Nothing** | Ready | 0 |
| restricted | Action required · the one item · item CTA | Banner “Payouts paused: one item needed” + same CTA | Action required | 1* |
| unsupported | Not available in your country · See supported countries | Notice, no setup CTA | Not available | 0 |
| unavailable | Last known + “Last confirmed …” · Try again | Last known (no new message) | Last known + “(last checked …)” | last known |
| unavailable, no history | Status unavailable · Try again | **Nothing** | Status unavailable | 0 |

\* only while active collaborations or unpaid earnings exist.

*Rules:* pending never shows “Complete setup” or “Continue”. Restricted links straight to the outstanding item, and completed steps stay done. Unavailable never falls back to setup, and with no history shows only “Status unavailable”. Copy makes no fixed timing (“1–2 business days”) or “we'll email you” promises unless the provider supplies the timing and the notification flow exists. Board: [earnings-payout](./designs/earnings-payout.html).

---

## C. Influencer — active count (INV-DC-006 · DB3)

Same membership filter → home Active = hub Active card = Active tab.

---

## D. Influencer — invitation respond and transitions (INV-DC-015 · INV-DC-012 · DB4)

### D1. Marketplace invitation

```
[1] Waiting for your reply (REQUESTED/VIEWED · turn = invitee)
 ├─ I'm interested ─► [4] Interested (RESPONDED · turn = business · interest recorded)
 │                     ├─ Ask a follow-up question (exception) ─► [5] Interested · question sent
 │                     │        (NEGOTIATING · turn STAYS business · not in your waiting count)
 │                     │        └─ [business answers] ─► [6] Interested (turn stays business;
 │                     │                                  answer arrives as a message; no task)
 │                     └─ Decline ─► You declined
 ├─ Ask a question (note ≥ 8 chars) ─► [2] Question sent (NEGOTIATING · turn = business)
 │                     ├─ Decline ─► You declined
 │                     └─ [business answers] ─► [3] {Business} replied (NEGOTIATING · turn = invitee)
 │                             (reading the answer does NOT change turn)
 │                             ├─ I'm interested ─► [4] Interested   ← needs defect P1-D1 fixed
 │                             ├─ Ask another question ─► Question sent
 │                             └─ Decline ─► You declined
 ├─ Decline (confirm) ─► You declined (DECLINED)
 ├─ [business] Accept ─► Accepted (ACCEPTED → COLLABORATION_DRAFTED) ─► Review agreement
 ├─ [business] Withdraw ─► Withdrawn
 └─ [deadline passes] ─► Expired
```

[n] = case in master-spec §2.2b. The action matrix there is the single rule for UI and server; a disallowed submission is rejected and the popup refreshes to the current case.

| Transition | Invitation list | Home banner / stat / attention | Collaborations badge | Notification “Action required” |
|------------|-----------------|--------------------------------|----------------------|--------------------------------|
| Pending → Interested | Stays, label “Waiting for {business}” | −1 | −1 | Clears |
| Pending → Question sent | Stays, label “Waiting for {business}” | −1 | −1 | Clears |
| Business answers a question asked **before** interest (case 2 → 3, turn → invitee) | Label “Waiting for your reply” | +1 | +1 | Action required again |
| Interested → follow-up question (case 4/6 → 5) | Label “Interested · question sent” | Unchanged (turn stays business) | Unchanged | — |
| Business answers a follow-up (5 → 6) | Label “Interested” | Unchanged | Unchanged | Message notice (read state only) |
| Invitee reads the answer (invitation, notice or Messages) | Unchanged | **Unchanged** | **Unchanged** | Notice → read; action required stays |
| Replied → Interested / another question / Decline | As above | −1 | −1 | Clears |
| Any → Accepted | Leaves Invitations → Active (agreement ready) | Agreement item added | Agreement task +1 | Agreement notice |
| Any → Declined / Expired / Withdrawn | Leaves open list → Closed | −1 if it was pending | −1 if it was pending | Clears |

*Rules:*
- Asking a question does **not** complete the invitation.
- After the business answers, “I'm interested” is offered. **Defect P1-D1:** code has no NEGOTIATING → RESPONDED transition today; the code must add it. The limitation is not adopted as UX.
- Opening or reading the invitation clears nothing.
- Counts change only after the server confirms the persisted status.

### D2. Team invitation

```
Waiting for your reply (member invited; proposal sent/partial)
 ├─ Accept invitation ─► You accepted ─ waiting for teammates ─► (all accepted) agreement opens
 └─ Decline ─► You declined
Business closes proposal ─► “This invitation is closed”
```

The invitation stops counting as waiting on Accept or Decline. “No further action needed” is never shown while the member is `invited`.

### D3. Failure, retry, concurrency

```
Submit reply → new idempotency key K for this logical submission (bound to actor + invitation + payload)
            · keep draft, locked while unresolved · buttons disabled
            (after an outcome, the next submission gets a new key, even with identical text)
  ├─ success → toast “Reply sent” · status updates in place · counts refresh from server · draft cleared
  ├─ timeout / network error → “We couldn't confirm your response”
  │     → look up idempotency record K (not the invitation status alone)
  │          ├─ saved       → show saved state as success · draft cleared
  │          ├─ rejected    → show reason (withdrawn/expired/not your turn) · draft cleared
  │          ├─ processing  → “Your response is still being processed.” · Check again · draft kept
  │          └─ no record / lookup failed → “We couldn't confirm your response. Your answer is still here.”
  │                                         Try again (same K → stored at most once) · draft kept
  └─ server rejects (withdrawn/expired meanwhile)
        → popup shows the rejection · list, badge, attention refetch; nothing optimistic to undo
```

Board: [team-invite-respond](./designs/team-invite-respond.html).

---

## E. Notifications — unread vs action required (INV-DC-020 · INV-DC-005 · DB5)

```
Bell U unread → Notifications → open unread notice (centered popup / sheet)
  → marked read, bell U−1
  → Action required unchanged (copy: “Your reply is still needed.”)
  → Review invitation → invitation popup (flow D)
Task completes → Action required clears (centre + attention + badge)
```

Board: [notifications](./designs/notifications.html).

---

## F. Mobile authenticated chrome (MOB1)

Fixed four-slot nav bar (3 destinations + More, equal widths, no horizontal scroll; More always fully visible at 320–430 px) → drawer with every sidebar destination, same order, labels, icons and badges. More shows the badge sum for items not in the bar. Board: [mobile-auth-nav](./designs/mobile-auth-nav.html).

---

## G. Business — complete dashboard (finding 5 · DB7)

```
/business/home
 ├─ Needs your attention (A rows = Collaborations badge + Contracts badge)
 │    ├─ “{Influencer} is interested” → popup: Accept and draft agreement · Reply · Not a fit
 │    ├─ “Content submitted for review” → popup: Approve · Request revision
 │    └─ “Agreement ready to sign” → Contracts › agreement viewer
 ├─ Summaries: Active requests · Active collaborations · Agreements to sign · Funded this month (each links to its filtered destination)
 ├─ Recent collaborations (status + who acts next) → collaboration overview popup
 ├─ Start a new request → request wizard · Discover influencers
 └─ Right column: Billing & Subscription → billing · Saved influencers → Discover · Recent activity → activity
States: empty (new workspace CTA) · loading skeleton · partial error with Try again on the failed section only
```

Business decisions persist before counts change. Refresh and re-login keep the badges stable (INV-DC-032/033). No funding/deposit actions while deposits are closed. Board: [business-dashboard](./designs/business-dashboard.html).

---

## H. Action inbox — deduplication (Package 1 · INB1)

```
task identity = (collaboration/funding id, milestone id | invitation id, action kind)
events for an identity with an open row → merge into that row (latest date, “N updates”)
different identity → separate row (e.g. Milestone 1 vs Milestone 2)
task completes → row leaves To do; action-required flag clears on its notices
                 notices stay in history; read/unread unchanged; unrelated notices untouched
```

Board: [action-inbox](./designs/action-inbox.html).

---

## I. Admin — shared count rule

Alert counts sit on the item that opens the explanation (Jobs 2 → 2 failed rows with Retry). Ledger and reconciliation: master-spec §12 (Package 5).

---

## J. Stability (DB6)

Soft refresh, sign out/in, and desktop ↔ mobile all show the same counts and states.

---

## K. State matrix

| State | Home | Hub | Earnings | Notifications | Invitation popup | Business dashboard |
|-------|------|-----|----------|---------------|------------------|--------------------|
| Loading | Skeleton; badges last known | Skeleton | Skeleton | Skeleton | Skeleton | Skeleton |
| Empty | Copy only if projection 0 | “No invitations are waiting” only if O = 0 | “No earnings yet”; readiness card shows its own state (§B) | “You're all caught up” | — | New-workspace CTA |
| Error | Banner + Try again | Same | “We couldn't load your earnings” + Try again | Same | Per §D3 (no “nothing changed”) | Failed section only |
| Success | Counts refresh | Same | State updates | Bell updates | Toast + status | Toast + row leaves attention |
| Permission | Login / role home | Same | Same | Same | Not on invitation → hub | Wrong role message |

Board: [states](./designs/states.html).
