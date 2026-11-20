# Influrios Unified Remediation Specification

Version 1 • Design review handoff • 19 November 2026  
**Addendum v1.1 (2026-11-20, reviewability):** Deliverable workflow gaps are **IN SCOPE**. This pack is **NOT** complete verified UI/UX remediation. Aggregate **20 Pass / 10 Partial** (J14 + J18 aggregates Partial). See [`ADDENDUM-v1.1-deliverables.md`](./ADDENDUM-v1.1-deliverables.md), [`addenda/`](./addenda/), [`design-boards/`](./design-boards/). Historical evidence `db64224` is not complete platform coverage. Implementation remains paused.

Prepared for Ola and Dev AI. This specification turns the frozen audit findings and Ola's established product decisions into one implementation plan. Design and planning proceed now. Product changes, deployments, paid transactions and external notifications are not authorized by this document alone; implementation remains paused pending review of this concrete pack.

The evidence baseline is PR #534, commit db64224ec9420d55df2641d93c8ba3f678585d1c. Preserve the original audit files. The baseline is sufficient to move from repeated closure passes to remediation design. It is not a launch-readiness certificate.

The companion Design Atlas contains ten annotated layout boards. Each shows a page and its interaction state, including centered popups where specified. Exact labels, sample values and behavioral requirements in this specification control implementation. Sample annual prices and future transactions in the atlas are illustrative and must not be seeded as commercial policy.

## Reading order

1. Read the evidence qualifications and issue mapping before changing code.
2. Review the shared shell and popup requirements, then the relevant page specification.
3. Use the atlas to verify page hierarchy, list placement and popup composition.
4. Implement in the ordered packages only after design review. Attach evidence for the acceptance criteria to each focused PR.

## Fixed product decisions

Use “Influencer” in visible UI. Keep public, member and admin navigation distinct. Use centered popups for contextual viewing and editing; mobile may use the same dialog as a full-screen surface. Keep comparison collapsed until requested. Show a full, proportionally scaled original Influencer Card. Keep tax selection to Country plus Product charge, with conditional regional detail where calculation requires it. Remove filing responsibility from routine pricing. Keep live collaboration deposits closed and simulation clearly labelled. Agency onboarding remains deferred.

# 1 Audit baseline and closure decision

The new monthly transaction is supported by the quote screenshot, paid hosted invoice, PDF amounts, post-payment probe and recording. The verified amounts are USD 29.00 subtotal, 4.35 discount, 24.65 discounted base, 2.03 tax and 26.68 total. The probe records an active monthly Pro state, a completed checkout attempt, redeemedCount 1 and a consumed discount reservation. CI succeeded at the reviewed commit.

The evidence distinguishes customer payment from recurring subscription management. A real test-provider subscription ID is present in the probe, while the saved SubscriptionState externalId still contains the Checkout Session ID. Keep COR-07 open. Successful initial activation does not resolve renewal, proration or portal references.

## Scoring qualification

Historical freeze `db64224` reported 22 Pass / 8 Partial with Coverage Incomplete 0 on that **old checklist only**. Reviewability revision (expanded deliverable audit): J14 aggregate Partial (note subtest Pass) and J18 aggregate Partial (monthly Pass / annual Fail) → **20 Pass / 10 Partial**. Never imply annual discounts, file-upload E2E, or business Approve/Request-changes UI passed. Coverage Incomplete 0 must not be read as expanded-platform completeness.

The completion method explicitly uses the success/completeCheckout path to verify payment through Stripe. It proves activation through that path. It does not independently prove webhook delivery, renewal handling, lost-return recovery or duplicate-event safety. These become acceptance tests in the billing remediation package; they do not trigger another general audit.

The hosted invoice is marked paid. The downloaded invoice PDF reconciles its amounts but uses invoice “amount due” language; treat it as an invoice, not proof that a paid receipt PDF was inspected. The billing-history screenshot does not demonstrate an in-app invoice-download link. Add that customer action in the billing design and retest it.

## Freeze rules

Freeze this source commit as the audit reference. Keep reproduced failures, provider dependencies and evidence limitations open in the remediation register. Do not edit historical screenshots or relabel simulation. Future findings receive new IDs and source dates. Closing the audit phase means moving to designed corrections; it does not mean all features passed. PR #534 remains unmerged unless separately authorized.

# 2 Evidence to remediation mapping

