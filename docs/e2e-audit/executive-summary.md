# Influrios End-to-End Audit — Executive summary

**runId:** AUDIT_20261118170047  
**Deployed build:** `ada9c7f5d90d4d61e78627da2765cbe14004cbc4`  
**Base URL:** https://influrios.com  
**Date:** 2026-11-18 (UTC)

## Verdict

**Audit incomplete with blockers.**

The browsable pack covers preflight, route/action inventory, authenticated read-only navigation across Public/Influencer/Business/Admin, centered-popup geometry samples (Pass on sampled dialogs), and login/pricing checks. Critical sandbox mutating journeys (invite → sign → fund → milestone → payout, subscription checkout, notification interception) were **not** executed because staging isolation and a proven mail sink were not confirmed.

## Counts

- Cases: **153**
- Functional Pass: **131** · Fail: **0** · Blocked: **20** · Not tested: **1** · N/A: **1**
- Issues: **1** (P0: 1)
- Screenshots: 141 · Recordings: 3

## Top blockers / defects

1. **BLK-ISOLATION** — confirm isolated staging or set `AUDIT_ISOLATION_CONFIRMED=1`
2. **BLK-MAIL-SINK** — provide allowlisted sink + interception proof
3. **ISSUE-P0-ADMIN-LOGIN-DEFAULT-CREDS** — remove concrete default admin credentials from `/admin/login` (separate hotfix; not silently fixed in this audit)
4. **BLK-DEPLOY-SHA** — deployed `ada9c7f5` ≠ local PR #532 HEAD

## Completed vs incomplete

| Completed (evidence-backed) | Incomplete / blocked |
|-----------------------------|----------------------|
| Preflight provider labeling (Stripe Sandbox, SMTP Ready, in-app signing) | J01 verify, J05–J08 notices |
| Role logins + invalid login | J04–J15 mutating main collaboration |
| Route inventory opens (128 source routes mapped; audited subset executed) | J16–J20 sandbox money matrix |
| J30 centered popup samples Pass | Provider-sandbox checkout/payout proof |
| Agency deferred labeled | End-to-end verified gate |

## Next actions for Ola

1. Confirm isolation + mail allowlist (unblocks mutating suite).  
2. Authorize separate P0 admin-login credential hotfix.  
3. Re-run mutating journeys on confirmed staging; refresh pack.

Full pack index: [index.html](./index.html)
