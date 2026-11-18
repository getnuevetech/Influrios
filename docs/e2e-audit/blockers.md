# Blockers — Influrios E2E audit `AUDIT_20261118170047`

Preflight checkpoint before main mutating journeys. Unaffected read-only cases continue.

## BLK-ISOLATION — Staging isolation not confirmed

| Field | Detail |
|-------|--------|
| Dependency | Confirmed isolated DB/tenant **or** dedicated staging host; set `AUDIT_ISOLATION_CONFIRMED=1` for the audit agent |
| Evidence | Host is `influrios.com` (no separate staging hostname). Brief forbids presuming safety from older “staging” labels. Flag absent. |
| Affected | All mutating journeys: J04–J20, withdrawal/deletion/race, sandbox checkout/payout, fixture seeding that writes shared data |
| Smallest unblock | Ola/operator confirms this host is isolated test data + sandbox-only providers, then set env `AUDIT_ISOLATION_CONFIRMED=1` (or provide a dedicated staging URL) |
| Owner | Operator / Ola |
| Status | **Open** — mutations stopped |

## BLK-MAIL-SINK — Notification sink unproven

| Field | Detail |
|-------|--------|
| Dependency | Allowlisted audit inbox or mail sink; prove interception with one harmless test message before invite/sign/withdraw/billing notice cases |
| Evidence | SMTP Ready in Admin → Email. `MAIL_SINK_TO` unset. AUDIT accounts use ordinary mailbox domains — not proven as sink. Unsent/queued job ≠ delivery proof. |
| Affected | J01 (verify), J02 (reset), J05, J07–J08 notices, J11 signature notices, J16 billing mail, J23 |
| Smallest unblock | Provide `MAIL_SINK_TO` (or confirm AUDIT_* mailboxes are the allowlist) + authorize one Admin → Email test send; capture SMTP accept **and** sink receipt |
| Owner | Operator / Ola |
| Status | **Open** |

## BLK-ADMIN-CRED-EXPOSURE — Default admin credentials rendered (P0)

| Field | Detail |
|-------|--------|
| Dependency | Remove concrete default super-admin email/password from `/admin/login` HTML |
| Evidence | Public page shows “Default super admin…” with concrete email rendered (values **not** copied into this pack). Source still ships the hint UI. |
| Affected | Security baseline; admin auth |
| Smallest unblock | Separately identifiable product hotfix (out of silent-audit-fix scope) + isolated auth regression; **do not** attempt exposed password on live admin |
| Owner | Engineering |
| Status | **Open** — reported; not exploited |

## BLK-DEPLOY-SHA — Unverified build for regression claims

| Field | Detail |
|-------|--------|
| Dependency | Map deployed `revision` to known release / deploy deployed HEAD if comparing to PR #532/#533 |
| Evidence | Deployed `ada9c7f5…` (PR #530) ≠ local `e98cea9d…` (PR #532 merge) |
| Affected | Regression comparison language only |
| Smallest unblock | Deploy desired SHA or accept “unverified build” and audit as-is |
| Owner | Operator |
| Status | **Open** — run continues against actual deployment |

## Not blockers (noted)

| Item | Note |
|------|------|
| Stripe mode | Admin billing shows **Sandbox** — collection path not live-keyed in UI excerpts |
| SMS | Not sent on this build |
| Agency | Deferred by preference — inventory dead-ends only |
| Payment Standard v2 | Paused — do not enable live gateway to pass tests |
| In-app signing | Primary path; DocuSign optional — no invented DocuSign requirement |

## Next actions for Ola

1. Confirm isolation on `influrios.com` **or** give a dedicated staging URL.  
2. Confirm mail allowlist / set `MAIL_SINK_TO` and authorize one harmless test message.  
3. Authorize a **separate** fix PR for admin login credential exposure (P0).  
4. Optional: deploy SHA alignment with audit branch expectations.