| Source | Confirmed scope | Remediation package |
|---|---|---|
| COR-SEC-01 | Public admin login exposes concrete bootstrap credential hints | R0 security containment |
| COR-03 and COR-04 | Annual offer and provider price missing; annual discount flow fails | R2 subscription catalog and pricing |
| COR-07, COR-11, COR-12 | Session ID used as subscription reference; missing price/customer mappings | R2 identity and billing lifecycle |
| COR-08 and COR-19 | Monthly payment, invoice and redemption evidence now supplied | Preserve as regression fixtures |
| COR-01 and PL-01 | Simulated release does not prove provider payout | R6 provider integration gate |
| COR-10 | managed_intro fee rule absent | R5 matching operations configuration |
| COR-09a and COR-09b | Mixed admin/public navigation and inconsistent terminology | R1 shared shells and copy |
| COR-18 | Admin accounts clipped on mobile | R1 responsive shell; R5 account list |
| COR-13 | Demo directory and missing shortlist action | R4 discovery and profile |
| COR-14 | Prior direct SQL mutation does not prove account edit UI | R5 account editing and UI retest |
| COR-15 | Job retry not exercised; canonical CMS routes need clarity | R5 jobs and CMS |
| COR-16 and COR-17 | Visual acceptance distinction and headed-browser harness limitation | R7 evidence and regression rules |

Ola's earlier requests also remain design requirements: request deletion with accepted-invitation withdrawal and reasons; popup workrooms; contract formatting and reusable AI-tailored templates; conversational messaging; full original card presentation; simple country/charge tax settings; annual purchase visibility for new and existing subscribers; hidden-by-default comparison; removal of unrelated pricing FAQs. These are product-direction items, not newly reproduced audit defects.

No “seed missing fee” task may invent an amount. Missing annual prices, managed-introduction rates and launch countries must use approved business configuration. A disabled or unconfigured state is preferable to an arbitrary commercial value. Technical readiness must be distinguished from approval to sell.

# 3 Shared interface and popup specification

Use the current Influrios navy, violet and pale-lavender identity. Proposed tokens: text #171B58; primary #603BFF; background #F6F7FC; border #E4E8F3; muted text #626B87; success #087B5A; destructive #B42318. These tokens are implementation targets; validate contrast in rendered components. Use a consistent sans-serif UI face, 16px body text, 14px secondary copy, 28–32px page headings and 20–24px dialog headings. Inputs and touch targets are at least 44px high. Use an 8px spacing grid.

## Page structure

One shell, one page title and one primary page action. Public pages use the public header. Member pages use the role sidebar and member header. Admin pages use only the admin shell. Preserve route aliases and deep links where possible; changing navigation labels must not break signed links or bookmarks. Move provider diagnostics out of customer page copy.

Lists use a search field, relevant filters, explicit status, a stable row action and an overflow menu. Keep lifecycle status separate from visibility and invitation activity. Empty states explain the next action; loading states preserve geometry; permission denial never shows another tenant's data.

## Centered dialog behavior

Use the existing AccountDialog and focus-dialog foundations. Standard width 640px; detailed records 920px; document review up to 1120px. Constrain desktop height to 90dvh. Header and action footer stay visible; scroll only the content region. Background remains visible but inert. Use role=dialog, aria-modal, labelled title, focus trapping and focus restoration to the invoking control.

Opening View must present the title at the top immediately. Never append selected content below a long list. Keep filters, selected row and scroll position after closing. Browser Back closes route-backed dialogs; direct links open the same record within its role shell. Editing and deletion confirmation replace the current dialog state rather than stacking dialogs. Escape and backdrop close clean forms; dirty forms show a discard confirmation. In-flight submissions cannot be accidentally repeated or dismissed into ambiguous state.

At widths below 768px, hide the persistent sidebar behind a menu button and render dialogs full screen. At 390px there must be no page-level horizontal overflow. Wide comparison tables use a labelled, contained scroll region or two-plan mobile comparison. Keyboard, focus, screen-reader announcements and zoom are release checks, not screenshot-only claims.

# 4 Public pricing and comparison

Atlas board 1. Apply the same pricing components to influencer and business audiences; use distinct audience plan data. Preserve existing /pricing and business public plan routes after confirming their current mappings. Reduce the oversized hero to a short heading and useful subheading above the cards. Remove the generic FAQ block and unrelated “publish your card” sales panel from pricing. Keep a Help or Billing support link near the footer.

Place Monthly / Annual immediately above the cards. Switching changes every paid plan together. Preserve selection through signup/login, checkout, cancel and back navigation. Free remains “Free” regardless of interval. Never use monthly wording for the annual charge.

## Price hierarchy

Monthly card: base price per month, one tax summary when a billing-location quote exists, and the estimated total for that month. Annual card: annual charge prominently, equivalent monthly base as secondary text, and calculated savings against twelve comparable monthly base payments. Savings excludes tax and temporary coupon reductions. Show no savings badge when savings are zero or negative. Do not assume annual means twelve times monthly or a fixed percentage off.

Use admin-approved amounts. In the atlas, Pro USD 290/year is illustrative only. If annual is configured but cannot be sold, disable its purchase CTA with “Annual billing is currently unavailable” and retain the monthly alternative. Unconfigured offers must not send customers into a failing checkout.

