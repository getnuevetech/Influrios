# Blocked-check register (IPS-28)

**Purpose:** Account for every **Blocked** row in the full-platform coverage matrix so env/fixture gates cannot vanish into Pass.
**Source matrix:** [coverage-matrix.md](./coverage-matrix.md) (Blocked = **80**; IPS-40 audit-continue).
**Execution narratives:** [execution/](./execution/) (`auth|collab|billing|admin|not-tested-chase|mail-sink-restore|audit-continue-alongside-design`-results.md).
**Policy:** Do **not** enable live collaboration deposits (`journey_funding`) merely to clear audit counts. Prefer isolated staging + Mailpit / `MAIL_SINK_TO`.
**Baseline:** Phase B live host; deposits closed; Agency Explicitly deferred.

## Summary

| Metric | Value |
|--------|------:|
| Blocked rows accounted for | **80** |
| Matrix Blocked (authoritative) | 80 |
| Match | YES |

### By blocker cluster

| Cluster | Count | Owner (default) |
|---------|------:|-----------------|
| `MAIL_SINK` | 0 | — cleared IPS-40 (claim draft + notify kinds Pass on isolated host) |
| `UI_FIXTURE_GAP` | 19 | Collaboration / product surface owner (fixture state) |
| `DASHBOARD_CONSISTENCY_FIXTURE` | 3 | Collaboration QA (IPS-29 INV-DC-010/013/014) |
| `DEPOSITS_CLOSED_AND_MAIL_SINK` | 14 | Payments (event) + Platform Ops (sink) |
| `DEPOSITS_CLOSED` | 13 | Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts |
| `EVENT_NOT_FIREABLE` | 10 | Collaboration / Trust & disputes + Payments ops |
| `DEEP_LINK_FIXTURE` | 5 | Collaboration QA / fixture owner |
| `FEATURE_GATE` | 2 | Platform Admin (product switches) + Collaboration |
| `INQUIRY_FIXTURE` | 2 | Collaboration / Discovery fixture owner |
| `PENDING_SIGN_FIXTURE` | 2 | Collaboration QA / fixture owner |
| `PROVIDER_OAUTH` | 2 | Integrations (Meta / social OAuth) |
| `DEMO_GATE` | 1 | Discovery / public_pages_live ops |
| `DESTRUCTIVE_FIXTURE` | 1 | Collaboration QA (isolated fixture) |
| `JOB_NOT_ENQUEUED` | 1 | Platform Ops (jobs) + Collaboration invite |
| `NO_TRIGGER` | 1 | Platform / Admin UX |
| `PAYOUT_RISK` | 1 | Payments / Collaboration (isolated release fixture) |
| `SHARED_HOST_ISOLATION` | 1 | Platform Ops (cron isolation) |
| `SMS_PROVIDER` | 1 | Integrations / Platform Ops (SMS) |
| `TOKEN_FIXTURE` | 1 | Collaboration invite fixture owner |

### By inventory prefix

| Prefix | Count |
|--------|------:|
| INV-A-* | 28 |
| INV-C-* | 2 |
| INV-DC-* | 3 |
| INV-E-* | 14 |
| INV-I-* | 2 |
| INV-J-* | 3 |
| INV-N-* | 17 |
| INV-P-* | 4 |
| INV-R-* | 5 |
| INV-T-* | 2 |

## Controllable test infrastructure

### Mail sink — Mailpit / `MAIL_SINK` / `MAIL_SINK_TO`

**IPS-31 restored isolated Mailpit**; **IPS-40** cleared remaining MAIL_SINK claim-draft (6) + notify-kind (9) on isolated host — cluster **0**. Live Phase B still has no Mailpit UI — do not treat live SMTP 250 as sink proof. Deposit+mail combo (14) stays Blocked (mail portion proven; money event closed).

#### Local / isolated staging (preferred)

1. Run Mailpit (SMTP **1025**, UI/API **8025**), e.g. `docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit`.
2. Point app mail settings at sink (see `scripts/e2e-audit/seed-local-fixtures.ts`): host `127.0.0.1`, port `1025`, empty auth, `fromAddress` audit-local.
3. Set harness env: `MAILPIT_API=http://127.0.0.1:8025` (scripts default). Optional allowlist: `MAIL_SINK_TO=<audit-only-address>`.
4. Seed synthetic fixtures (`seed-local-fixtures.ts`) with `@example.com` / AUDIT_* members.
5. Prove interception: Admin → Mail → Send test **or** journey trigger → Mailpit `/api/v1/messages` shows message; capture screenshot/JSON.
6. Acceptance: job SUCCEEDED **and** sink message present for expected template — never mark Pass on SMTP 250 alone.

#### Live production host (constrained)

| Control | Rule |
|---------|------|
| `MAIL_SINK_TO` | If set, must be allowlisted **AUDIT_*** mailbox only |
| Customer addresses | **Forbidden** for audit sends |
| Mailpit UI | Not available on live — treat delivery as Blocked until staging sink |
| SMTP test | Allowed for Ready proof; does not close INV-E-* Pass |
| Isolation | Require `AUDIT_ISOLATION_CONFIRMED=1` before invite/reset/claim verify mutations that email |

Historical local proof pattern: `docs/e2e-audit/mail-sink-proof.md`, `docs/e2e-audit/isolation-evidence.md` (Mailpit `1025`/`8025`).

#### Rows unlocked by mail-sink restore (retest batch)

Count touching mail sink: **99** (includes combo deposit+sink). **IPS-31:** 70 Pass · 15 remaining. **IPS-40:** remaining 15 → Pass (claim draft + notify kinds). Combo **14** still Blocked. Evidence: [execution/mail-sink-restore-results.md](./execution/mail-sink-restore-results.md), [execution/audit-continue-alongside-design-results.md](./execution/audit-continue-alongside-design-results.md).

### Other controllable infrastructure

| Infra | Restore / use | Do not |
|-------|---------------|--------|
| **Deposits / `journey_funding`** | Isolated staging with test Stripe only | Reopen live production deposits to clear Blocked counts |
| **Stripe test keys** | Sandbox checkout + ledger hold simulation | Live card charges on shared host |
| **Cron / sweeps** | Staging + `CRON_SECRET`; observe `/admin/jobs` | Fire `subscription_renewal_sweep` / payout retry on shared live customers |
| **Product switches** | Staging-only toggles (`contract_ai_tailor`, `public_pages_live`) | Flip production switches without ops approval |
| **OAuth / Meta** | Sandbox app + test users | Production page tokens / live webhooks without isolation |
| **SMS** | Mock or sandbox provider | Real SMS to member phones |
| **Destructive delete** | Disposable AUDIT funded request | Delete held production workroom |
| **Dispute / release** | Isolated fixture | Manufacture live disputes or bank payouts |

## Register (every Blocked row)

Field legend: **Blocker** (exact), **Journey**, **Owner**, **Prerequisite**, **Safe test method**, **Acceptance evidence**.

### `MAIL_SINK` (0)

- **Cleared IPS-40 (2026-11-21):** Claim draft path + collab notification kind emails Pass on isolated Mailpit — see [execution/audit-continue-alongside-design-results.md](./execution/audit-continue-alongside-design-results.md). Former rows: `INV-R-017/018/019`, `INV-A-013/014/015`, `INV-N-010…017`, `INV-N-027`.
- Deposit+mail combo remains under `DEPOSITS_CLOSED_AND_MAIL_SINK` (14).

### `UI_FIXTURE_GAP` (19)

