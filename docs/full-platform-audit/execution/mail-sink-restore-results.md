# IPS-31 — Mail-sink restore results

> **Historical audit record.** Recorded against live `40b6288` (Nov 2026), when live collaboration deposits were closed and a simulated funding path existed. Both have since changed (Stripe Checkout funding; simulation removed). Current status of every row and root cause: [docs/remediation-status.md](../../remediation-status.md). Screenshots referenced here stay on the [`cursor/full-platform-audit-package-b6cf`](https://github.com/getnuevetech/Influrios/tree/cursor/full-platform-audit-package-b6cf/media/full-platform-audit) branch.

**When:** 2026-11-21  
**Host:** isolated local `http://127.0.0.1:3000` (not live `influrios.com`)  
**Sink:** Mailpit `v1.34.0` — SMTP `127.0.0.1:1025`, API/UI `127.0.0.1:8025`  
**DB:** local Postgres `influrios_audit` + `seed-local-fixtures.ts` (`@example.com` AUDIT members)  
**Mail settings:** `host=127.0.0.1` `port=1025` `enabled=true` `from=noreply@audit.local`  
**Evidence:** `media/mail-sink/`  
**Harness:** `scripts/e2e-audit/ips31-mail-sink-restore.ts` (local-only; no product PR)  
**Deposits:** not reopened (`journey_funding` closed / no live money events)

## Acceptance

| Check | Result |
|-------|--------|
| Sink receives controlled outbound mail | **Pass** — admin Send test + catalog tests + journey jobs |
| INV-I-019 interception | **Pass** — Mailpit gained +1 after `/admin/mail` Send test |
| MAIL_SINK-only rows retested | **70 Pass** · **15 Blocked** (updated exact blockers) |
| Mail+deposit rows not falsely Pass | **14 remain Blocked** (mail portion proven; money event closed) |
| Product config PR | **Not required** — DB `mailSettings` + local Mailpit only |

## Counts (official register sets)

| Set | Pass | Blocked | Notes |
|-----|-----:|--------:|-------|
| `MAIL_SINK` (85) | **70** | **15** | Sink restored; claim-draft + notification-event remain |
| `DEPOSITS_CLOSED_AND_MAIL_SINK` (14) | 0 | **14** | Catalog Send-test intercepted; payout/refund journey still closed |
| Matrix whole | Pass **355** / Blocked **95** | — | Was Pass 285 / Blocked 165 before IPS-31 |

## Sink proof (INV-I-019)

- Admin login → `/admin/mail` → Send test to `audit.r3pr12vx.influencer-a@example.com`
- Mailpit `before=0` → `after=1` (`gained=1`)
- Evidence: `inv-i-019-admin-send-test.png`, `inv-i-019-mailpit.json`

## Journey highlights

| ID | Status | Actual |
|----|--------|--------|
| INV-A-004 | Pass | OTP mail in Mailpit; verify with `?email=` → `/creator?welcome=1`; `emailVerifiedAt` set |
| INV-A-005 | Pass | `requestPasswordReset` → Mailpit token → reset complete |
| INV-J-002 | Pass | `verification_email` job sink-confirmed |
| INV-J-003 | Pass | `claim_verification_email` job sink-confirmed |
| INV-J-004 | Pass | `password_reset_email` job sink-confirmed |
| INV-E-001…041,053…062,066…079 (MAIL_SINK set) | Pass | Catalog Send-test equivalent → Mailpit (`catalog-sends.json`) |

## Still Blocked — exact blockers

### Claim draft fixture (6) — sink restored, draft path missing

| ID | Exact blocker |
|----|---------------|
| INV-R-017 | `CLAIM_DRAFT_FIXTURE`: need claim draftId + claim verify/publish path on isolated host (Mailpit up; INV-J-003 job proven separately) |
| INV-R-018 | same |
| INV-R-019 | same |
| INV-A-013 | same |
| INV-A-014 | same |
| INV-A-015 | same |

### Notification email kinds (9) — sink restored, event not fired

| ID | Exact blocker |
|----|---------------|
| INV-N-010…017, INV-N-027 | `EVENT_NOT_FIREABLE_ON_ISOLATED_HOST`: needs collab state-change trigger for notification kind email; matching catalog templates Pass via Send-test; do not reopen live deposits |

### Deposit + mail combo (14) — mail portion proven

| ID | Exact blocker |
|----|---------------|
| INV-E-042…052, INV-E-063…065 | `DEPOSITS_CLOSED_AND_MAIL_SINK`: journey money event still closed (`journey_funding` / no live deposits). Mail sink restored — catalog test send **PROVEN**; payout/refund journey remains Blocked |

## Matrix / register updates

- [coverage-matrix.md](../coverage-matrix.md) — 70 MAIL_SINK rows → Pass; remaining blockers refreshed
- [blocked-register.md](../blocked-register.md) — `MAIL_SINK` cluster **85 → 15**; accounted Blocked **95**; combo notes updated
- [coverage-status.md](../coverage-status.md) — IPS-31 delta noted

## Artifacts

| Path | Role |
|------|------|
| `media/mail-sink/results.json` | Full row results |
| `media/mail-sink/meta.json` | Env + mailSettings |
| `media/mail-sink/catalog-sends.json` | Per-template Send-test outcomes |
| `media/mail-sink/fixtures.json` | Synthetic AUDIT members |
| `media/mail-sink/inv-*.png|json` | Journey evidence |

## Claim boundary

- **Claimed:** Isolated Mailpit interception restored; sink-confirmed catalog delivery for MAIL_SINK email templates; OTP/reset/claim-verify **jobs** + OTP/reset **complete** on local fixtures.
- **Not claimed:** Live production Mailpit; payout/refund money-event emails; claim draft UI publish without draft fixture; live notification emission for INV-N-* kinds; Agency.