Tax location is a small control above the cards. If location is incomplete, show one shared “Enter billing location to see your total” prompt and base prices. Do not show invented country-wide amounts. With enough information, show one tax line per card; never repeat the tax line above the CTA and in a comparison header. Checkout recalculates from confirmed billing details.

## Comparison

“Compare plans” opens a centered 920px dialog. Cards remain visible behind it. Show plan names, concise prices, feature groups and a “Show differences only” control. Use actual entitlements and limits from the same catalog as the cards. Mobile compares two selected plans at a time. Closing restores the invoking button. Comparison must not be expanded on initial page load.

Acceptance: new guests can select and preserve monthly or annual purchase intent; failed authentication preserves that intent; unavailable plans fail before provider checkout; every displayed base, interval and total matches the selected offer.

# 5 Member Billing and plan

Atlas board 2. Keep /billing and /business/billing as member destinations. Place current subscription first: plan name, interval, status, next renewal date and renewal amount with tax qualification. Show any scheduled change directly below it. A promotional first invoice and the undiscounted renewal must be visibly distinct. Replace technical text about provider customer storage with a normal payment-method summary and a Manage button.

Next show the Monthly / Annual selector and concise plan cards, with at most five key benefits each. “Current plan” applies to the same plan AND interval. When viewing the same tier under Annual, a monthly subscriber sees “Switch to annual,” not a disabled Current plan button. Free users see Choose; existing subscribers see Upgrade, Switch or Schedule downgrade as appropriate. Selecting a card only opens review and never changes the subscription.

## Change review dialog

Show current plan, target plan, effective date, due today, credit or proration where applicable, renewal date and next recurring amount. Default same-tier monthly-to-annual conversion to next renewal, consistent with the existing scheduling copy. Downgrades also schedule at renewal. Immediate upgrades require an authoritative preview and explicit confirmation. Do not invent refund or proration policy. Cancellation shows access end date and allows reversal before the scheduled cancellation becomes effective.

When provider identity is unresolved, keep current access intact and show “We could not load your billing details. Retry or contact support.” Admin sees the diagnostic reason. Never create a second subscription to bypass an existing subscription-reference failure.

## History and documents

Billing history includes date, plan, interval, invoice number, amount, currency, payment status and View invoice / Download PDF actions. A receipt action must deliver a receipt, not rename an unpaid-looking invoice PDF. Respect tenant ownership on every document URL. Missing documents show a retry state; a successful payment remains successful if PDF generation is delayed.

Place payment method and history below plan selection. Replace large payout warnings with a quiet “Manage collaboration earnings” link only where useful. Do not mix subscription invoices and collaboration earnings in one table.

Acceptance: monthly/annual switching is available to new and existing eligible users; cancel/return does not alter entitlement; renewal copy includes discount duration and tax handling; invoice actions work after a fresh login.

# 6 Subscription catalog and identity corrections

Sources: COR-03/04/07/11/12. Reuse src/lib/billing.ts, billing-interval.ts, subscription-renewal.ts, the existing plan components and /api/billing/webhook. Inspect the actual schema before migrating; the field names below describe required meanings, not a mandate to create duplicate models.

## Canonical records

An offer is uniquely addressed by audience, plan, interval, currency and provider environment/account. Store its approved base amount, active state, provider product and recurring Price identifiers. Monthly and annual are explicit separate offers. Preserve retired price versions for existing subscriptions. Validate amount, currency, recurring interval and provider account before marking an offer purchasable.

A subscription record stores provider customer ID, subscription ID, subscription item ID, price ID, status, current period, cancellation/scheduled-change state and account/environment provenance. A CheckoutAttempt stores the Checkout Session ID and its relationship to that subscription. A session ID is never used in place of a subscription ID for renewal or updates.

## Migration sequence

1. Inventory records whose subscription reference is a Checkout Session. Produce a dry-run report grouped by environment and provider account.
2. Retrieve the referenced session and associated subscription from the same provider account. Confirm ownership, currency, plan and price relationships.
3. Backfill only unambiguous matches with original IDs retained in audit history. Quarantine missing or conflicting mappings; do not guess by email alone.
4. Populate approved monthly/year offer mappings and validate them. Never insert illustrative atlas prices.
5. Deploy dual-read compatibility if necessary, migrate, verify, then remove legacy interpretation in a later focused change.

## Reliable completion

Use one idempotent reconciliation function for the verified success return and valid provider events. Persist entitlement, checkout completion and discount consumption atomically where possible. Deduplicate event IDs and state transitions; reject wrong-account/environment events. Return-page arrival alone cannot be the only completion trigger. Provider-confirmed renewals, failed invoices and subscription updates must also be reconciled.

Acceptance: close the browser after test payment and prove activation via webhook; replay the real test event without duplicate entitlement or redemption; update an existing subscription item without adding a second item; preview and execute proration on the same saved subscription; verify recovery after transient provider failure. See Stripe references in section 18.