- **Default owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-T-009 | P-11 Agreement dialog tabs | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Dialog not fully opened to tabs |
| INV-T-013 | P-15 Payments dialog tabs | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Entry partial; dialog tabs incomplete |
| INV-P-005 | P-15 Collaboration payments dialog | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | View payments entry from workroom; full dialog tabs not fully captured |
| INV-P-012 | P-16 Payout detail dialog | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Automation did not open dialog; deposits closed for new fixtures |
| INV-A-034 | P-07 Refresh campaign suggestions | Required control/CTA not exposed on audit fixture state (or state-gated) | refreshControls=0; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contract |
| INV-A-039 | P-09 Transition marketplace application | Required control/CTA not exposed on audit fixture state (or state-gated) | transitionish=0; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts  |
| INV-A-040 | P-09 Withdraw participation | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Withdraw menuitem not visible; close/archive controls present on requests |
| INV-A-042 | P-07 Request managed match | Required control/CTA not exposed on audit fixture state (or state-gated) | controls=0; text=false |
| INV-A-047 | P-10 Advance collab / queue signature | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Records page reached; advance not mutated |
| INV-A-048 | P-12 Team proposal send/respond | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Team page loads; send/respond not mutated |
| INV-A-053 | P-11 Apply collab discount | Required control/CTA not exposed on audit fixture state (or state-gated) | discountSignals=false |
| INV-A-062 | P-15 Request change order | Required control/CTA not exposed on audit fixture state (or state-gated) | controls=0 |
| INV-A-063 | P-15 Cancel prefund | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Payments needs_funding surface; explicit cancel-prefund CTA not found on held funding |
| INV-A-064 | P-17 Open dispute / add evidence | Required control/CTA not exposed on audit fixture state (or state-gated) | workroom=0; payments=0 |
| INV-A-065 | P-15 Stop series / convert ambassador | Required control/CTA not exposed on audit fixture state (or state-gated) | controls=0; text=false |
| INV-A-066 | P-17 Request cancellation | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | No Request cancellation control found on held workroom/payments for audit fixture |
| INV-A-067 | P-17 Settlement accept/question/dispute | Dialog/mutation path incomplete on fixture — entry partial or CTA absent | Settlement-related workroom copy present; accept/question/dispute not reachable without cancellation case |
| INV-A-069 | P-15 Own-milestone dashboard path | Required control/CTA not exposed on audit fixture state (or state-gated) | Business home lacked distinct own-milestone dashboard funding actions; workroom path is separate INV-A-058..060 |
| INV-A-079 | P-17 Open dispute (trust page) | Required control/CTA not exposed on audit fixture state (or state-gated) | openDispute=0; sample=∞ Influrios Home Discover Categories Collaboration For Businesses Pricing Agboola Log out TRUST &  |

### `DEPOSITS_CLOSED_AND_MAIL_SINK` (14)

- **Default owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-E-042 | P-16/P-17 Email `payout.requested` · `payout.requested` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-043 | P-16/P-17 Email `payout.requested_business` · `payout.requested_business` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-044 | P-16/P-17 Email `payout.confirmed` · `payout.confirmed` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-045 | P-16/P-17 Email `payout.confirmed_business` · `payout.confirmed_business` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-046 | P-16/P-17 Email `payout.failed` · `payout.failed` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-047 | P-16/P-17 Email `payout.failed_admin` · `payout.failed_admin` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-048 | P-16/P-17 Email `payout.retry` · `payout.retry` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-049 | P-16/P-17 Email `payout.returned` · `payout.returned` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-050 | P-16/P-17 Email `payout.returned_business` · `payout.returned_business` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-051 | P-16/P-17 Email `payout.returned_admin` · `payout.returned_admin` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-052 | P-16/P-17 Email `payout.ready` · `payout.ready` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-063 | P-16/P-17 Email `refund.processing` · `refund.processing` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-064 | P-16/P-17 Email `refund.completed_business` · `refund.completed_business` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |
| INV-E-065 | P-16/P-17 Email `refund.completed_influencer` · `refund.completed_influencer` | DEPOSITS_CLOSED_AND_MAIL_SINK: journey money event still closed (journey_funding / no live deposits). Mail sink restored — catalog test send PROVEN; payout/refund journey remains Blocked. | IPS-31: catalog Send-test mail portion PROVEN on Mailpit; deposit/money event still closed — row stays Blocked |

### `DEPOSITS_CLOSED` (13)

- **Default owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-R-030 | P-15 Funding checkout (closed deposits) | Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge | Probe /payments/checkout/ips19-closed-probe → 404; Fund/start-funding paths do not open Stripe Checkout |
| INV-A-052 | P-15 Fund signed agreement | Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge | Fund/start-funding navigates to needs_funding picker; no Stripe charge |
| INV-A-055 | P-15 Create deal | Live collaboration deposits closed (journey_funding) — must not open Stripe charge to clear audit | createish=0; sample=∞ Influrios Dashboard Action inbox Company Profile Discover Creators Collaborations 2 Contracts Anal |
| INV-A-056 | P-15 Open funding checkout | Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge | No live Stripe Checkout; checkout probe 404; start-funding stays on payments |
| INV-A-057 | P-15 Start funding deposit | Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge | Same as INV-A-056 |
| INV-A-068 | P-17 Execute approved refund | Live deposits closed / no refundable or payout-retry fixture; isolation required | Deposits CLOSED / no refundable fixture |
| INV-J-014 | P-16 failed_payout_retry_sweep | Live deposits closed / no refundable or payout-retry fixture; isolation required | Not executed; deposits closed / isolation |
| INV-N-018 | P-15/P-17 Notification `payout_completed` · `payout_completed` | Money-event notification `payout_completed` — deposits closed; cannot fire payout/refund event | Blocked: deposits closed |
| INV-N-019 | P-15/P-17 Notification `payout_failed` · `payout_failed` | Money-event notification `payout_failed` — deposits closed; cannot fire payout/refund event | Blocked: deposits closed |
| INV-N-020 | P-15/P-17 Notification `payout_requested` · `payout_requested` | Money-event notification `payout_requested` — deposits closed; cannot fire payout/refund event | Blocked: deposits closed |
| INV-N-021 | P-15/P-17 Notification `payout_retry` · `payout_retry` | Money-event notification `payout_retry` — deposits closed; cannot fire payout/refund event | Blocked: deposits closed |
| INV-N-022 | P-15/P-17 Notification `payout_returned` · `payout_returned` | Money-event notification `payout_returned` — deposits closed; cannot fire payout/refund event | Blocked: deposits closed |
| INV-N-028 | P-15/P-17 Notification `refund_completed` · `refund_completed` | Money-event notification `refund_completed` — deposits closed; cannot fire payout/refund event | Blocked: deposits closed |

### `EVENT_NOT_FIREABLE` (10)

- **Default owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-N-023 | P-15/P-17 Notification `stale_funding` · `stale_funding` | Kind `stale_funding` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-024 | P-15/P-17 Notification `ledger_mismatch` · `ledger_mismatch` | Kind `ledger_mismatch` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-025 | P-15/P-17 Notification `dispute_opened` · `dispute_opened` | Kind `dispute_opened` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-026 | P-15/P-17 Notification `dispute_resolved` · `dispute_resolved` | Kind `dispute_resolved` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | No dispute_resolved notice in centre (prior Pass was false positive on inbox 'resolved' filter label) |
| INV-N-029 | P-15/P-17 Notification `payment_risk` · `payment_risk` | Kind `payment_risk` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-030 | P-15/P-17 Notification `change_order_accepted` · `change_order_accepted` | Kind `change_order_accepted` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-031 | P-15/P-17 Notification `preexisting_relationship_claimed` · `preexisting_relationship_claimed` | Kind `preexisting_relationship_claimed` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-032 | P-15/P-17 Notification `provider_jurisdiction_limitation` · `provider_jurisdiction_limitation` | Kind `provider_jurisdiction_limitation` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-033 | P-15/P-17 Notification `dispute_sla_reminder` · `dispute_sla_reminder` | Kind `dispute_sla_reminder` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |
| INV-N-034 | P-15/P-17 Notification `provider_hold_period_warning` · `provider_hold_period_warning` | Kind `provider_hold_period_warning` not in centre; cannot fire event (deposits closed / no dispute-ops fixture) | Kind not present in centre/inbox; cannot fire event (deposits closed / no dispute fixture) |

