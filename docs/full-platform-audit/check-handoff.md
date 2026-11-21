# Remaining checks — runner handoff

**Status:** PROVISIONAL audit. This page assigns an owner and next action to every open check; it does not change any status.
**As of:** 2026-11-21 · matrix IPS-44 (**502 rows · 382 Pass · 29 Fail · 80 Blocked · 1 Not tested · 10 deferred**). Not end-to-end completion.
**Why a handoff:** the session that wrote this page can't reach influrios.com or the isolated host, so it can't run checks. Runs happen in the environments below.

## Runners

| Runner | Environment | Last known operator | Can run now? |
|--------|-------------|---------------------|--------------|
| **ISO** isolated audit host runner | **Now also:** this session's local host (`127.0.0.1:3000`, Postgres :5433 `influrios_audit`, SMTP sink :1025/:8025, harness `scripts/e2e-audit/r5-iso/`). Originally: local app `http://127.0.0.1:3000` · Postgres `influrios_audit` · Mailpit `127.0.0.1:1025/8025` · fixtures `scripts/e2e-audit/seed-local-fixtures.ts` · harness `scripts/e2e-audit/` (IPS-40 setup) | Cursor agent `bc-d672520b-0a72-5f46-ba73-506afca23648` (IPS-40); coordinator: audit package worker `bc-cd0be808-fe9f-5151-9b07-2a30bc90b6cf` | Yes, for rows marked *Ready to run* |
| **PAY** payments sandbox runner (R6) | Provider sandbox with AUDIT tenants only; live deposits stay closed | Not provisioned — Payments owner | No: waits for separate R6 approval |
| **INT** integrations runner | Provider test apps (Meta OAuth, SMS sandbox) | Integrations owner | No: waits for test credentials |
| **LIVE** ops | Live host, read-only verification | Platform ops | After redeploy + rotation (RC-SEC only) |

## Summary

| Runner | Ready to run | Waiting on gate | Total |
|--------|-------------:|----------------:|------:|
| **ISO** isolated audit host runner | 46 | 11 | 57 |
| **PAY** payments sandbox runner (R6) | 0 | 30 | 30 |
| **INT** integrations runner | 0 | 3 | 3 |
| **All checks in this handoff** | | | **90** at handoff (84 Blocked + 6 Not tested); **10 executed IPS-44**, 80 remain |

**Suggested order for ISO:** (1) INV-J-010 then INV-N-017T · (2) INV-N-013T/015T/016T (re-use the INV-A-058/059/060 fixtures) · (3) INV-D-007E · (4) PENDING_SIGN (incl. INV-N-010T) · (5) UI_FIXTURE_GAP · DEEP_LINK · DASHBOARD_CONSISTENCY fixtures · (6) EVENT_NOT_FIREABLE once the dispute/ops/ledger fixture exists.

**Package 1 gating checks (run first among Ready):** INV-DC-010, INV-DC-013, INV-DC-014, INV-A-031, INV-A-048, INV-N-013T, INV-N-015T, INV-N-016T, INV-J-010 (→ INV-N-017T). These are attached to Package 1 acceptance in #540 (`docs/ux-remediation/package-01/README.md`). Payout/provider blockers remain separate.

**Execution status (IPS-44):** the 10 Package 1 gating checks were **executed** on a local isolated host built by this session (`main` @ `5a5f4c0`; see [execution/r5-isolated-package1-results.md](./execution/r5-isolated-package1-results.md)): 4 Pass · 5 Fail · 1 Blocked. **36 ready checks remain** (none executed yet); the same local host and harness (`scripts/e2e-audit/r5-iso/`) can run them.

**Reporting rule:** each run updates the matrix row with evidence path and status. Pass only with the acceptance evidence in [blocked-register.md](./blocked-register.md). Then recount and update [coverage-blocker-report.md](./coverage-blocker-report.md).

## Every open check