# 7 Tax and discount calculation experience

Atlas boards 2 and 4. Every supported paid checkout must run tax determination. A zero result can be valid; missing configuration is not silently treated as zero. This is a product calculation specification, not a statement that every payment in every jurisdiction legally bears a positive tax.

## Admin tax list and popup

Keep the admin taxonomy simple: Country + Product charge. Product charge options are the canonical billable items, such as Subscription, Collaboration service and Business platform fee, with other existing charge types only where the ledger already distinguishes them. Do not duplicate this with “Applies to.” If two existing selectors encode different meanings, map their records explicitly during migration; do not drop data by blindly removing a column.

List columns: Country/region, Product charge, Rate or Automatic, Effective date, Status, Actions. Add/Edit opens a centered popup. Required fields: country, one product charge, calculation mode and approved rate when using a configured rate. Regional controls appear only when needed. “Tax added to base price” is the fixed default for the requested flow. Existing inclusive-price records require explicit migration handling so they are not taxed again.

Remove filing owner, filing status, tax-responsible entity, provider jargon and fee-rule linking from this editor. Preserve any operational records required elsewhere; this change simplifies the pricing UI. Tax reporting/document workflows are separate work, and a selector must never imply that returns have been filed.

## Calculation contract

Use one server quote containing currency, line items, offer versions, discount allocation, taxable bases, tax components, total, location, expiry and calculation source. Money uses currency minor units with explicit rounding. For the proven monthly case: 2900 - 435 = 2465; round(2465 × 0.0825) = 203; due = 2668 cents. This rate is an audit example, not a global setting.

Choose a single tax calculation authority per transaction: approved configured rate OR provider automatic calculation. Never add locally calculated tax and then turn on a second automatic tax charge for the same base. Country is the admin organizing dimension; capture state/postcode where necessary. Reject overlapping active rules unless deterministic precedence is explicitly defined and tested. Preview and provider totals must reconcile before presenting success; preserve provider facts when a mismatch occurs.

## Discount behavior

Apply validates audience, plan, interval, location restrictions, active dates, currency and redemption limits on the server. Invalid annual-only code on monthly checkout offers “Review annual plan”; it must not silently switch or charge. Recalculate after any plan, interval or address change. Reserve usage during checkout; consume on confirmed success; expire or release abandoned reservations. Confirm duration and renewal amount in review. Concurrency must not over-redeem the last available use.

# 8 Admin plans and billing responsibilities

Atlas board 3. Keep two functional areas with clear purpose, under one Subscriptions navigation group: Plans and features defines what is sold; Billing activity shows what customers bought and paid. They may share a shell and tabs, but must not present two editors for the same price or entitlement.

Plans list: audience filter, plan, monthly base, annual base, publication state, provider readiness and Edit. Edit popup tabs: Pricing, Features, Presentation. Pricing holds explicit monthly and annual amounts, currency and interval availability. A sample country/location preview shows base, tax and customer total without changing the stored base. Features uses the existing entitlement definitions with typed limits; Presentation owns marketing name, short description, feature highlights and recommendation badge. A published plan cannot be declared purchasable until its intended provider offer mapping validates.

Provider setup diagnostics stay in an admin-only expandable section. Save draft persists incomplete work without publishing it. Save changes updates the version after validation. Display the exact failing field and retain entered values on error. Changing catalog prices must not silently rewrite historical invoices or already-agreed contract amounts. Define existing-subscriber price migration as a separate reviewed operation.

Billing activity list: customer, plan, interval, provider status, amount/currency, last invoice and next renewal. Clicking a row opens a read-only account billing popup with invoice links, provider references and event history. Financial mutation actions require explicit permission and a review step; support users must not see editable prices here.

Discount administration belongs in Payment settings / Discounts. List code, eligible charge/plan/interval, value, usage, dates and state. Edit opens a popup. Used discounts retain immutable transaction history and versioned eligibility changes. State changes must not retroactively reprice completed payments.

Acceptance: editing a plan via UI persists after reload and populates public/member pricing consistently; monthly/year offers do not diverge across screens; read-only admins cannot mutate through direct requests; a catalog edit produces an attributable audit event; a failed provider validation does not publish an unusable annual CTA.

# 9 Requests and accepted invitation withdrawal

Atlas board 5. Keep Requests, Opportunities and Active collaborations as distinct tabs in the existing business hub. Requests own the brief and invitations; Opportunities represent discoverable listings; Active collaborations represent agreed work. Creating a request opens a request editor in the Requests context. Save draft and Publish are explicit alternatives in one footer. Publishing must work on the first valid submission.

## List and record popup

Columns: Request, Status, Visibility, Invites/accepted, Updated, View and menu. Visibility is Public or Invite only; invited recipients can coexist with a public listing, but that does not make its visibility both Public and Private. View opens a centered record popup with title at top; tabs Brief, Invitations, Activity. Show Edit where permitted and Open collaboration when linked. Never expand the detail beneath the table.