### `DEEP_LINK_FIXTURE` (5)

- **Default owner:** Collaboration QA / fixture owner
- **Prerequisite:** Seeded AUDIT application/opening/record with known ids and /collaboration/.../{id} hrefs
- **Safe test method:** Seed read-only deep links via fixture script; open detail pages; no funded-deal mutation required.
- **Acceptance evidence:** HTTP 200 detail page for seeded id; screenshot; no console/auth error.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-R-061 | P-09 Application detail | No application/opening/record deep-link id on audit business fixture | No /collaboration/applications/{id} on business opportunities |
| INV-R-062 | P-09 Opening detail | No application/opening/record deep-link id on audit business fixture | No /collaboration/openings/{id} link found |
| INV-R-065 | P-10 Record detail | No application/opening/record deep-link id on audit business fixture | list http=200; no /collaboration/records/{id} href on fixture |
| INV-A-029 | P-09 Creator transition application | No application/opening/record deep-link id on audit business fixture | appLinks=0; transitionish=0 |
| INV-A-045 | P-09 Transition application detail | No application/opening/record deep-link id on audit business fixture | Depends on INV-R-061 application id — none on fixture |

### `FEATURE_GATE` (2)

- **Default owner:** Platform Admin (product switches) + Collaboration
- **Prerequisite:** Enable contract_ai_tailor on AUDIT env only + draft contract context
- **Safe test method:** Toggle product switch on staging only; open AI tailor on draft; revert switch after evidence.
- **Acceptance evidence:** AI tailor dialog opens with draft context when gate on; screenshot.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-P-004 | P-11 AI tailor dialog | contract_ai_tailor gate off or no draft context on fixture | AI tailor UI absent — contract_ai_tailor gate off or no draft context |
| INV-A-054 | P-11 AI tailor draft | contract_ai_tailor gate off or no draft context on fixture | AI tailor UI absent — contract_ai_tailor gate off or no draft context |

### `INQUIRY_FIXTURE` (2)

- **Default owner:** Collaboration / Discovery fixture owner
- **Prerequisite:** Business fixture with open inquiry thread + send/reply/decline CTAs (or non-demo Discover shortlist)
- **Safe test method:** Use seeded inquiry or non-demo Discover; avoid mutating real customer shortlists.
- **Acceptance evidence:** Inquiry actions succeed; thread updated; screenshot before/after.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-A-036 | P-07 Inquiry send/reply/decline | No inquiry thread/actions on audit business fixture | inquiryish=0 |
| INV-A-037 | P-07 Advance/shortlist from inquiry | No inquiry thread/actions on audit business fixture | inquiryish=0; shortlist note: Discover demo blocks shortlist (COR-13) |

### `PENDING_SIGN_FIXTURE` (2)

- **Default owner:** Collaboration QA / fixture owner
- **Prerequisite:** Dual-party AUDIT deal in pending-signature state (unsigned native contract)
- **Safe test method:** Create disposable AUDIT unsigned agreement; exercise Sign CTA both sides; do not resign production funded deal.
- **Acceptance evidence:** Sign CTA visible; both parties can complete; agreement status updates; optional sign email in sink.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-R-067 | P-11 Agreement detail/sign | No pending native Sign CTA — audit contracts already signed | List surface Pass; pending Sign CTA absent on funded already-signed deal; dialog open flaky via row click |
| INV-A-050 | P-11 Sign native contract | No pending native Sign CTA — audit contracts already signed | No Sign CTA on audit contracts (already signed for funded workroom) |

### `PROVIDER_OAUTH` (2)

- **Default owner:** Integrations (Meta / social OAuth)
- **Prerequisite:** Sandbox Meta app credentials + test user consent; webhook signing secret
- **Safe test method:** Use Meta test app + sandbox user; capture launch URL + callback without production page tokens.
- **Acceptance evidence:** Launch → consent → callback stores connection; webhook signature accepted for test event.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-I-004 | P-06 Meta webhook | OAuth / Meta provider credentials or consent round-trip unavailable for audit | No signed Meta test event |
| INV-I-005 | P-06 Social OAuth launch/callback | OAuth / Meta provider credentials or consent round-trip unavailable for audit | No /api/social/launch href in panel; headless consent not completed |

### `DEMO_GATE` (1)

- **Default owner:** Discovery / public_pages_live ops
- **Prerequisite:** public_pages_live on for AUDIT env OR dedicated Discover fixture with unpublished vs published profiles
- **Safe test method:** Enable public_pages_live on staging OR document demo mode and retest unpublished hide there.
- **Acceptance evidence:** Unpublished profile absent from live Discover when public_pages_live on.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-C-013 | P-05 Unpublished profile Discover gate | public_pages_live off — Discover is Sample directory demo; unpublished-vs-live gating not validatable | Cannot validate: Discover is Sample directory demo (public_pages_live off) — live publish gating not observable |

### `DESTRUCTIVE_FIXTURE` (1)

- **Default owner:** Collaboration QA (isolated fixture)
- **Prerequisite:** Disposable signed/funded AUDIT request (not production held workroom)
- **Safe test method:** Attempt delete on disposable funded AUDIT request; expect protect/deny; never delete live held workroom.
- **Acceptance evidence:** Delete denied/protected on signed/funded request with clear UI/error; fixture remains.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-C-015 | P-09 Delete signed/funded request protect | Delete control present but must not mutate production funded fixture | deleteControls=6; did not mutate funded fixture — protection observed as UI absence or would need destructive probe |

### `JOB_NOT_ENQUEUED` (1)

- **Default owner:** Platform Ops (jobs) + Collaboration invite
- **Prerequisite:** Enqueue invitation_email via invite mutation on AUDIT fixture (mail sink preferred)
- **Safe test method:** Send AUDIT invite (sink mailbox); confirm invitation_email appears on /admin/jobs and SUCCEEDS.
- **Acceptance evidence:** Kind listed; latest run SUCCEEDED; evidence on /admin/jobs.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-J-001 | P-08 invitation_email job | invitation_email kind not listed on /admin/jobs until enqueued | invitation_email listed=false; invitation-ish=true |

### `NO_TRIGGER` (1)

- **Default owner:** Platform / Admin UX
- **Prerequisite:** Deterministic NoticeDialog trigger path or admin force-open harness
- **Safe test method:** Force-open via known admin/notice path or component harness; do not spam live users with notices.
- **Acceptance evidence:** NoticeDialog opens via documented trigger; form usable; dismiss works.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-P-019 | P-27 NoticeDialog (generic) | NoticeDialog not spontaneously triggered; component not force-opened | No notice dialog spontaneously triggered during chase; component not force-opened |

### `PAYOUT_RISK` (1)

- **Default owner:** Payments / Collaboration (isolated release fixture)
- **Prerequisite:** Isolated funded workroom with approve→release sandbox payout; ledger hold simulation OK
- **Safe test method:** Sandbox approve+release with simulated payout; assert UI success vs payout status separately; no live bank transfer.
- **Acceptance evidence:** Approval saved independently of payout; payout status transitions in sandbox; screenshots of both.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-A-061 | P-16 Approve and release | Full approve+release not executed (payout slice / shared-data risk); deposits closed context | Approve confirm notes payment/release separate; full release not executed (payout slice/risk) |

