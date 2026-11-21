# Master remediation specification

**Scope today:** Package 1 rules (nav · dashboards · payout readiness · invitations · notifications · inbox dedupe · terminology), plus the master finance scope (§12). Expand when Packages 2–5 land.
**Revision:** 2026-11-21. Corrects the six Ola review findings on Package 1 (see [package-01/README.md § Finding checklist](./package-01/README.md#finding-to-file-checklist)).
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
| **Invitations waiting for your reply** | Marketplace REQUESTED/VIEWED + team member `invited` on a `sent`/`partial` proposal, not expired | Home banner · Home Invitations stat · Needs your attention · Hub Invitations card subset · Hub Invitations tab badge · Collaborations badge (invite portion) |
| **Open invitations** | Above + RESPONDED + NEGOTIATING + team member `accepted` awaiting teammates | Hub Invitations card value · Invitations tab list |
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
| **Verification pending** | Everything submitted; provider/KYC reviewing | We're checking your details. This usually takes 1–2 business days. You don't need to do anything. | View details (secondary) | Gray notice, **no CTA** | In review | 0 |
| **Ready** | Identity verified + provider payouts enabled | You can receive payouts to {method ••last4}. | Update payout account (secondary) | **None** | Ready | 0 |
| **Action required** (restricted) | Provider/KYC requests a specific item, or payouts paused | Names the **one** outstanding item | Item-specific (e.g. Upload ID photo) | Rose banner + same CTA | Action required | 1* |
| **Not available in your country** | Corridor has no payout route | Collaboration payouts aren't available in {country} yet. We'll email you as soon as they open. | See supported countries | Gray notice, no setup CTA | Not available | 0 |
| **Temporarily unavailable** | Provider/status service unreachable | We can't check your payout status right now. Last confirmed: {state}, {timestamp}. | Try again | Unchanged from last known | Last known + “(last checked …)” | Last known (never raised) |

\* Only while the influencer has active collaborations or unpaid earnings.

Rules: completed steps always render as done. Verification pending never shows “Complete setup” or “Continue”. Temporarily unavailable never falls back to Setup required.

### 2.2 Invitation states (finding 4)

| State | Product status | Next to act | Invitee actions | Label |
|-------|----------------|-------------|-----------------|-------|
| Waiting for your reply | REQUESTED / VIEWED | Invitee | I'm interested · Ask a question · Decline | violet |
| Question sent | NEGOTIATING | Business | Decline · View conversation | blue |
| Interested | RESPONDED | Business | Ask a question · Decline | green |
| Accepted | ACCEPTED → COLLABORATION_DRAFTED | Invitee (agreement) | Review agreement | green |
| You declined | DECLINED | — | Close | gray |
| Expired | EXPIRED | — | Close | gray |
| Withdrawn | WITHDRAWN | — | Close | gray |
| Team · waiting for your reply | member `invited` | Invitee | Accept invitation · Decline | violet |
| Team · you accepted | member `accepted`, proposal `partial` | Teammates | — | green |

Semantics follow `APPLICATION_TRANSITIONS` and `inviteeResponsePlan`: “I'm interested” records interest (RESPONDED) and never accepts work. Asking a question (NEGOTIATING) does **not** complete the invitation. Only the business moves an invitation to ACCEPTED. There is no NEGOTIATING → RESPONDED path, so “I'm interested” is not offered after a question; changing that is a product decision. **Forbidden pairing:** a pending label alongside “No further action needed”.

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
| I'm interested | REQUESTED / VIEWED | Hidden |
| Ask a question | REQUESTED / VIEWED / RESPONDED | Hidden |
| Decline (marketplace) | REQUESTED / VIEWED / RESPONDED / NEGOTIATING | Hidden |
| Accept invitation / Decline (team) | Member `invited` and proposal `sent`/`partial` | Hidden; status text shown |
| Reply buttons while sending | — | Disabled (prevents double submit) |
| Payout primary CTA | Per §2.1 | Never shown in Pending / Ready (secondary only) / Unavailable (Try again only) |

Destructive buttons (Decline, Not a fit) use the rose outline.

---

## 5. Notifications rules

1. Unread ≠ action required. These stay as separate filters.
2. Opening an **unread** notice marks it read and decreases the bell by 1. Opening a read notice changes nothing.
3. Action required clears only when the underlying task completes, or the invitation is withdrawn or expires.
4. Notice detail opens as a centered popup (desktop) or sheet (mobile). The primary CTA goes to the task.
5. The Action required filter counts deduplicated live tasks only.

---

## 6. Navigation and terminology

- Desktop: left sidebar exactly as `account-shell.tsx` (labels, order, icons).
- **Terminology (Package 1, from #533 TERM-CREATOR-001):** customer-facing navigation and CTAs say **Influencer**, never “Creator”. Business sidebar: **Discover Influencers**. Search placeholder: “Search influencers, campaigns, or anything...”. Internal identifiers (`creatorSlug`, routes) are unchanged.
- Mobile (signed-in): 3 primary chips + **More**. More opens a drawer listing every sidebar destination with the same badges. More shows the sum of badges for destinations not in the chip row. Bell in the top bar. Focus trap, Esc, `aria-expanded`.
- Public mobile: #533 mobile-public-nav remains valid.
- Agency deferred.

---

## 7. Action inbox deduplication (Package 1, from #533 INBOX-DUP-001)

- **Task identity** = (collaboration/funding id, milestone id *or* invitation id, action kind).
- One open row per task identity. Repeated events for the same task (reminders, re-sent notices, status pings) merge into that row, which shows the latest date and “N updates”.
- Genuinely distinct tasks stay separate: different milestones, different invitations, or different action kinds on the same collaboration.
- Completing the task clears the row and every merged notice together.
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
| Empty | Honest copy only when the projection is 0; one CTA |
| Error | Inline banner: what failed, that nothing changed, Try again; other sections stay usable |
| Success | Toast + status change in place; lists refresh from server |
| Retry | Repeated failure keeps the page as it was, with a calm message |
| Permission | Signed out → login; wrong role → message + “Go to your dashboard” |

---

## 10. Acceptance anchors (Package 1 → implementation)

| ID | Pass when |
|----|-----------|
| DB1 | Home waiting-for-reply count = hub waiting subset = Collaborations badge invite portion; hub open count includes question-sent/interested |
| DB2 | Earnings, home, hub and badge show the same one of six payout states with the §2.1 copy/CTA; INV-DC-002, INV-C-014, INV-N-004 |
| DB2a | Saved account without provider verification is **not** Ready |
| DB2b | Verification pending shows no setup/continue CTA anywhere |
| DB2c | Provider unreachable shows last known state + timestamp; badge not raised |
| DB3 | Home Active = hub Active |
| DB4 | Every invitation state in §2.2 shows its actions/label; badge/attention clear on persisted transition only; INV-DC-015, INV-DC-012 |
| DB4a | Ask a question leaves the invitation open (NEGOTIATING), listed as waiting for the business |
| DB4b | Send failure: no count change, Try again works; concurrent withdrawal: popup shows withdrawn copy and counts refresh |
| DB5 | Open unread decreases bell; action required unchanged by read alone |
| DB6 | Refresh + re-login + desktop↔mobile keep agreed counts |
| DB7 | Business dashboard: attention = Collaborations badge + Contracts badge; every attention row opens a working popup/sheet; empty/loading/error per board |
| INB1 | ≤1 open inbox row per task identity; distinct milestones never merge (A-INBOX-01) |
| TERM1 | No customer-facing “Creator(s)” in member navigation or CTAs |
| CARD1 | Home card is the live component, fully visible, proportional at desktop and 390 px |
| VIS1 | No serif text; fonts, icons, colors per §0; no internal notes in UI |
| MOB1 | Mobile More drawer exposes all destinations + badges matching desktop |

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
**Design reference:** the **approved ledger mockup** is the visual reference. ⚠️ *Link pending.* The mockup was approved in review, but it is not yet committed anywhere in the repository. Commit it to `docs/ux-remediation/package-05/reference/` and link it here before Package 5 design starts.
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