## Deletion and withdrawal state rules

- No accepted invite and no contractual/financial dependency: offer Delete request in the menu. Review popup identifies the request and effects on pending invitations. Confirm deletes from normal views using a tombstone or archive so activity is retained; invalidate pending invite tokens.
- Accepted participant present: Delete is blocked with “Withdraw accepted participants first.” Open a dedicated withdrawal step listing affected accepted participants and the reason field. Require a concrete explanation, not only a category.
- Signed agreement, funds, submitted work or an open dispute present: do not use request deletion to bypass cancellation obligations. Show Review cancellation with the existing settlement process and its status. Request deletion remains unavailable until dependencies permit archival.
- Withdrawal records the actor, participants, reason, timestamp and state change. Queue notifications for affected participants with the reason and a link. After successful withdrawal, return to the request review; do not automatically delete it.

Use an outbox or equivalent durable delivery queue. If sending fails, keep the withdrawal event and mark notification Pending retry. Never claim the recipient was notified before delivery evidence exists. Prevent deletion until the required notification is durably queued; retain a recoverable delivery record after archival. Recheck accepted/signed status in the same server-side transaction to handle an acceptance racing with deletion.

Acceptance: invitation recipients cannot see unrelated invitees; withdrawal is tested from both business and influencer accounts; repeated confirmation causes one event; missing reason fails; expired links cannot accept deleted requests; financial cancellation cannot be bypassed by direct API calls.

# 10 Active collaboration workspace

Atlas board 6. The active list shows collaboration, counterpart, work status, next action, next due date and a concise funding status. Clicking View opens a wide centered workroom popup. Keep the underlying list context. Provide a direct permalink to the same workspace; a direct visit supplies the role shell and a clear Close to collaborations action.

Workroom header: title, counterpart and next required action. Tabs: Overview, Deliverables, Agreement, Messages, Payments. Keep separate delivery and money states. For example, Revision requested belongs to the submitted version, while Funds held belongs to funding. Do not repeat explanatory payment-engine paragraphs in every milestone.

Deliverables list shows milestone, due date, revision allowance, status and amount where relevant. Selecting a milestone replaces the detail body in the same popup. Influencers see Submit version or Revise submission. Businesses see Review submission, Approve or Request changes. Version history is visible and read-only; approval binds to the version reviewed. A new submission invalidates an obsolete review action and prompts a refresh.

Approval review shows deliverable/version, approved amount and consequences. The server authorizes the current actor and state. Use idempotent actions. UI success reflects saved approval; transfer and payout updates appear independently in Payments. Retry a failed transfer without changing delivery approval. Show sandbox simulation labels only within test environments and never as a paid-to-bank badge.

Payments tab: business sees compensation, business fee, applicable taxes and funded total. Influencer sees gross compensation, influencer fee, any applicable deductions and net payable. Use existing fee snapshots and ledger definitions. Do not double-deduct business fees from influencer compensation. No new “gross” terminology or 80/20 mechanism is introduced.

Acceptance: submit, revise, resubmit and approve work in the popup for both roles; stale-version approval is rejected; reviewer cannot approve own unauthorized work; refresh restores the selected milestone; popup history does not lose unsaved content silently; provider simulation is visibly and structurally distinct from completed payout.

# 11 Contracts and document templates

Atlas board 7. Use a contract list with campaign, parties, document type, revision, signature status and Updated. Open a centered reader with Document, Parties, Signatures and Activity tabs. Show one current state and the relevant action: Review draft, Send for signature, Sign or Download signed document. Remove contradictory messages such as “Funds confirmed” alongside “Funding waits for signatures.” Funding status is separate from signature completion.

## Document typography and structure

Render an A4 or Letter document canvas with approximately 20–25mm margins, black body text, an 11–12pt document font and numbered clauses. UI uses the product sans-serif; the document may use a restrained serif face. First page includes title, agreement reference, version, effective-date rule, parties and a commercial summary. Use real tables for parties, deliverables, milestones, fees and usage rights. Use repeating table headers, deliberate page breaks and Page X of Y footers. Never show raw signature tokens, flattened table text or internal provider jargon.

Resolve commercial terms from a versioned snapshot. Milestone amounts must sum to the correct gross/fee/net totals with explicit currency and rounding. Required values cannot say “Per campaign record” unless the exact versioned schedule is attached as part of the signed document. Block sending when required party identity, scope, dates or payment terms are missing.

## Reusable templates and AI tailoring

Template library supports document type, jurisdiction scope, audience, version, owner, status and required fields. Initial categories may include Collaboration agreement, Statement of work, NDA and Amendment; each requires approved content before publication. Reusing a template creates a draft with confirmed party data and deal-specific fields, not a copy of another customer's identities.