### `SHARED_HOST_ISOLATION` (1)

- **Default owner:** Platform Ops (cron isolation)
- **Prerequisite:** Dedicated staging host or AUDIT_ISOLATION_CONFIRMED=1 with safe cron secret scope
- **Safe test method:** Trigger renewal sweep only on isolated staging with CRON_SECRET; observe job SUCCEEDED without customer billing side effects.
- **Acceptance evidence:** Job SUCCEEDED on isolated host with timestamp; no unintended renewals on shared customers.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-J-022 | P-22 subscription_renewal_sweep | subscription_renewal_sweep not safe to trigger on shared live host without isolation | Not triggered on shared host |

### `SMS_PROVIDER` (1)

- **Default owner:** Integrations / Platform Ops (SMS)
- **Prerequisite:** Sandbox SMS provider or explicit SMS mock; never send to real phones
- **Safe test method:** Mock SMS adapter or sandbox credentials; verify queue/job only — no real SMS.
- **Acceptance evidence:** SMS job queued/succeeded in sandbox OR explicit Not applicable with provider-off evidence.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-N-103 | P-27 SMS preferred path · `SMS preferred path` | SMS provider / preferred path not exercised (Twilio not configured for audit send) | Jobs UI mentions SMS queue; no SMS send exercised |

### `TOKEN_FIXTURE` (1)

- **Default owner:** Collaboration invite fixture owner
- **Prerequisite:** Fresh invite token emailed to AUDIT sink mailbox (requires mail sink)
- **Safe test method:** Send invite to AUDIT sink; open `/invite/[token]`; Decline on disposable invite only.
- **Acceptance evidence:** Token page loads; Decline completes; invite state updated.

| ID | Journey / surface | Exact blocker (this row) | Notes from matrix |
|----|-------------------|--------------------------|-------------------|
| INV-A-031 | P-08 Decline invite (token page) | No valid live invite token for audit mailbox this run | No valid live invite token for audit mailbox this run |

## Per-row checklist (owner · prereq · safe · acceptance)

Each row inherits cluster defaults above; overrides only where the exact blocker text differs.

### INV-R-017

- **Exact blocker:** Claim draft + mail sink required; Mailpit/MAIL_SINK unavailable on live
- **Affected journey:** P-01 Claim draft preview
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-R-018

- **Exact blocker:** Claim draft + mail sink required; Mailpit/MAIL_SINK unavailable on live
- **Affected journey:** P-01/P-02 Claim verify
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-R-019

- **Exact blocker:** Claim draft + mail sink required; Mailpit/MAIL_SINK unavailable on live
- **Affected journey:** P-01 Claim publish
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-R-030

- **Exact blocker:** Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge
- **Affected journey:** P-15 Funding checkout (closed deposits)
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.
- **Existing evidence (partial):** `media/full-platform-audit/collab/desktop/business-checkout-probe.png`

### INV-R-061

- **Exact blocker:** No application/opening/record deep-link id on audit business fixture
- **Affected journey:** P-09 Application detail
- **Responsible owner:** Collaboration QA / fixture owner
- **Prerequisite:** Seeded AUDIT application/opening/record with known ids and /collaboration/.../{id} hrefs
- **Safe test method:** Seed read-only deep links via fixture script; open detail pages; no funded-deal mutation required.
- **Acceptance evidence needed:** HTTP 200 detail page for seeded id; screenshot; no console/auth error.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-r-061-062-opps.png`

### INV-R-062

- **Exact blocker:** No application/opening/record deep-link id on audit business fixture
- **Affected journey:** P-09 Opening detail
- **Responsible owner:** Collaboration QA / fixture owner
- **Prerequisite:** Seeded AUDIT application/opening/record with known ids and /collaboration/.../{id} hrefs
- **Safe test method:** Seed read-only deep links via fixture script; open detail pages; no funded-deal mutation required.
- **Acceptance evidence needed:** HTTP 200 detail page for seeded id; screenshot; no console/auth error.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-r-061-062-opps.png`

### INV-R-065

- **Exact blocker:** No application/opening/record deep-link id on audit business fixture
- **Affected journey:** P-10 Record detail
- **Responsible owner:** Collaboration QA / fixture owner
- **Prerequisite:** Seeded AUDIT application/opening/record with known ids and /collaboration/.../{id} hrefs
- **Safe test method:** Seed read-only deep links via fixture script; open detail pages; no funded-deal mutation required.
- **Acceptance evidence needed:** HTTP 200 detail page for seeded id; screenshot; no console/auth error.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-r-065-records-list.png`

### INV-R-067

- **Exact blocker:** No pending native Sign CTA — audit contracts already signed
- **Affected journey:** P-11 Agreement detail/sign
- **Responsible owner:** Collaboration QA / fixture owner
- **Prerequisite:** Dual-party AUDIT deal in pending-signature state (unsigned native contract)
- **Safe test method:** Create disposable AUDIT unsigned agreement; exercise Sign CTA both sides; do not resign production funded deal.
- **Acceptance evidence needed:** Sign CTA visible; both parties can complete; agreement status updates; optional sign email in sink.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-contract-open.png`

### INV-T-009

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-11 Agreement dialog tabs
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-contract-open.png`

### INV-T-013

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-15 Payments dialog tabs
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-payments-detail.png`

### INV-P-004

- **Exact blocker:** contract_ai_tailor gate off or no draft context on fixture
- **Affected journey:** P-11 AI tailor dialog
- **Responsible owner:** Platform Admin (product switches) + Collaboration
- **Prerequisite:** Enable contract_ai_tailor on AUDIT env only + draft contract context
- **Safe test method:** Toggle product switch on staging only; open AI tailor on draft; revert switch after evidence.
- **Acceptance evidence needed:** AI tailor dialog opens with draft context when gate on; screenshot.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-c-009-ai-tailor.png`

### INV-P-005

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-15 Collaboration payments dialog
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-payments-detail.png`

### INV-P-012

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-16 Payout detail dialog
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/billing/55b-payout-detail.png`

### INV-P-019

- **Exact blocker:** NoticeDialog not spontaneously triggered; component not force-opened
- **Affected journey:** P-27 NoticeDialog (generic)
- **Responsible owner:** Platform / Admin UX
- **Prerequisite:** Deterministic NoticeDialog trigger path or admin force-open harness
- **Safe test method:** Force-open via known admin/notice path or component harness; do not spam live users with notices.
- **Acceptance evidence needed:** NoticeDialog opens via documented trigger; form usable; dismiss works.

### INV-A-004

- **Exact blocker:** Mailbox interception (Mailpit/MAIL_SINK) unavailable on live for OTP/reset/claim verify delivery
- **Affected journey:** P-02 Verify OTP complete
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/auth/inv-a-004-verify-page.png`

### INV-A-005