| ID | Status | Check | Cluster | Runner | Gate | Next action | Now |
|----|--------|-------|---------|--------|------|-------------|-----|
| INV-R-030 | Blocked | checkout under closed deposits | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-R-061 | Blocked | application detail | `DEEP_LINK_FIXTURE` | **ISO** isolated audit host runner | — | Seed the referenced ids; open the deep link; verify destination + auth | Ready to run |
| INV-R-062 | Blocked | opening detail | `DEEP_LINK_FIXTURE` | **ISO** isolated audit host runner | — | Seed the referenced ids; open the deep link; verify destination + auth | Ready to run |
| INV-R-065 | Blocked | record detail | `DEEP_LINK_FIXTURE` | **ISO** isolated audit host runner | — | Seed the referenced ids; open the deep link; verify destination + auth | Ready to run |
| INV-R-067 | Blocked | agreement detail/sign | `PENDING_SIGN_FIXTURE` | **ISO** isolated audit host runner | — | Create an unsigned dual-party AUDIT agreement; sign both sides; inspect status + emitted notices | Ready to run |
| INV-T-009 | Blocked | agreement dialog tabs | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-T-013 | Blocked | payments dialog tabs | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-P-004 | Blocked | AI tailor dialog | `FEATURE_GATE` | **ISO** isolated audit host runner | — | Toggle the product switch on the isolated host only; execute; restore switch | Ready to run |
| INV-P-005 | Blocked | collaboration-payments-dialog | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-P-012 | Blocked | PayoutDetailDialog | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-P-019 | Blocked | NoticeDialog generic notices | `NO_TRIGGER` | **ISO** isolated audit host runner | — | Add an isolated trigger path per register; execute; inspect | Ready to run |
| INV-A-029 | Blocked | creator transition application | `DEEP_LINK_FIXTURE` | **ISO** isolated audit host runner | — | Seed the referenced ids; open the deep link; verify destination + auth | Ready to run |
| INV-A-031 | Blocked | decline on token page | `TOKEN_FIXTURE` | **ISO** isolated audit host runner | — | Mint an invite token for a disposable AUDIT invitee on the isolated host; open /invite/[token]; **Decline**; reload and prove the decline persisted (token page + invitation record); verify invitation and task counts drop for invitee (home, hub, badge, action inbox) and business (response view) | **Executed IPS-44 → Pass** |
| INV-A-034 | Blocked | refresh campaign suggestions | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-036 | Blocked | Send/reply/decline inquiry | `INQUIRY_FIXTURE` | **ISO** isolated audit host runner | — | Seed an inquiry fixture; execute the journey; inspect record | Ready to run |
| INV-A-037 | Blocked | Advance lead / shortlist from inquiry | `INQUIRY_FIXTURE` | **ISO** isolated audit host runner | — | Seed an inquiry fixture; execute the journey; inspect record | Ready to run |
| INV-A-039 | Blocked | transition marketplace application | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-040 | Blocked | withdraw participation | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-042 | Blocked | request managed match | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-045 | Blocked | transition application detail | `DEEP_LINK_FIXTURE` | **ISO** isolated audit host runner | — | Seed the referenced ids; open the deep link; verify destination + auth | Ready to run |
| INV-A-047 | Blocked | advance collab / queue signature | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-048 | Blocked | team proposal send/respond | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | **Executed IPS-44 → Fail** |
| INV-A-050 | Blocked | sign native contract | `PENDING_SIGN_FIXTURE` | **ISO** isolated audit host runner | — | Create an unsigned dual-party AUDIT agreement; sign both sides; inspect status + emitted notices | Ready to run |
| INV-A-052 | Blocked | fund signed agreement | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-A-053 | Blocked | apply collab discount | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-054 | Blocked | AI tailor draft | `FEATURE_GATE` | **ISO** isolated audit host runner | — | Toggle the product switch on the isolated host only; execute; restore switch | Ready to run |
| INV-A-055 | Blocked | create deal | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-A-056 | Blocked | open funding checkout | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-A-057 | Blocked | start funding deposit | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-A-061 | Blocked | approve and release | `PAYOUT_RISK` | **PAY** payments sandbox runner (R6) | R6 approval + isolated release fixture | After R6: approve→release in sandbox; inspect payout state | Waiting on gate |
| INV-A-062 | Blocked | request change order | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-063 | Blocked | cancel prefund | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-064 | Blocked | add evidence / open dispute | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-065 | Blocked | stop series / convert ambassador | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-066 | Blocked | request cancellation | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-067 | Blocked | settlement accept/question/dispute | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-068 | Blocked | Execute approved refund | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-A-069 | Blocked | own-milestone dashboard path | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-A-079 | Blocked | Open dispute (trust page) | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-J-001 | Blocked | job execution/sweep | `JOB_NOT_ENQUEUED` | **ISO** isolated audit host runner | — | Create the due record; run the job; prove scheduler + behaviour + no duplicate | Ready to run |
| INV-J-014 | Blocked | failed_payout_retry_sweep | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-J-022 | Blocked | subscription_renewal_sweep | `SHARED_HOST_ISOLATION` | **ISO** isolated audit host runner | — | Run the cron on the isolated host (not the shared host); prove scheduler + behaviour | Ready to run |
| INV-N-010T | Blocked | Notification trigger: funding_required | `PENDING_SIGN_FIXTURE` | **ISO** isolated audit host runner | — | Create an unsigned dual-party AUDIT agreement; sign both sides; inspect status + emitted notices | Ready to run |
| INV-N-011T | Blocked | Notification trigger: funding confirmed / can begin | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-012T | Blocked | Notification trigger: funding did not complete | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-018 | Blocked | payout_completed notification | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-019 | Blocked | payout_failed notification | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-020 | Blocked | payout_requested notification | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-021 | Blocked | payout_retry notification | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-022 | Blocked | payout_returned notification | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-023 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-024 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-025 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-026 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-027T | Blocked | Notification trigger: collaboration cancelled | `UI_FIXTURE_GAP` | **ISO** isolated audit host runner | — | Advance a disposable AUDIT fixture to the state that exposes the CTA/dialog; execute; reload; inspect record | Ready to run |
| INV-N-028 | Blocked | refund_completed notification | `DEPOSITS_CLOSED` | **PAY** payments sandbox runner (R6) | R6 provider sandbox plan approval (live deposits stay closed) | None until R6 approval; then run on the provider sandbox with AUDIT tenants | Waiting on gate |
| INV-N-029 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-030 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-031 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-032 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-033 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-N-034 | Blocked | Kind appears when event fires | `EVENT_NOT_FIREABLE` | **ISO** isolated audit host runner | Dispute / ops / ledger fixture must exist on the isolated host | Build the fixture that emits the event (incl. ledger_mismatch); fire; inspect centre + Mailpit | Waiting on gate |
| INV-E-042 | Blocked | Email payout.requested | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-043 | Blocked | Email payout.requested_business | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-044 | Blocked | Email payout.confirmed | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-045 | Blocked | Email payout.confirmed_business | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-046 | Blocked | Email payout.failed | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-047 | Blocked | Email payout.failed_admin | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-048 | Blocked | Email payout.retry | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-049 | Blocked | Email payout.returned | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-050 | Blocked | Email payout.returned_business | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-051 | Blocked | Email payout.returned_admin | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-052 | Blocked | Email payout.ready | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-063 | Blocked | Email refund.processing | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-064 | Blocked | Email refund.completed_business | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-E-065 | Blocked | Email refund.completed_influencer | `DEPOSITS_CLOSED_AND_MAIL_SINK` | **PAY** payments sandbox runner (R6) | R6 approval; mail portion already proven on Mailpit | After R6: fire the money event in sandbox; capture the mail in Mailpit | Waiting on gate |
| INV-N-103 | Blocked | SMS preferred path | `SMS_PROVIDER` | **INT** integrations runner | SMS provider sandbox credentials | Send via SMS sandbox; capture delivery receipt | Waiting on gate |
| INV-I-004 | Blocked | P-06 Meta webhook | `PROVIDER_OAUTH` | **INT** integrations runner | Meta / social OAuth test app credentials | Connect with the provider test app; verify provider-confirmed state | Waiting on gate |
| INV-I-005 | Blocked | P-06 OAuth launch/callback | `PROVIDER_OAUTH` | **INT** integrations runner | Meta / social OAuth test app credentials | Connect with the provider test app; verify provider-confirmed state | Waiting on gate |
| INV-C-013 | Blocked | Unpublished profile hidden from Discover | `DEMO_GATE` | **ISO** isolated audit host runner | — | Enable public_pages_live on the isolated host; verify live profile journey | Ready to run |
| INV-C-015 | Blocked | delete signed/funded request protected | `DESTRUCTIVE_FIXTURE` | **ISO** isolated audit host runner | — | Run on a disposable fixture only; capture before/after | Ready to run |
| INV-DC-010 | Blocked | Business create invitation for consistency lifecycle | `DASHBOARD_CONSISTENCY_FIXTURE` | **ISO** isolated audit host runner | — | Seed invite create / withdraw / expire fixtures; mutate; compare home, hub, badge after reload | **Executed IPS-44 → Pass** |
| INV-DC-013 | Blocked | Business withdraw pending invite; badges/destinations agree after | `DASHBOARD_CONSISTENCY_FIXTURE` | **ISO** isolated audit host runner | — | Seed invite create / withdraw / expire fixtures; mutate; compare home, hub, badge after reload | **Executed IPS-44 → Fail** |
| INV-DC-014 | Blocked | Expire invitation (deadline/sweep); counts agree after | `DASHBOARD_CONSISTENCY_FIXTURE` | **ISO** isolated audit host runner | — | Seed invite create / withdraw / expire fixtures; mutate; compare home, hub, badge after reload | **Executed IPS-44 → Fail** |
| INV-J-010 | Not tested | job execution/sweep | — | **ISO** isolated audit host runner | — | Create a submission past its review window; run milestone_auto_approval; prove scanned≥1, approved≥1, no duplicate on rerun | **Executed IPS-44 → Pass** |
| INV-N-013T | Not tested | Notification trigger: milestone_submitted | — | **ISO** isolated audit host runner | — | Re-run INV-A-058 fixture (submit milestone); inspect the notice emitted to the business | **Executed IPS-44 → Pass** |
| INV-N-015T | Not tested | Notification trigger: revision_requested | — | **ISO** isolated audit host runner | — | Re-run INV-A-059 fixture (request revision); inspect the notice to the influencer | **Executed IPS-44 → Fail** |
| INV-N-016T | Not tested | Notification trigger: milestone_approved | — | **ISO** isolated audit host runner | — | Re-run INV-A-060 fixture (approve); inspect the notices | **Executed IPS-44 → Blocked (approve↔release, R6)** |
| INV-N-017T | Not tested | Notification trigger: review period ended | — | **ISO** isolated audit host runner | INV-J-010 must pass first | Run with INV-J-010; inspect review-period-ended notices | **Executed IPS-44 → Fail** |
| INV-D-007E | Not tested | Media kit export | — | **ISO** isolated audit host runner | — | Execute media-kit export; download the file; inspect contents | Ready to run |