AI tailoring proposes changes to permitted sections. Show Before / Proposed text, reasons and Accept / Reject per change. AI cannot invent party names, addresses, compensation, signature authority or provider capabilities. Structured commercial fields remain authoritative; inconsistent generated clauses block send until resolved. Saving reusable templates strips party-specific details. Limit access by organization and template permissions.

Sending freezes an immutable document version. Subsequent edits create a new version and a clearly superseded signature request; never alter signed bytes. Signature blocks display actual consenting signer data, role and timestamp. Add an audit certificate separately from the main agreement. Do not generate signature marks before consent. Acceptance includes PDF pagination, multi-party identities, version immutability, authorized downloads and no visible unresolved placeholders.

# 12 Messages and notifications

Atlas board 8. Make Messages a conversation inbox. Remove the collaboration pipeline from this page. Desktop uses a searchable conversation list and selected thread. Each row shows counterpart, campaign, latest message, timestamp and unread count. A campaign name alone is insufficient where several contracts share that name; retain a stable conversation ID and short context label.

Thread header shows participants and a View collaboration action that opens the established workroom popup. Show messages in order, date separators, attachments and delivery state. Keep the composer anchored at the bottom with Send and attachment controls. Enter behavior must be documented; offer Shift+Enter for a newline. Failed sends retain typed content and offer retry using the same client message ID. Do not duplicate a message after a network retry.

Mobile opens a single thread with Back to messages. Do not force a narrow three-column layout. Preserve scroll position on return. New incoming messages should not pull someone away from older messages they are reading; show a jump-to-latest control.

Subscription, invitation, withdrawal, contract and payment notifications link to the exact authorized record. Record notification status separately from business-event status. Email retries must not re-run withdrawals or financial actions. Unread count and mark-read behavior share one source with the action inbox. Notification copy contains relevant next action and avoids implementation details. Withdrawal notices include the stated reason; do not expose other invited influencers or private business threads.

Acceptance: send and reply across both parties; attachments are permission checked; unauthorized conversation IDs fail; retries do not duplicate; unread counts update after reopening; email evidence uses the sandbox mail sink; failures are visible without pretending delivery.

# 13 Discovery and influencer public profile

Atlas board 9. Keep the full original Influencer Card as a first-class module. Its artwork, avatar treatment, social tiles, QR and short link must remain unchanged. Reduce it proportionally and display the entire card, including the bottom short link. Do not crop its top or replace it with a new card design. The atlas positions an unchanged card reference to explain layout; implementation reuses the canonical card component.

Public profile desktop: compact public header, restrained cover, identity and primary Invite to collaborate CTA, then a two-column layout. Card occupies roughly 320–360px on the left; About, services and portfolio occupy the right. Avoid repeating the same bio in multiple prominent sections. Move Share/QR controls to a centered Share card popup. Do not let a huge QR module displace portfolio content. Mobile stacks identity, primary CTA, full card and profile sections; user can open the card larger when needed.

Show social metrics only from available data with platform and freshness context. Zero and Unavailable are distinct. Do not invent audience reach, engagement rates or verification. Deduplicate category/service tags. Hide empty content sections and use an avatar fallback for broken images. Omit the signed-out Join banner for signed-in visitors. Similar profiles must exclude the current influencer and use valid published profiles.

Discovery uses live eligible profiles, visible search filters and Save to shortlist. Shortlisting is tenant scoped and persists after reload. Guest shortlist intent survives authentication without disclosing another organization's list. Campaign invitation from a profile opens the request selector and respects eligibility restrictions already enforced by the product.

For future enriched profiles, store city, region/state and country as separate normalized data. Date of birth belongs in restricted identity data; public and search surfaces use only approved age bands where appropriate. Do not infer missing identity fields with AI. This data expansion and agency onboarding are separate scope decisions, not automatic additions to remediation.

Acceptance: card fully visible at supported sizes, QR still usable from an enlarged view, original design preserved, real shortlist saved, no demo profiles presented as verified live inventory, public details respect visibility and entitlements.

# 14 Admin accounts and operations

Apply the shared admin shell to accounts, plans, billing, payment settings, matching, jobs and CMS. COR-18 requires more than hiding page overflow: at 390px the navigation collapses and every row action remains reachable. Accounts can become stacked cards with name, role, status and View; detailed tables may use a contained scroll region with a visible cue. Never leave a fixed desktop sidebar consuming the mobile viewport.

Account View opens a centered wide popup with Overview, Profile, Billing, Collaborations and Activity tabs. Overview includes account ID, role, legal/display name, contact details, country/region and status according to permissions. Edit starts an explicit editable state with Save / Cancel. Sensitive fields are masked by default and authorized separately. Read-only support roles cannot mutate through a direct request. Record changed fields and actor without storing secrets in activity logs.