- **Exact blocker:** Mailbox interception (Mailpit/MAIL_SINK) unavailable on live for OTP/reset/claim verify delivery
- **Affected journey:** P-02 Password reset complete
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/auth/inv-a-005-*.png; retest-INV-A-005-reset-mobile.png`

### INV-A-013

- **Exact blocker:** Claim draft + mail sink required; Mailpit/MAIL_SINK unavailable on live
- **Affected journey:** P-01 Claim draft email verify
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-A-014

- **Exact blocker:** Claim draft + mail sink required; Mailpit/MAIL_SINK unavailable on live
- **Affected journey:** P-01 Claim draft publish
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-A-015

- **Exact blocker:** Claim draft + mail sink required; Mailpit/MAIL_SINK unavailable on live
- **Affected journey:** P-01/P-06 Claim draft social
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-A-029

- **Exact blocker:** No application/opening/record deep-link id on audit business fixture
- **Affected journey:** P-09 Creator transition application
- **Responsible owner:** Collaboration QA / fixture owner
- **Prerequisite:** Seeded AUDIT application/opening/record with known ids and /collaboration/.../{id} hrefs
- **Safe test method:** Seed read-only deep links via fixture script; open detail pages; no funded-deal mutation required.
- **Acceptance evidence needed:** HTTP 200 detail page for seeded id; screenshot; no console/auth error.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-029-transition.png`

### INV-A-031

- **Exact blocker:** No valid live invite token for audit mailbox this run
- **Affected journey:** P-08 Decline invite (token page)
- **Responsible owner:** Collaboration invite fixture owner
- **Prerequisite:** Fresh invite token emailed to AUDIT sink mailbox (requires mail sink)
- **Safe test method:** Send invite to AUDIT sink; open `/invite/[token]`; Decline on disposable invite only.
- **Acceptance evidence needed:** Token page loads; Decline completes; invite state updated.

### INV-A-034

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-07 Refresh campaign suggestions
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-034-refresh.png`

### INV-A-036

- **Exact blocker:** No inquiry thread/actions on audit business fixture
- **Affected journey:** P-07 Inquiry send/reply/decline
- **Responsible owner:** Collaboration / Discovery fixture owner
- **Prerequisite:** Business fixture with open inquiry thread + send/reply/decline CTAs (or non-demo Discover shortlist)
- **Safe test method:** Use seeded inquiry or non-demo Discover; avoid mutating real customer shortlists.
- **Acceptance evidence needed:** Inquiry actions succeed; thread updated; screenshot before/after.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-036-inquiry.png`

### INV-A-037

- **Exact blocker:** No inquiry thread/actions on audit business fixture
- **Affected journey:** P-07 Advance/shortlist from inquiry
- **Responsible owner:** Collaboration / Discovery fixture owner
- **Prerequisite:** Business fixture with open inquiry thread + send/reply/decline CTAs (or non-demo Discover shortlist)
- **Safe test method:** Use seeded inquiry or non-demo Discover; avoid mutating real customer shortlists.
- **Acceptance evidence needed:** Inquiry actions succeed; thread updated; screenshot before/after.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-036-inquiry.png`

### INV-A-039

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-09 Transition marketplace application
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-039-transition.png`

### INV-A-040

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-09 Withdraw participation
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-withdraw-menu.png`

### INV-A-042

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-07 Request managed match
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-042-match.png`

### INV-A-045

- **Exact blocker:** No application/opening/record deep-link id on audit business fixture
- **Affected journey:** P-09 Transition application detail
- **Responsible owner:** Collaboration QA / fixture owner
- **Prerequisite:** Seeded AUDIT application/opening/record with known ids and /collaboration/.../{id} hrefs
- **Safe test method:** Seed read-only deep links via fixture script; open detail pages; no funded-deal mutation required.
- **Acceptance evidence needed:** HTTP 200 detail page for seeded id; screenshot; no console/auth error.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-r-061-062-opps.png`

### INV-A-047

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-10 Advance collab / queue signature
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/desktop/business-records.png`

### INV-A-048

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-12 Team proposal send/respond
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/desktop/business-team.png`

### INV-A-050

- **Exact blocker:** No pending native Sign CTA — audit contracts already signed
- **Affected journey:** P-11 Sign native contract
- **Responsible owner:** Collaboration QA / fixture owner
- **Prerequisite:** Dual-party AUDIT deal in pending-signature state (unsigned native contract)
- **Safe test method:** Create disposable AUDIT unsigned agreement; exercise Sign CTA both sides; do not resign production funded deal.
- **Acceptance evidence needed:** Sign CTA visible; both parties can complete; agreement status updates; optional sign email in sink.
- **Existing evidence (partial):** `media/full-platform-audit/collab/desktop/influencer-contracts-list.png`

### INV-A-052

- **Exact blocker:** Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge
- **Affected journey:** P-15 Fund signed agreement
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-funding-start-result.png`

### INV-A-053

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-11 Apply collab discount
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-053-discount.png`

### INV-A-054

- **Exact blocker:** contract_ai_tailor gate off or no draft context on fixture
- **Affected journey:** P-11 AI tailor draft
- **Responsible owner:** Platform Admin (product switches) + Collaboration
- **Prerequisite:** Enable contract_ai_tailor on AUDIT env only + draft contract context
- **Safe test method:** Toggle product switch on staging only; open AI tailor on draft; revert switch after evidence.
- **Acceptance evidence needed:** AI tailor dialog opens with draft context when gate on; screenshot.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-c-009-ai-tailor.png`

### INV-A-055

- **Exact blocker:** Live collaboration deposits closed (journey_funding) — must not open Stripe charge to clear audit
- **Affected journey:** P-15 Create deal
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-055-create-deal.png`

### INV-A-056

- **Exact blocker:** Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge
- **Affected journey:** P-15 Open funding checkout
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-funding-start-result.png`

### INV-A-057

- **Exact blocker:** Live new deposits closed (INV-C-001 / journey_funding) — checkout must not open Stripe charge
- **Affected journey:** P-15 Start funding deposit
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-funding-gate-copy.png`

### INV-A-061

- **Exact blocker:** Full approve+release not executed (payout slice / shared-data risk); deposits closed context
- **Affected journey:** P-16 Approve and release
- **Responsible owner:** Payments / Collaboration (isolated release fixture)
- **Prerequisite:** Isolated funded workroom with approve→release sandbox payout; ledger hold simulation OK
- **Safe test method:** Sandbox approve+release with simulated payout; assert UI success vs payout status separately; no live bank transfer.
- **Acceptance evidence needed:** Approval saved independently of payout; payout status transitions in sandbox; screenshots of both.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/cor23-approve-after-click.png`

### INV-A-062

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-15 Request change order
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-062-change-order.png`

### INV-A-063

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-15 Cancel prefund
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-payments.png`

### INV-A-064

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-17 Open dispute / add evidence
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-064-dispute.png`

### INV-A-065

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-15 Stop series / convert ambassador
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-065-series.png`

### INV-A-066

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-17 Request cancellation
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/biz-payments-detail.png; media/full-platform-audit/collab/desktop/business-cancel-surface.png`

### INV-A-067

- **Exact blocker:** Dialog/mutation path incomplete on fixture — entry partial or CTA absent
- **Affected journey:** P-17 Settlement accept/question/dispute
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/collab/results.tsv`

### INV-A-068

- **Exact blocker:** Live deposits closed / no refundable or payout-retry fixture; isolation required
- **Affected journey:** P-17 Execute approved refund
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-A-069

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-15 Own-milestone dashboard path
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-069-dashboard.png`

### INV-A-079

- **Exact blocker:** Required control/CTA not exposed on audit fixture state (or state-gated)
- **Affected journey:** P-17 Open dispute (trust page)
- **Responsible owner:** Collaboration / product surface owner (fixture state)
- **Prerequisite:** Fixture advanced to the state that exposes the CTA/dialog; or isolated clone of production-like deal
- **Safe test method:** Advance disposable fixture state; screenshot CTA + dialog; skip destructive paths on shared live data.
- **Acceptance evidence needed:** CTA visible; dialog/tabs complete; mutation persisted (or explicit deny) with evidence.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-a-079-trust.png`

### INV-J-001

