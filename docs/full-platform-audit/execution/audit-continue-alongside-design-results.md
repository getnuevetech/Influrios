---
cursor:
  subagentId: "bc-d672520b-0a72-5f46-ba73-506afca23648"
---

# IPS-40 — Continue remaining audit checks (alongside UX design)

**When:** 2026-11-21  
**Host:** isolated local `http://127.0.0.1:3000` (not live `influrios.com`)  
**Sink:** Mailpit `v1.34.0` — SMTP `127.0.0.1:1025`, API/UI `127.0.0.1:8025`  
**DB:** local Postgres `influrios_audit` + `seed-local-fixtures.ts` (`r4cont01` `@example.com` AUDIT members)  
**Evidence:** `/cursor/stores/bc-52867d75-a339-4985-81ae-823456e1a82c/media/full-platform-audit/audit-continue/`  
**Harness:** `scripts/e2e-audit/ips40-audit-continue.ts` (local-only; no product PR)  
**Constraints:** Live deposits **not** reopened. Agency deferred. Design work not blocked. **Not** platform-wide completion.

## Acceptance summary

| Batch | Result |
|-------|--------|
| CLAIM_DRAFT_FIXTURE (6) | **6 Pass** — draftId preview → verify mail → publish → social exercise |
| EVENT_NOT_FIREABLE notify kinds (9) | **9 Pass** — `notifyCollabFundingEvent` on isolated held funding fixture → Mailpit (no live deposit) |
| IPS-30 demoted NT actions (4) | **4 Pass** — prefs / managed-intro / save-listing / media-kit view+inspect |
| IPS-30 demoted NT jobs (5) | **5 Pass** — collab_notification + auto-approval / review-deadline / funding-recon / app-expire with due fixtures; no duplicate on rerun |
| DEPOSITS_CLOSED (+ deposit+mail) | **Documented Blocked only** — not retested as Pass |

## Counts delta (store matrix)

| Metric | Before (IPS-31) | After IPS-40 |
|--------|----------------:|-------------:|
| Pass | 355 | **379** |
| Fail | 24 | 24 |
| Blocked | 95 | **80** |
| Not tested | 9 | **0** |
| Explicitly deferred | 10 | 10 |
| Rows | 493 | 493 |

## Row results (24 executed)

| ID | Status | Actual (short) |
|----|--------|----------------|
| INV-R-017 | Pass | Preview `draftId` on isolated host |
| INV-R-018 | Pass | `/claim/verify/{draftId}` after claimDraft |
| INV-R-019 | Pass | `stage=published` |
| INV-A-013 | Pass | Mailpit claim verify code received + used |
| INV-A-014 | Pass | Publish action → published |
| INV-A-015 | Pass | Claim social path exercised (Starter 1-link; second → upgrade limit) |
| INV-N-010…017, INV-N-027 | Pass | Kind emails queued + Mailpit intercepted via funding fixture |
| INV-J-006 | Pass | `collab_notification` SUCCEEDED |
| INV-J-010 | Pass | Auto-approval `submitted` → `release_scheduled`; rerun 0 |
| INV-J-011 | Pass | Review-deadline notified once; rerun 0; no duplicate mail |
| INV-J-015 | Pass | Funding recon flagged stale once; rerun 0 |
| INV-J-017 | Pass | App expire auto mode expired once; rerun 0 |
| INV-A-008 | Pass | Email prefs persist after reload |
| INV-A-019 | Pass | `openToManaged=true` persist |
| INV-A-027 | Pass | Save → reload → unsave |
| INV-D-007 | Pass | Media-kit → View card HTTP 200 inspected (no PDF export in product) |

Full machine results: `media/full-platform-audit/audit-continue/results.json`.

## DEPOSITS_CLOSED (documented only)

Left **Blocked**. Policy unchanged: do not reopen `journey_funding` / live deposits for audit counts. Includes deposit-only money paths and `DEPOSITS_CLOSED_AND_MAIL_SINK` payout/refund journey emails (catalog Send-test already proven in IPS-31; money event still closed). See `media/full-platform-audit/audit-continue/deposits-closed-documented.json`.

## Still open (not claimed complete)

- **80 Blocked** remain (fixture gaps, deposit+mail, OAuth, SMS, shared-host cron, remaining EVENT_NOT_FIREABLE ops kinds, etc.)
- **24 Fail** remain (dashboard consistency, annual purchase, invitation/quote sweep Fail rows, etc.)
- Agency Explicitly deferred
- Live production Mailpit still absent
- Remediation plan stays **PROVISIONAL**

## Claim boundary

- **Claimed:** Isolated-host retests above with Mailpit + fixture evidence; matrix/register/status updated in store.
- **Not claimed:** Live host completion; deposit/money journeys; Agency; platform-wide audit or remediation completion.

## Fold note

Meaningful batch ready for #539 docs/evidence fold (matrix Pass **379** / Blocked **80** / NT **0**).