COR-14 is an evidence gap: verify the actual Edit UI before deciding it needs a code change. The remediation PR must prove edit → save → reload in the application and server readback. SQL mutation may seed fixtures, but it is not acceptance evidence for the user action.

Jobs list shows status, job type, attempt count, last error, next retry and safe actions. Retry opens a review popup and executes one retry only where the job is retryable. Add a deterministic failed-job fixture in the isolated test environment. Never manufacture a failure in production to test Retry. CMS navigation must link to canonical banners/homepage pages; redirect old CMS aliases only when intended. Do not build duplicate CMS products to make nonexistent routes return 200.

Managed introductions should show a missing fee configuration to admins and a clear availability state to customers. Configure an approved rule for the existing managed_intro flow and verify both parties' fee treatment. Do not build the deferred multi-party managed-opportunity desk as part of this correction.

Keep Admin Users and Access Levels as separate pages. Assigning a role, changing a role's permissions and editing a customer account are distinct operations and permissions. Acceptance includes role-matrix checks, mobile actions, audit history, CMS persistence and the failed-job retry fixture.

# 15 Security and payment release boundaries

COR-SEC-01 is a recorded release blocker. Once remediation is authorized, first remove concrete bootstrap credential hints from public HTML, scripts, screenshots, logs and help text. Review whether any exposed credentials remain usable; if so, rotate them and invalidate affected sessions using an authorized operational procedure. Do not merely hide text with CSS. Add tests for public admin login output and for absence of default-password fallback in production initialization. Preserve a safe bootstrap process outside the public sign-in screen.

The successful subscription transaction does not authorize live collaboration deposits. Keep #535's environment, host, feature-flag and saved-provenance checks. Simulated settlement must remain providerE2eComplete=false on initial execution and retries. Wrong environment, failed capability probe, empty/untrusted host and missing provenance fail closed. Tests must assert both the refusal reason and absence of queued/issued transfers.

Influrios owns the payment ledger and workflow; adapters map that standard to provider main accounts or supported subaccounts. Account structure does not itself prove a gateway supports holding, release, cross-border payouts or permitted fund custody. Record provider capabilities and account provenance explicitly. Do not reopen the Payment Standard v2 architecture within a visual remediation PR.

R6 needs a separately approved provider integration/test plan: supported collection, holding method, settlement, influencer destination onboarding, transfer and payout events, fees, reversals and reconciliation. Use real test-provider references for provider evidence; keep unavailable bank settlement labelled unproven. Show “Transfer submitted” and “Paid out” only from their corresponding provider states. Payout failure must not erase earned amounts or approved delivery.

No design change can transform simulated release into a provider payout Pass. Product launch for unsupported money flows stays disabled until the relevant technical and operational gate is satisfied. Agency, worldwide expansion and new gateways remain separately scoped; this document does not grant country availability or custody approval.

# 16 Implementation sequence and ownership

Keep #534 as the frozen audit pack. Do not mix product corrections into its history. The following sequence applies after the designs and behavior are approved. Each PR names the source IDs, touched screens, data migration, screenshots and functional retest evidence. A shared component change must verify its consumers before rollout.

| Package | Scope and dependencies | Completion evidence |
|---|---|---|
| R0 | Security exposure containment; independent first package | Public output check; authorized credential/session remediation record |
| R1 | Role shells, AccountDialog, responsive navigation, terminology | Desktop/mobile list and popup states; keyboard/focus checks |
| R2 | Offer catalog, annual paths, IDs, lifecycle, billing history; depends on R1 patterns | New/existing-user annual purchase; proration; invoice links; duplicate/lost-return tests |
| R3 | Shared tax quote, discounts, admin tax/plan UX; coordinates with R2 | Matched UI/provider/invoice totals; location changes; last-use concurrency |
| R4 | Requests/workroom/contracts/messages/discovery/profile consistency | Both-role recordings; withdrawal reason/notification; signed snapshot and PDF |
| R5 | Accounts, permissions, jobs, CMS, existing managed_intro configuration | UI persistence; retry fixture; mobile actions; approved fee preview |
| R6 | Provider payout integration and evidence; separate approval gate | Real provider sandbox transfer/payout evidence and reconciliation |
| R7 | Cross-surface regression and release review | Per-issue closure ledger; no unexplained Pass; controlled rollout plan |

Split R4 into focused PRs by page family; it is not one large rewrite. R2 and R3 share one quote/offer contract before frontend work so tax and annual pricing do not diverge. A product owner supplies approved annual and fee amounts; engineering must not infer them from a mockup.

Suggested code entry points are existing components, not mandatory replacements: src/components/account-dialog.tsx; src/components/plans/member-plan-page.tsx; public-plan-page.tsx; plan-checkout.tsx; compare-features.tsx; src/app/admin/plans; src/app/admin/payment-settings; src/app/admin/accounts; src/app/collaboration/work/[fundingId]; src/components/contract-*; src/lib/billing.ts; billing-interval.ts; subscription-renewal.ts; country-tax.ts; tax-configuration.ts; discount-store.ts; contract-document.ts; contract-pdf.ts. Resolve current routes and schema at implementation start because this spec is pinned to the audited commit.