## Fail rows (24): retest owners after implementation

Fail rows can't be closed by running checks now; each needs its remediation first.

| Root cause | Rows | Retest runner | Gate | Next action |
|------------|------|---------------|------|-------------|
| RC-SEC | INV-R-074 | **LIVE** ops (live-host check) | Redeploy `5a5f4c0` + authorized rotation, each evidenced | Retest public admin login on live host |
| RC-CATALOG | INV-R-006, INV-A-070, INV-A-072, INV-A-073 | **ISO** isolated audit host runner | Ola-approved prices + R2 implementation | Retest on isolated host with Stripe test mode |
| RC-PORTAL | INV-A-074, INV-C-004 | **ISO** isolated audit host runner | R2 implementation | Retest |
| RC-INVOICE | INV-D-006 | **ISO** isolated audit host runner | R2 implementation | Retest download + inspect file |
| RC-DISCOVERY | INV-P-001, INV-A-035, INV-C-008 | **ISO** isolated audit host runner | R4 implementation | Retest |
| RC-MAIL | INV-R-119 | **ISO** isolated audit host runner | R5 implementation | Retest |
| RC-JOBS | INV-J-020, INV-J-021 | **ISO** isolated audit host runner | R5 implementation | Retest scheduler + behaviour + no duplicate |
| RC-EXPORT | INV-D-003, INV-I-014, INV-A-102 | **ISO** isolated audit host runner | R5 implementation | Retest download + inspect file |
| RC-DASHBOARD | INV-DC-001, INV-DC-002, INV-DC-006, INV-DC-012, INV-DC-015, INV-C-014, INV-N-004 | **ISO** isolated audit host runner | Package 1 design acceptance → implementation (paused) | Retest DB1–DB7 on isolated host |