- **Exact blocker:** invitation_email kind not listed on /admin/jobs until enqueued
- **Affected journey:** P-08 invitation_email job
- **Responsible owner:** Platform Ops (jobs) + Collaboration invite
- **Prerequisite:** Enqueue invitation_email via invite mutation on AUDIT fixture (mail sink preferred)
- **Safe test method:** Send AUDIT invite (sink mailbox); confirm invitation_email appears on /admin/jobs and SUCCEEDS.
- **Acceptance evidence needed:** Kind listed; latest run SUCCEEDED; evidence on /admin/jobs.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-j-001-jobs-detail.png`

### INV-J-002

- **Exact blocker:** Mailbox interception (Mailpit/MAIL_SINK) unavailable on live for OTP/reset/claim verify delivery
- **Affected journey:** P-01/P-02 verification_email job
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-J-003

- **Exact blocker:** Mailbox interception (Mailpit/MAIL_SINK) unavailable on live for OTP/reset/claim verify delivery
- **Affected journey:** P-01 claim_verification_email job
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-J-004

- **Exact blocker:** Mailbox interception (Mailpit/MAIL_SINK) unavailable on live for OTP/reset/claim verify delivery
- **Affected journey:** P-02 password_reset_email job
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-J-014

- **Exact blocker:** Live deposits closed / no refundable or payout-retry fixture; isolation required
- **Affected journey:** P-16 failed_payout_retry_sweep
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-J-022

- **Exact blocker:** subscription_renewal_sweep not safe to trigger on shared live host without isolation
- **Affected journey:** P-22 subscription_renewal_sweep
- **Responsible owner:** Platform Ops (cron isolation)
- **Prerequisite:** Dedicated staging host or AUDIT_ISOLATION_CONFIRMED=1 with safe cron secret scope
- **Safe test method:** Trigger renewal sweep only on isolated staging with CRON_SECRET; observe job SUCCEEDED without customer billing side effects.
- **Acceptance evidence needed:** Job SUCCEEDED on isolated host with timestamp; no unintended renewals on shared customers.

### INV-N-010

- **Exact blocker:** In-app partially observed; email delivery of `funding_required` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `funding_required`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-011

- **Exact blocker:** In-app partially observed; email delivery of `funding_successful` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `funding_successful`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-012

- **Exact blocker:** In-app partially observed; email delivery of `funding_failed` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `funding_failed`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-013

- **Exact blocker:** In-app partially observed; email delivery of `milestone_submitted` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `milestone_submitted`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-014

- **Exact blocker:** In-app partially observed; email delivery of `review_deadline_approaching` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `review_deadline_approaching`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-015

- **Exact blocker:** In-app partially observed; email delivery of `revision_requested` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `revision_requested`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-016

- **Exact blocker:** In-app partially observed; email delivery of `milestone_approved` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `milestone_approved`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-017

- **Exact blocker:** In-app partially observed; email delivery of `milestone_auto_approved` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `milestone_auto_approved`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-018

- **Exact blocker:** Money-event notification `payout_completed` — deposits closed; cannot fire payout/refund event
- **Affected journey:** P-15/P-17 Notification `payout_completed`
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-N-019

- **Exact blocker:** Money-event notification `payout_failed` — deposits closed; cannot fire payout/refund event
- **Affected journey:** P-15/P-17 Notification `payout_failed`
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-N-020

- **Exact blocker:** Money-event notification `payout_requested` — deposits closed; cannot fire payout/refund event
- **Affected journey:** P-15/P-17 Notification `payout_requested`
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-N-021

- **Exact blocker:** Money-event notification `payout_retry` — deposits closed; cannot fire payout/refund event
- **Affected journey:** P-15/P-17 Notification `payout_retry`
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-N-022

- **Exact blocker:** Money-event notification `payout_returned` — deposits closed; cannot fire payout/refund event
- **Affected journey:** P-15/P-17 Notification `payout_returned`
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-N-023

- **Exact blocker:** Kind `stale_funding` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `stale_funding`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-024

- **Exact blocker:** Kind `ledger_mismatch` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `ledger_mismatch`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-025

- **Exact blocker:** Kind `dispute_opened` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `dispute_opened`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-026

- **Exact blocker:** Kind `dispute_resolved` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `dispute_resolved`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-027

- **Exact blocker:** In-app partially observed; email delivery of `collaboration_cancelled` unproven — no Mailpit on live
- **Affected journey:** P-15/P-17 Notification `collaboration_cancelled`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/collab/manual/inf-inbox-tasks.png`

### INV-N-028

- **Exact blocker:** Money-event notification `refund_completed` — deposits closed; cannot fire payout/refund event
- **Affected journey:** P-15/P-17 Notification `refund_completed`
- **Responsible owner:** Payments / Collaboration (R6) — ops gate only; do not reopen for audit counts
- **Prerequisite:** Isolated sandbox with journey_funding enabled for AUDIT tenants only — never reopen live production deposits solely to clear matrix rows
- **Safe test method:** Retest only on isolated sandbox with test Stripe keys. On live production: verify gate copy + checkout 404/refusal only — do not start funding deposits to clear Blocked rows.
- **Acceptance evidence needed:** On sandbox: Checkout session created under test mode + ledger hold. On live: evidence of closed-gate behavior only (404/refusal) — Blocked may remain until sandbox retest.

### INV-N-029

- **Exact blocker:** Kind `payment_risk` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `payment_risk`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-030

- **Exact blocker:** Kind `change_order_accepted` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `change_order_accepted`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-031

- **Exact blocker:** Kind `preexisting_relationship_claimed` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `preexisting_relationship_claimed`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-032

- **Exact blocker:** Kind `provider_jurisdiction_limitation` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `provider_jurisdiction_limitation`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-033

- **Exact blocker:** Kind `dispute_sla_reminder` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `dispute_sla_reminder`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-N-034

- **Exact blocker:** Kind `provider_hold_period_warning` not in centre; cannot fire event (deposits closed / no dispute-ops fixture)
- **Affected journey:** P-15/P-17 Notification `provider_hold_period_warning`
- **Responsible owner:** Collaboration / Trust & disputes + Payments ops
- **Prerequisite:** Isolated dispute/ops/ledger fixture that emits the kind without affecting live customers
- **Safe test method:** Fire kind on isolated fixture; confirm centre row + optional email in Mailpit; no live dispute manufacture.
- **Acceptance evidence needed:** Centre shows kind after fire; optional email in Mailpit; kind id matches inventory.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-n-kinds-centre.png`

### INV-E-001

- **Exact blocker:** Template `account.verify` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.verify`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-002

- **Exact blocker:** Template `account.card_verify` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.card_verify`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-003

- **Exact blocker:** Template `account.reset` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.reset`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-004

- **Exact blocker:** Template `account.admin_setup` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.admin_setup`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-005

- **Exact blocker:** Template `account.claim` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.claim`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-006

- **Exact blocker:** Template `account.claim_followup` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.claim_followup`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-007

- **Exact blocker:** Template `account.welcome_influencer` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.welcome_influencer`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-008

- **Exact blocker:** Template `account.welcome_business` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.welcome_business`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-009

- **Exact blocker:** Template `account.password_changed` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-01/P-02 Email `account.password_changed`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-011

- **Exact blocker:** Template `invite.collaboration` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.collaboration`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-012

- **Exact blocker:** Template `invite.private_campaign` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.private_campaign`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-013

- **Exact blocker:** Template `invite.accepted` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.accepted`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-014

- **Exact blocker:** Template `invite.declined` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.declined`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-015

- **Exact blocker:** Template `invite.team_sent` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.team_sent`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-016

