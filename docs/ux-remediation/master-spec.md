# Master remediation specification

**Scope today:** Package 1 rules (nav · dashboards · payout readiness · invitations · notifications · inbox dedupe · terminology), plus the master finance scope (§12). Expand when Packages 2–5 land.
**Revision:** 2026-11-21 (round 4). Corrects the six Ola review findings, the six round-2 follow-ups the five round-3 consistency rules and the two round-4 invitation rules on Package 1 (see [package-01/README.md § Finding checklist](./package-01/README.md#finding-to-file-checklist)).
**Builds on:** [#533 shared-ui-spec](https://github.com/getnuevetech/Influrios/blob/cursor/ux-design-package-e893/docs/ux-design-package/shared-ui-spec.md) and [navigation-map](https://github.com/getnuevetech/Influrios/blob/cursor/ux-design-package-e893/docs/ux-design-package/navigation-map.md). For what #533 still governs, see its [supersession index](https://github.com/getnuevetech/Influrios/blob/cursor/ux-design-package-e893/docs/ux-design-package/supersession-index.md).
**Audit feed:** RC-DASHBOARD · INV-DC-* · INV-C-014 · INV-N-004 ([#539](https://github.com/getnuevetech/Influrios/pull/539))
**Constraints:** Live deposits closed · Agency deferred · Centered popups for list detail (one explicit exception: §12 ledger rows) · Original influencer card unchanged · No implementation until the package is accepted

---

## 0. Visual system (finding 6)

Match the live app. There is no separate board style.

| Token | Value | Source |
|-------|-------|--------|
| UI / body font | **Plus Jakarta Sans** 400–700 | `src/app/layout.tsx` |
| Heading font | **Sora** 600–700 (sans-serif) | `src/app/layout.tsx` (`font-display`) |
| Serif faces | **None.** The earlier “display serif for titles” rule is withdrawn | — |
| Indigo text | `#111a5a` | `globals.css --deep-indigo` |
| Violet action | `#633cff` | `--royal-violet` |
| Brand gradient | `#2979ff → #633cff` (logo mark, marketing CTAs) | `.brand-gradient` |
| Lavender wash / active nav | `#eae4ff` | `--soft-lavender` |
| Canvas / border | `#f5f7fb` / `#e4e9f5` | account shell |
| Icons | `src/components/icons.tsx` set only (stroke 1.8, 24 grid) | boards use an extracted sprite |
| Controls | Pill buttons; cards radius 20; centered dialog radius 28 with indigo 40% scrim | `account-dialog.tsx` |

Boards: [`package-01/designs/_design-system.css`](./package-01/designs/_design-system.css). Both roles and mobile use the same system.

**Annotation rule (finding 2):** engineering explanations never appear inside an application frame. Boards keep them in note panels outside the frame. In-app copy is the real customer message. Forbidden in-app wording includes “setup reminder hidden”, “badge = 0”, “same counts as desktop”, and any projection or state-machine name.

---

## 1. Single-projection rule

For a given account and session, these surfaces read the **same** derived values:

| Projection | Definition | Surfaces that must agree |
|------------|-----------|--------------------------|
| **Invitations waiting for your reply** | Open, not expired, and **turn = invitee** (§2.2a): marketplace REQUESTED/VIEWED · marketplace NEGOTIATING after the business answered (“{Business} replied”) · team member `invited` on a `sent`/`partial` proposal | Home banner · Home Invitations stat · Needs your attention · Hub Invitations card subset · Hub Invitations tab badge · Collaborations badge (invite portion) |
| **Open invitations** | Above + invitations with **turn = business** (RESPONDED, NEGOTIATING awaiting the business's answer) + team member `accepted` awaiting teammates | Hub Invitations card value · Invitations tab list |
| **Active collaborations** | Same membership filter on both surfaces | Home Active · Hub Active card + tab |
| **Payout readiness** | One of six states (§2.1) | Earnings Receive payments · Home payout message · Hub Payment readiness · Earnings badge |
| **Bell unread** | Unread notices | Bell `aria-label` · Notifications › Unread |
| **Action required** | Deduplicated live tasks (§7) | Needs your attention · Action inbox · Notifications › Action required |

Business uses the same discipline: Collaborations badge = responses + content to review; Contracts badge = agreements awaiting your signature; Needs your attention = their sum.

---

## 2. Status labels

### 2.1 Payout readiness: six states (finding 3)

A saved bank account alone never makes the state Ready. Ready requires identity verified **and** the payout provider confirming payouts are enabled for the account (today `accountOnFile` is not enough; use verified method + provider capability).

| State | When | Message (customer copy) | Primary CTA | Home | Hub label | Earnings badge |
|-------|------|------------------------|-------------|------|-----------|----------------|
| **Setup required** | Identity or payout account not started/submitted | Add your identity and payout account to receive collaboration payouts. | Set up payouts | Lavender banner + CTA | Set up payouts | 1* |
| **Verification pending** | Everything submitted; provider/KYC reviewing | We're checking your details. You don't need to do anything right now. | View details (secondary) | Gray notice, **no CTA** | In review | 0 |
| **Ready** | Identity verified + provider payouts enabled | You can receive payouts to {method ••last4}. | Update payout account (secondary) | **None** | Ready | 0 |
| **Action required** (restricted) | Provider/KYC requests a specific item, or payouts paused | Names the **one** outstanding item | Item-specific (e.g. Upload ID photo) | Rose banner + same CTA | Action required | 1* |
| **Not available in your country** | Corridor has no payout route | Collaboration payouts aren't available in {country} yet. | See supported countries | Gray notice, no setup CTA | Not available | 0 |
| **Temporarily unavailable** (last confirmed state exists) | Provider/status service unreachable | We can't check your payout status right now. Last confirmed: {state}, {timestamp}. | Try again | Unchanged from last known | Last known + “(last checked …)” | Last known (never raised) |
| **Status unavailable** (no confirmed history) | Unreachable **and** no previously confirmed state | We can't check your payout status right now. Please try again in a moment. | Try again | **None** | Status unavailable | 0 |

\* Only while the influencer has active collaborations or unpaid earnings.

Rules: completed steps always render as done. Verification pending never shows “Complete setup” or “Continue”. Unavailable never infers a state: with history it shows the last confirmed one; without history it shows “Status unavailable”, never Ready or Setup required.

**Copy promises:** no fixed review time (e.g. “1–2 business days”) and no “we'll email/notify you” unless (a) the provider supplies the timing for that account and (b) a notification flow for that event is implemented and tested. Until then, point to where status appears (“Check Earnings & Payouts for the latest status”).

### 2.2 Invitation states (finding 4)

| State | Product status | Next to act | Invitee actions | Label |
|-------|----------------|-------------|-----------------|-------|
| Waiting for your reply | REQUESTED / VIEWED (turn = invitee) | Invitee | I'm interested · Ask a question · Decline | violet |
| Question sent | NEGOTIATING, turn = business | Business | Decline · View conversation | blue |
| {Business} replied | NEGOTIATING, **turn = invitee** (set by the business's answer) | **Invitee** | I'm interested · Ask another question · Decline | violet |
| Interested | RESPONDED, turn = business | Business | Ask a follow-up question · Decline | green |
| Interested · follow-up sent | NEGOTIATING, turn = business, interest recorded, question open | Business | Decline | green |
| Accepted | ACCEPTED → COLLABORATION_DRAFTED | Invitee (agreement) | Review agreement | green |
| You declined | DECLINED | — | Close | gray |
| Expired | EXPIRED | — | Close | gray |
| Withdrawn | WITHDRAWN | — | Close | gray |
| Team · waiting for your reply | member `invited` | Invitee | Accept invitation · Decline | violet |
| Team · you accepted | member `accepted`, proposal `partial` | Teammates | — | green |

Semantics follow `APPLICATION_TRANSITIONS` and `inviteeResponsePlan`: “I'm interested” records interest (RESPONDED) and never accepts work. Asking a question (NEGOTIATING) does **not** complete the invitation. Only the business moves an invitation to ACCEPTED.

**Continuation after a question:** when the business answers, the invitation returns to the invitee's turn (“{Business} replied”) and counts again in the banner, attention and badge until the invitee responds. “I'm interested” is available there.

#### 2.2a Turn tracking (independent of read state)

- Each open invitation carries **turn** = `invitee` | `business` | `none`, persisted server-side.
- Turn changes **only** on a persisted action: business sends/answers → `invitee`; invitee says interested or asks a question → `business`; accept/decline/withdraw/expire → `none`.
- **Reading never changes turn.** Opening the invitation, the reply notice, or the Messages thread marks those items read but leaves the response task, banner, attention row and badge in place until the invitee responds.
- Every projection, badge and action-enablement rule uses the §2.2b matrix, never unread state.

#### 2.2b Action matrix (single rule for spec, boards and server)

Inputs: status · turn · `interestRecorded` (set when the invitee says “I'm interested”, never cleared while open) · `openQuestion` (an invitee question the business hasn't answered).

| Case | Status | Turn | Interest recorded | Open question | I'm interested | Ask a question | Decline | Label |
|------|--------|------|:-:|:-:|:-:|:-:|:-:|-------|
| 1 New | REQUESTED / VIEWED | invitee | no | no | ✓ | ✓ | ✓ | Waiting for your reply |
| 2 Question sent | NEGOTIATING | business | no | yes | — | — | ✓ | Question sent |
| 3 Business answered | NEGOTIATING | invitee | no | no | ✓ (P1-D1) | ✓ “Ask another question” | ✓ | Waiting for your reply |
| 4 Interested | RESPONDED | business | yes | no | — | ✓ **follow-up** | ✓ | Interested |
| 5 Interested · follow-up sent | NEGOTIATING | business | yes | yes | — | — | ✓ | Interested · question sent |
| 6 Interested · follow-up answered | NEGOTIATING | business | yes | no | — | ✓ **follow-up** | ✓ | Interested |
| Team | member `invited` | invitee | — | — | Accept invitation | — | ✓ | Waiting for your reply |
| Closed | ACCEPTED / DECLINED / EXPIRED / WITHDRAWN | none | — | — | — | — | — | per §2.2 |

**Turn transitions**

| Event | From case | Result |
|-------|-----------|--------|
| Invitee: I'm interested | 1, 3 | case 4 (turn → business) |
| Invitee: Ask a question | 1, 3 | case 2 (turn → business) |
| Invitee: Ask a **follow-up** question (exception) | 4, 6 | case 5: turn **stays business** (the business already owes the decision). Doesn't add to the invitee's waiting count |
| Business answers | 2 | case 3 (turn → invitee: the invitee still has to decide) |
| Business answers | 5 | case 6: turn **stays business**; interest is already recorded, so no invitee task is created. The answer arrives as a message (read state only) |
| Business accepts / invitee declines / withdraw / expire | any open | Closed (turn → none) |

One open question at a time: while a question is open (cases 2, 5), further messages go through Messages, not the invitation's Ask action. The **server enforces this same matrix**: a submission not allowed for the current case is rejected (`rejected: not allowed now`) and the popup refreshes to the current case.

**Defect P1-D1 (code, not UX):** `APPLICATION_TRANSITIONS` has no NEGOTIATING → RESPONDED transition, so today interest can't be recorded after a question. The code must add the transition (still never accepting work). Code limitations are logged as defects, not adopted as the desired UX. **Forbidden pairing:** a pending label alongside “No further action needed”.

### 2.3 Lifecycle vocabulary

Funded / Expecting funding / Payment pending / Agreement ready / Content in review / Completed — per #533 shared-ui-spec §5.

---

## 3. Badge semantics

| Badge | Counts | Clears when | Destination that explains it |
|-------|--------|-------------|------------------------------|
| Collaborations (influencer) | Invitations waiting for your reply + collaboration tasks on your turn | Persisted status leaves your turn (reply, accept/decline, task done), withdrawn, expired | Hub Invitations tab + Needs your attention |
| Earnings & Payouts | 1 for Setup required / Action required (with active work or unpaid earnings) | State changes to any other state | Receive payments card |
| Collaborations (business) | Responses to review + content to review | Business decides | Dashboard Needs your attention |
| Contracts (business) | Agreements awaiting your signature | Signed or cancelled | Contracts › To sign |
| Bell | Unread notices | Opening an unread notice | Notifications › Unread |
| Action inbox · Messages | No badge | — | — |

Badges keep their last known value while loading. Counts never decrement optimistically before the server confirms.

---

## 4. Button enablement

| Context | Enabled when | Otherwise |
|---------|--------------|-----------|
| Home “Review invitation” | ≥1 invitation waiting for your reply | Hidden |
| I'm interested · Ask a question · Decline (marketplace) | Exactly per the §2.2b action matrix (UI and server) | Hidden |
| Accept invitation / Decline (team) | Member `invited` and proposal `sent`/`partial` | Hidden; status text shown |
| Reply buttons while sending | — | Disabled (prevents double submit) |
| Payout primary CTA | Per §2.1 | Never shown in Pending / Ready (secondary only) / Unavailable (Try again only) |

Destructive buttons (Decline, Not a fit) use the rose outline.

### 4.1 Submitting a response (reliability)

- **One idempotency key per logical submission.** A key is created when the user submits a response that isn't already in flight. Retries of an **unresolved** submission (no outcome yet, or processing / unable to confirm) reuse that key. Once a submission has an outcome (`saved` or `rejected`), the next submission gets a **new key**, even if its intent and text match an earlier one.
- The server binds each key to **authenticated actor + invitation + payload hash** and stores a record: `processing` → `saved` | `rejected` (with reason). A repeat with the same key and same binding returns the record's outcome and never applies twice. The same key with a different actor, invitation or payload is refused (`key mismatch`) and nothing is applied.
- The draft (intent + question text) is kept client-side and **locked while its submission is unresolved**: Try again resends the same payload with the same key. Editing is allowed again once the outcome is saved or rejected; an edited answer is a new submission with a new key.
- **Timeout or network error:** never say “Nothing changed” or “wasn't saved”. Show “We couldn't confirm your response”, then look up the **idempotency record** for that key (not the invitation status alone, which can be unchanged while the write is still processing):

| Record lookup (same key) | Show | Actions | Draft |
|---------------|------|---------|-------|
| `saved` | The saved state as success (e.g. Interested) | Close | Cleared |
| `rejected` | The reason (withdrawn / expired / no longer your turn). Only here may copy say nothing was signed or funded | Back to invitations | Cleared |
| `processing` | “Your response is still being processed.” | Check again (re-reads the record); reply buttons disabled | Kept, locked |
| No record, or lookup fails | “We couldn't confirm your response. Your answer is still here.” | Try again (same key + same payload, so it can't be stored twice) · Close (unresolved submission kept for this invitation) | Kept, locked |

- Counts change only from server-confirmed state.

---

## 5. Notifications rules

1. Unread ≠ action required. These stay as separate filters.
2. Opening an **unread** notice marks it read and decreases the bell by 1. Opening a read notice changes nothing.
3. Action required clears only when the underlying task completes, or the invitation is withdrawn or expires.
3a. Clearing action-required **never deletes a notice and never changes read state**. Notices stay in history (All); an unopened notice stays Unread. Unrelated notices and messages are untouched.
4. Notice detail opens as a centered popup (desktop) or sheet (mobile). The primary CTA goes to the task.
5. The Action required filter counts deduplicated live tasks only.

---

## 6. Navigation and terminology

- Desktop: left sidebar exactly as `account-shell.tsx` (labels, order, icons).
- **Terminology (Package 1, from #533 TERM-CREATOR-001):** customer-facing navigation and CTAs say **Influencer**, never “Creator”. Business sidebar: **Discover Influencers**. Search placeholder: “Search influencers, campaigns, or anything...”. Internal identifiers (`creatorSlug`, routes) are unchanged.
- Mobile (signed-in): a **fixed four-slot nav bar** (3 primary destinations + **More**, equal widths, icon + label). It never scrolls horizontally; More is always fully visible and reachable at 320–430 px. More opens a drawer listing every sidebar destination with the same badges, and shows the sum of badges for destinations not in the bar. Bell in the top bar. Focus trap, Esc, `aria-expanded`.
- Public mobile: #533 mobile-public-nav remains valid.
- Agency deferred.

---

## 7. Action inbox deduplication (Package 1, from #533 INBOX-DUP-001)

- **Task identity** = (collaboration/funding id, milestone id *or* invitation id, action kind).
- One open row per task identity. Repeated events for the same task (reminders, re-sent notices, status pings) merge into that row, which shows the latest date and “N updates”.
- Genuinely distinct tasks stay separate: different milestones, different invitations, or different action kinds on the same collaboration.
- Completing the task removes the row from To do and clears the **action-required** flag on that task's notices. The notices remain in Notifications history with their own read/unread state; nothing is deleted or silently marked read, and unrelated unread messages/notices are untouched.
- Badges and Needs your attention count deduplicated tasks, never raw notices.

---

## 8. Popups and the original influencer card (finding 1)

- List detail, notice open and invitation review use a **centered** dialog (desktop) or a full-screen sheet (mobile). No under-table expands or right rails. Single exception: admin ledger contract rows expand inline (§12.3).
- **Original influencer card:** render the live `InfluencerCardView` component, complete and unmodified. Keep avatar + ring + verified tick, name, handle, specialty, location, platform tiles with VERIFIED/UNVERIFIED labels, QR with Influrios mark, short link, and styling.
- Scale proportionally to the container (`aspect-ratio` preserved). Never crop, never substitute a simplified card, never drop content on mobile. On mobile the card sits in its own full-width section.

---

## 9. States (all Package 1 surfaces)

| State | Spec |
|-------|------|
| Loading | Skeletons; `aria-busy`; badges keep last known value |
| Empty | Honest copy only when the projection is 0; one CTA. Emptiness is about the data only: e.g. no earnings yet ≠ payout setup incomplete (readiness card shows its own state) |
| Error | Inline banner: what failed to load or send + Try again; other sections stay usable. Never assert “nothing changed” after a write; use §4.1 |
| Success | Toast + status change in place; lists refresh from server |
| Retry | Repeated failure keeps the page as it was, with a calm message |
| Permission | Signed out → login; wrong role → message + “Go to your dashboard” |

---

## 10. Acceptance anchors (Package 1 → implementation)

| ID | Pass when |
|----|-----------|
| DB1 | Home waiting-for-reply count = hub waiting subset = Collaborations badge invite portion, all using §1 (incl. “{Business} replied”); hub open count also includes turn = business invitations |
| DB2 | Earnings, home, hub and badge show the same one of six payout states with the §2.1 copy/CTA; INV-DC-002, INV-C-014, INV-N-004 |
| DB2a | Saved account without provider verification is **not** Ready |
| DB2b | Verification pending shows no setup/continue CTA anywhere, and no unsupported timing/email promise |
| DB2c | Provider unreachable shows last known state + timestamp; badge not raised |
| DB2d | Provider unreachable with no confirmed history shows “Status unavailable”; never Ready or Setup required |
| DB2e | Ready account with no transactions shows “No earnings yet” and the Ready card; empty earnings never shows Setup required |
| DB3 | Home Active = hub Active |
| DB4 | Every invitation state in §2.2 shows its actions/label; badge/attention clear on persisted transition only; INV-DC-015, INV-DC-012 |
| DB4a | Ask a question leaves the invitation open (NEGOTIATING, turn = business); the business's answer sets turn = invitee with I'm interested · Ask another question · Decline (needs P1-D1) |
| DB4d | Every case in the §2.2b matrix shows exactly its allowed actions, and the server rejects disallowed submissions; a follow-up question after Interested keeps turn = business and never adds to the invitee's counts |
| DB4c | Reading the answer (invitation, notice or Messages) leaves turn = invitee: banner, attention, badge and task stay until the invitee responds |
| DB4b | Timeout: “We couldn't confirm your response” → idempotency record lookup → saved / rejected / processing / unable to confirm per §4.1; draft kept and locked until saved or rejected; retry of an unresolved submission reuses its key and is stored once; a new submission after an outcome gets a new key even with identical text; a key reused with another actor, invitation or payload is refused; concurrent withdrawal shows the rejection and counts refresh |
| DB5 | Open unread decreases bell; action required unchanged by read alone |
| DB6 | Refresh + re-login + desktop↔mobile keep agreed counts |
| DB7 | Business dashboard: attention = Collaborations badge + Contracts badge; every attention row opens a working popup/sheet; empty/loading/error per board |
| INB1 | ≤1 open inbox row per task identity; distinct milestones never merge (A-INBOX-01); completing a task keeps its notices in history and leaves read state unchanged |
| TERM1 | No customer-facing “Creator(s)” in member navigation or CTAs |
| CARD1 | Home card is the live component, fully visible, proportional at desktop and 390 px |
| VIS1 | No serif text; fonts, icons, colors per §0; no internal notes in UI |
| MOB1 | Mobile nav bar shows More fully at 320–430 px with no horizontal scroll; drawer exposes all destinations + badges matching desktop |

---

## 11. Expansion hooks (later packages)

- **Pkg2:** request/active overview popup field schemas, withdraw/delete gates
- **Pkg3:** money/tax/discount line rules, annual unavailable gate
- **Pkg4:** contract viewer, message reply a11y, public card presentation (card itself stays unchanged)
- **Pkg5:** admin permissions, job failure recovery UI, **admin contract ledger + reconciliation (§12)**, case-resolution permissions

Do not invent commercial prices in designs. Do not reopen live deposits.

---

## 12. Admin contract ledger + gateway/bank reconciliation (master finance scope)

**Status:** scope requirement. Design in **Package 5 (admin finance)**; provider/bank evidence under the separately approved **R6** gate. No implementation. Live deposits stay closed.
**Design reference:** approved mockup [`package-05/reference/contract-ledger-and-bank-reconciliation-dashboard.png`](./package-05/reference/contract-ledger-and-bank-reconciliation-dashboard.png) ([notes](./package-05/reference/README.md)). Its figures are **illustrative only** and must not become hardcoded payment, fee, tax or allocation rules.
**Code:** existing code (`LedgerEntry`, `/admin/marketplace`, `/admin/finance`, `ReconciliationCaseV4`, fee snapshots) informs implementation. It **does not reduce** any requirement below.

### 12.1 Access

- **Admin-only.** Hidden from member roles and from admins without the finance permission. Permission-controlled per action: view ledger, download, view balances, resolve reconciliation cases (resolution permissions are specified in the Package 5 finance design; not a Package 1 blocker).
- Every download and case resolution is audit-logged (who, when, scope).

### 12.2 Contract rows (collapsed)

One row per collaboration contract. Columns, in currency of the contract:

| Column | Meaning |
|--------|---------|
| Contract | Agreement id/title, business, influencer(s), status, currency |
| **Collected** | Cash collected from the business for this contract (confirmed external inflow) |
| **Collaboration fees** | Business- and influencer-side fees from the fee snapshot, shown separately, never double-deducted |
| **Taxes** | Tax lines charged/withheld for this contract |
| **Platform retained** | Amount Influrios keeps (fees retained net of any rebates) |
| **Recorded costs** | Costs recorded against the contract (provider fees, FX cost, chargebacks, refunds borne) |
| **Net earnings** | Platform retained − recorded costs |

### 12.3 Expanded row (explicit exception to the popup rule)

Clicking a contract row **expands its transaction table inline** beneath the row (not a popup). This is the only sanctioned exception to §8, so that admins can compare several contracts on one screen. The transaction table lists each movement: date, type, **internal allocation vs external cash movement**, direction, amount, currency, party, account (gateway/bank), provider reference, reconciliation status.

### 12.4 Downloads

- **Per-contract** download (that contract's transaction table) and **full-ledger** download (all contracts, filter-respecting).
- CSV at minimum. Columns match the screen, including the allocation/cash classification and reconciliation status. Totals in the file equal the screen totals.

### 12.5 Gateway and bank balance summaries

- A summary per **account** (each gateway account, each bank account) and per **currency** within it. Never sum across currencies.
- Each shows: ledger-expected balance, gateway- or bank-reported balance, **as-of timestamp** of each source, and the **reconciliation difference**.
- A non-zero difference links to the reconciliation cases explaining it.

### 12.6 Internal allocations vs external cash movements

- Classify every ledger row as an **internal allocation** (hold, release-to-earnings, fee split, reclassification) or an **external cash movement** (collection, transfer, payout, refund, provider fee, bank settlement).
- Financial totals (§12.2, §12.5) are computed from the defined movement types for each figure. **Never sum every ledger row** into a total.
- Internal allocations are **not** expected to have a gateway event. Only external cash movements are matched to gateway/bank records.

### 12.7 Reconciliation baseline (Ola, 2026-11-21)

| Level | Rule |
|-------|------|
| Scope | **Contract ledger = collaborations.** Account-wide reconciliation explains **all movements in each included gateway or bank account**, including subscription activity where that account is shared |
| Ledger ↔ gateway | Each external cash movement ↔ provider record (amount, currency, state, id). A mismatch opens a case and emits `ledger_mismatch`. Provider facts are preserved, never overwritten |
| Gateway ↔ bank | Requires an **actual bank feed or imported bank statement**. Provider settlement reports alone **cannot prove bank receipt**. Without a bank line, settlement shows as **unproven** |
| Labels | “Transfer submitted” / “Paid out” only from the matching provider state (R6) |
| Failure | Payout failure never erases earned amounts or approved delivery |
| Case resolution | Permissions specified in the Package 5 finance design |

### 12.8 Acceptance anchors (design-level; retest after R6 approval)

| ID | Pass when |
|----|-----------|
| LED1 | Non-finance admins and members cannot reach the ledger or downloads |
| LED2 | Collapsed row figures equal the sums of their defined movement types; fees match the snapshot |
| LED3 | Row click expands the transaction table inline; each row is labelled allocation or cash |
| LED4 | Per-contract and full-ledger downloads match screen totals |
| LED5 | Balance summaries are per account × currency with timestamps and differences |
| REC1 | A sandbox gateway event with an amount mismatch opens a case + `ledger_mismatch` (unblocks INV-N-024 / INV-E-072 on an isolated fixture) |
| REC2 | Settlement without a bank feed/statement line stays **unproven** |
| REC3 | Internal allocations are never flagged as missing a gateway event |
| REC4 | “Paid out” never appears without the provider state |