# 17 Acceptance and evidence contract

Every correction has a design check and a behavior check. Screenshot presence alone does not prove state changes. Server success alone does not prove the intended UI is usable. Preserve the original failed evidence alongside the corrected result.

## Mandatory test set

- Layout: 1440px and 1280px desktop; 768px tablet; 390px and 360px mobile. Test long names, empty tables, validation errors, slow requests and translated-length labels. Include both the underlying list and the open popup. Check 200% zoom and keyboard-only use.
- Billing: guest/new account, free member, monthly subscriber, annual subscriber and past-due state; selected interval survives auth/back; upgrade preview, scheduled change, cancellation reversal; provider customer/subscription/item/price references correct.
- Money: 29.00 - 4.35 + 2.03 = 26.68 example; explicit zero tax; missing rule; regional address change; annual amount; fixed and percentage discount; expired code; concurrent last use; invoice/quote reconciliation. Sample fixture rates are not live configuration.
- Reliability: customer does not return after payment; provider event repeated; return races webhook; delayed event; abandoned checkout; PDF delayed; notification delivery retry; no duplicated charge, entitlement, redemption or withdrawal.
- Collaboration: draft/published request, pending/accepted invite, signed/funded deal, withdrawal reason, concurrent acceptance, versioned revision and approval, permitted cancellation, private participants and unauthorized access.
- Documents and messages: stable signed bytes, correct parties, no tokens or flattened tables, working tenant-authorized PDF; send/reply/attachment failure and retry; durable notifications to the mail sink.

## Required PR evidence bundle

Include source commit and build, environment/isolation summary, fixture identifiers without secrets, expected and observed result per step, desktop/mobile states, relevant short recording, persistence readback, actual provider test IDs and amounts where applicable, notification capture, remaining limitations and rollback instructions. Distinguish manual/harness execution from product behavior. A normal return API verification is not labelled webhook delivery without event evidence.

Use Pass only when all required branches in the stated scope pass. A monthly pass and annual fail produce a Partial aggregate unless the row is explicitly scoped to monthly. A known provider dependency remains Partial, not a fictitious permanent pass. Test fixture setup is allowed but must not repair outcomes being tested. CI success complements these checks and does not replace them.

## Release decision

Close each register item only against its own retest. Keep P0 security and unproven live money paths as release gates. Release UI and eligible subscription improvements through controlled rollout with preserved prior state; do not enable provider capabilities as a side effect. Agency remains deferred. Ola reviews this design pack before implementation starts.

# 18 Sources and handoff notes

## Audit evidence

PR: https://github.com/getnuevetech/Influrios/pull/534

Pinned baseline: db64224ec9420d55df2641d93c8ba3f678585d1c. Read docs/e2e-audit/final-coverage-report.md, correction-register.md, phase1-acceptance-matrix.json, j18-j20-complete-results.json and j18-j20-postpay-probe.json at that commit. The monthly quote, invoice, PDF and recording are in docs/e2e-audit/media-local-journeys-closure. Evidence inspection supports the monthly results described in section 1; it is not a fresh execution of all 30 journeys.

The atlas uses illustrative records and future annual values. The original card reference is reproduced from the public card audit capture solely to specify preservation and placement. No customer payment screenshots or credentials are included in the deliverables.

## Provider reference checks

Stripe fulfillment: https://docs.stripe.com/checkout/fulfillment.md?ui=full-page

Stripe advises webhook-based fulfillment because customers may not reach the return page; both return and webhook can call an idempotent completion function. This informs the R2 lost-return and duplicate-event tests.

Stripe subscription price changes: https://docs.stripe.com/billing/subscriptions/change-price

Updating the intended subscription item requires its identity and replacement price. An omitted existing item can add another item. This supports retaining subscription/item/price IDs and testing upgrades against the existing subscription.

Stripe tax rates: https://docs.stripe.com/tax/tax-rates

Configured tax rates and automatic tax calculation are different integration choices. This specification requires a single authority per transaction and no duplicate tax addition. Real jurisdiction rates, exceptions and registrations are operational configuration inputs, not values inferred from these mockups.

References checked 19 November 2026. Verify the repository's pinned provider API version before implementation. The document specifies product behavior and engineering acceptance; it does not draft legal agreement clauses or determine tax obligations.

## Dev AI first action after design approval

Create an implementation checklist that maps each source ID to the relevant section, atlas board, component and retest. Reuse working popup and checkout components. Preserve the audit baseline and monthly transaction regression. Submit R0 and the shared R1 foundation as separate reviewable changes before dependent page rewrites. Do not merge, deploy, notify real customers, change live rates or open live deposits without the appropriate authorization.