- **Exact blocker:** Template `invite.team_accepted` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.team_accepted`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-017

- **Exact blocker:** Template `invite.team_declined` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.team_declined`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-018

- **Exact blocker:** Template `invite.team_expired` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-08/P-12 Email `invite.team_expired`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-019

- **Exact blocker:** Template `contract.sign` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.sign`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-020

- **Exact blocker:** Template `contract.progress` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.progress`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-021

- **Exact blocker:** Template `contract.reminder` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.reminder`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-022

- **Exact blocker:** Template `contract.signed_business` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.signed_business`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-023

- **Exact blocker:** Template `contract.signed_influencer` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.signed_influencer`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-024

- **Exact blocker:** Template `contract.declined` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.declined`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-025

- **Exact blocker:** Template `contract.voided` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.voided`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-026

- **Exact blocker:** Template `contract.message` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.message`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-027

- **Exact blocker:** Template `contract.quote_expiring` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.quote_expiring`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-028

- **Exact blocker:** Template `contract.change_requested` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.change_requested`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-029

- **Exact blocker:** Template `contract.change_accepted` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-11 Email `contract.change_accepted`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-030

- **Exact blocker:** Template `funding.required` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `funding.required`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-031

- **Exact blocker:** Template `funding.open` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `funding.open`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-032

- **Exact blocker:** Template `funding.processing` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `funding.processing`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-033

- **Exact blocker:** Template `funding.confirmed_business` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `funding.confirmed_business`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-034

- **Exact blocker:** Template `funding.confirmed_influencer` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `funding.confirmed_influencer`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-035

- **Exact blocker:** Template `funding.failed` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `funding.failed`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-036

- **Exact blocker:** Template `funding.expired` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `funding.expired`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-037

- **Exact blocker:** Template `milestone.submitted` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `milestone.submitted`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-038

- **Exact blocker:** Template `milestone.review_reminder` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `milestone.review_reminder`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-039

- **Exact blocker:** Template `milestone.revision` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `milestone.revision`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-040

- **Exact blocker:** Template `milestone.approved` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `milestone.approved`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-041

- **Exact blocker:** Template `milestone.auto_approved` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-15 Email `milestone.auto_approved`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-042

- **Exact blocker:** Template `payout.requested` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.requested`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-043

- **Exact blocker:** Template `payout.requested_business` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.requested_business`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-044

- **Exact blocker:** Template `payout.confirmed` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.confirmed`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-045

- **Exact blocker:** Template `payout.confirmed_business` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.confirmed_business`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-046

- **Exact blocker:** Template `payout.failed` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.failed`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-047

- **Exact blocker:** Template `payout.failed_admin` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.failed_admin`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-048

- **Exact blocker:** Template `payout.retry` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.retry`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-049

- **Exact blocker:** Template `payout.returned` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.returned`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-050

- **Exact blocker:** Template `payout.returned_business` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.returned_business`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-051

- **Exact blocker:** Template `payout.returned_admin` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.returned_admin`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-052

- **Exact blocker:** Template `payout.ready` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `payout.ready`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-053

- **Exact blocker:** Template `dispute.opened` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `dispute.opened`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-054

- **Exact blocker:** Template `dispute.opened_admin` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `dispute.opened_admin`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-055

- **Exact blocker:** Template `dispute.resolved` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `dispute.resolved`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-056

- **Exact blocker:** Template `dispute.response_reminder` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `dispute.response_reminder`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-057

- **Exact blocker:** Template `dispute.overdue_admin` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `dispute.overdue_admin`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-058

- **Exact blocker:** Template `cancellation.review` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `cancellation.review`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-059

- **Exact blocker:** Template `cancellation.request_received` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `cancellation.request_received`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-060

- **Exact blocker:** Template `cancellation.review_admin` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `cancellation.review_admin`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-061

- **Exact blocker:** Template `cancellation.waiting_payout` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `cancellation.waiting_payout`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-062

- **Exact blocker:** Template `cancellation.completed` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** P-17 Email `cancellation.completed`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-063

- **Exact blocker:** Template `refund.processing` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `refund.processing`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-064

- **Exact blocker:** Template `refund.completed_business` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `refund.completed_business`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-065

- **Exact blocker:** Template `refund.completed_influencer` needs money event + Mailpit/MAIL_SINK; deposits remain closed
- **Affected journey:** P-16/P-17 Email `refund.completed_influencer`
- **Responsible owner:** Payments (event) + Platform Ops (sink)
- **Prerequisite:** Isolated funding sandbox + Mailpit/MAIL_SINK; synthetic AUDIT deal; no live customer money
- **Safe test method:** Sandbox funding event under test Stripe + Mailpit capture. On live: leave Blocked; probe refusal paths only.
- **Acceptance evidence needed:** Sandbox money event + Mailpit message for template; job SUCCEEDED; AUDIT recipient only.

### INV-E-066

- **Exact blocker:** Template `payment.risk` catalog-mapped; delivery blocked without mail sink (do not use live customer mail)
- **Affected journey:** P-22 Email `payment.risk`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-067

- **Exact blocker:** Template `payment.activation_receipt` catalog-mapped; delivery blocked without mail sink (do not use live customer mail)
- **Affected journey:** P-22 Email `payment.activation_receipt`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-068

- **Exact blocker:** Template `ops.relationship_claim` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** Email catalog `ops.relationship_claim`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-069

- **Exact blocker:** Template `ops.route_blocked` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** Email catalog `ops.route_blocked`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-070

- **Exact blocker:** Template `ops.route_blocked_admin` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** Email catalog `ops.route_blocked_admin`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-071

- **Exact blocker:** Template `ops.stale_funding` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** Email catalog `ops.stale_funding`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-072

- **Exact blocker:** Template `ops.ledger_mismatch` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** Email catalog `ops.ledger_mismatch`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-073

- **Exact blocker:** Template `ops.hold_warning` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** Email catalog `ops.hold_warning`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-E-074

- **Exact blocker:** Template `billing.paid` catalog-mapped; delivery blocked without mail sink (do not use live customer mail)
- **Affected journey:** P-22 Email `billing.paid`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-075

- **Exact blocker:** Template `billing.failed` catalog-mapped; delivery blocked without mail sink (do not use live customer mail)
- **Affected journey:** P-22 Email `billing.failed`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-076

- **Exact blocker:** Template `billing.renewal` catalog-mapped; delivery blocked without mail sink (do not use live customer mail)
- **Affected journey:** P-22 Email `billing.renewal`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-077

- **Exact blocker:** Template `billing.cancel_scheduled` catalog-mapped; delivery blocked without mail sink (do not use live customer mail)
- **Affected journey:** P-22 Email `billing.cancel_scheduled`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-078

- **Exact blocker:** Template `billing.ended` catalog-mapped; delivery blocked without mail sink (do not use live customer mail)
- **Affected journey:** P-22 Email `billing.ended`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.

### INV-E-079

- **Exact blocker:** Template `marketing.broadcast` listed or journey-linked; sink-confirmed delivery unavailable on live
- **Affected journey:** Email catalog `marketing.broadcast`
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/05-admin-mail-templates.png; media/full-platform-audit/admin/deep-results.json`

### INV-N-103

- **Exact blocker:** SMS provider / preferred path not exercised (Twilio not configured for audit send)
- **Affected journey:** P-27 SMS preferred path
- **Responsible owner:** Integrations / Platform Ops (SMS)
- **Prerequisite:** Sandbox SMS provider or explicit SMS mock; never send to real phones
- **Safe test method:** Mock SMS adapter or sandbox credentials; verify queue/job only — no real SMS.
- **Acceptance evidence needed:** SMS job queued/succeeded in sandbox OR explicit Not applicable with provider-off evidence.
- **Existing evidence (partial):** `media/full-platform-audit/admin/07-admin-jobs.png`

### INV-I-004

- **Exact blocker:** OAuth / Meta provider credentials or consent round-trip unavailable for audit
- **Affected journey:** P-06 Meta webhook
- **Responsible owner:** Integrations (Meta / social OAuth)
- **Prerequisite:** Sandbox Meta app credentials + test user consent; webhook signing secret
- **Safe test method:** Use Meta test app + sandbox user; capture launch URL + callback without production page tokens.
- **Acceptance evidence needed:** Launch → consent → callback stores connection; webhook signature accepted for test event.

### INV-I-005

- **Exact blocker:** OAuth / Meta provider credentials or consent round-trip unavailable for audit
- **Affected journey:** P-06 Social OAuth launch/callback
- **Responsible owner:** Integrations (Meta / social OAuth)
- **Prerequisite:** Sandbox Meta app credentials + test user consent; webhook signing secret
- **Safe test method:** Use Meta test app + sandbox user; capture launch URL + callback without production page tokens.
- **Acceptance evidence needed:** Launch → consent → callback stores connection; webhook signature accepted for test event.
- **Existing evidence (partial):** `media/full-platform-audit/auth/inv-a-020-social-panel.png`

### INV-I-019

- **Exact blocker:** SMTP Ready + mail_test SUCCEEDED; Mailpit UI / MAIL_SINK interception unavailable on live
- **Affected journey:** P-27 SMTP / Mailpit sink
- **Responsible owner:** Platform Ops (R5 mail) + Audit harness owner
- **Prerequisite:** Dedicated Mailpit (or MAIL_SINK_TO allowlist) on isolated host; AUDIT_* recipients only; SMTP pointed at sink
- **Safe test method:** Local/staging: Docker Mailpit :1025/:8025; point admin mailSettings host/port at Mailpit; trigger only to AUDIT_* / @example.com; assert via Mailpit API `/api/v1/messages`. Live: set MAIL_SINK_TO to allowlisted audit mailbox only; never customer addresses. SMTP accept alone ≠ Pass.
- **Acceptance evidence needed:** Mailpit (or allowlisted sink) shows message with expected template id/subject; job SUCCEEDED; screenshot of sink UI or API JSON; recipient is AUDIT-only.
- **Existing evidence (partial):** `media/full-platform-audit/admin/06-admin-mail-health.png; media/full-platform-audit/admin/15-admin-mail-after-test.png`

### INV-C-013

- **Exact blocker:** public_pages_live off — Discover is Sample directory demo; unpublished-vs-live gating not validatable
- **Affected journey:** P-05 Unpublished profile Discover gate
- **Responsible owner:** Discovery / public_pages_live ops
- **Prerequisite:** public_pages_live on for AUDIT env OR dedicated Discover fixture with unpublished vs published profiles
- **Safe test method:** Enable public_pages_live on staging OR document demo mode and retest unpublished hide there.
- **Acceptance evidence needed:** Unpublished profile absent from live Discover when public_pages_live on.
- **Existing evidence (partial):** `media/full-platform-audit/auth/retest-P-07-discover-business.png`

### INV-C-015

- **Exact blocker:** Delete control present but must not mutate production funded fixture
- **Affected journey:** P-09 Delete signed/funded request protect
- **Responsible owner:** Collaboration QA (isolated fixture)
- **Prerequisite:** Disposable signed/funded AUDIT request (not production held workroom)
- **Safe test method:** Attempt delete on disposable funded AUDIT request; expect protect/deny; never delete live held workroom.
- **Acceptance evidence needed:** Delete denied/protected on signed/funded request with clear UI/error; fixture remains.
- **Existing evidence (partial):** `media/full-platform-audit/nt-chase/inv-c-015-delete-protect.png`

## ID index (162)

`INV-R-017`, `INV-R-018`, `INV-R-019`, `INV-R-030`, `INV-R-061`, `INV-R-062`, `INV-R-065`, `INV-R-067`, `INV-T-009`, `INV-T-013`, `INV-P-004`, `INV-P-005`, `INV-P-012`, `INV-P-019`, `INV-A-004`, `INV-A-005`, `INV-A-013`, `INV-A-014`, `INV-A-015`, `INV-A-029`, `INV-A-031`, `INV-A-034`, `INV-A-036`, `INV-A-037`, `INV-A-039`, `INV-A-040`, `INV-A-042`, `INV-A-045`, `INV-A-047`, `INV-A-048`, `INV-A-050`, `INV-A-052`, `INV-A-053`, `INV-A-054`, `INV-A-055`, `INV-A-056`, `INV-A-057`, `INV-A-061`, `INV-A-062`, `INV-A-063`, `INV-A-064`, `INV-A-065`, `INV-A-066`, `INV-A-067`, `INV-A-068`, `INV-A-069`, `INV-A-079`, `INV-J-001`, `INV-J-002`, `INV-J-003`, `INV-J-004`, `INV-J-014`, `INV-J-022`, `INV-N-010`, `INV-N-011`, `INV-N-012`, `INV-N-013`, `INV-N-014`, `INV-N-015`, `INV-N-016`, `INV-N-017`, `INV-N-018`, `INV-N-019`, `INV-N-020`, `INV-N-021`, `INV-N-022`, `INV-N-023`, `INV-N-024`, `INV-N-025`, `INV-N-026`, `INV-N-027`, `INV-N-028`, `INV-N-029`, `INV-N-030`, `INV-N-031`, `INV-N-032`, `INV-N-033`, `INV-N-034`, `INV-E-001`, `INV-E-002`, `INV-E-003`, `INV-E-004`, `INV-E-005`, `INV-E-006`, `INV-E-007`, `INV-E-008`, `INV-E-009`, `INV-E-011`, `INV-E-012`, `INV-E-013`, `INV-E-014`, `INV-E-015`, `INV-E-016`, `INV-E-017`, `INV-E-018`, `INV-E-019`, `INV-E-020`, `INV-E-021`, `INV-E-022`, `INV-E-023`, `INV-E-024`, `INV-E-025`, `INV-E-026`, `INV-E-027`, `INV-E-028`, `INV-E-029`, `INV-E-030`, `INV-E-031`, `INV-E-032`, `INV-E-033`, `INV-E-034`, `INV-E-035`, `INV-E-036`, `INV-E-037`, `INV-E-038`, `INV-E-039`, `INV-E-040`, `INV-E-041`, `INV-E-042`, `INV-E-043`, `INV-E-044`, `INV-E-045`, `INV-E-046`, `INV-E-047`, `INV-E-048`, `INV-E-049`, `INV-E-050`, `INV-E-051`, `INV-E-052`, `INV-E-053`, `INV-E-054`, `INV-E-055`, `INV-E-056`, `INV-E-057`, `INV-E-058`, `INV-E-059`, `INV-E-060`, `INV-E-061`, `INV-E-062`, `INV-E-063`, `INV-E-064`, `INV-E-065`, `INV-E-066`, `INV-E-067`, `INV-E-068`, `INV-E-069`, `INV-E-070`, `INV-E-071`, `INV-E-072`, `INV-E-073`, `INV-E-074`, `INV-E-075`, `INV-E-076`, `INV-E-077`, `INV-E-078`, `INV-E-079`, `INV-N-103`, `INV-I-004`, `INV-I-005`, `INV-I-019`, `INV-C-013`, `INV-C-015`

---

*Generated for IPS-28 from coverage-matrix Blocked rows. Do not flip status to Pass without the acceptance evidence above.*
