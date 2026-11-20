---
cursor:
  subagentId: "bc-301bac77-2030-5804-b3d4-61d3aad72097"
---

# E2E audit pack ready report (IPS-10)

## Verdict

**Audit incomplete with blockers.**

## Pack locations

- Browsable: `/cursor/stores/self/docs/e2e-audit/index.html`
- Docs root: `/cursor/stores/self/docs/e2e-audit/`
- Media: `/cursor/stores/self/media/e2e-audit/`
- Downloads: `/cursor/stores/self/docs/e2e-audit/downloads/`
- Repo mirror branch: `cursor/e2e-audit-pack-2097` under `docs/e2e-audit/`, `media/e2e-audit/`, `scripts/e2e-audit/`

## Counts (run `AUDIT_20261118170047`)

- Cases: 153
- Functional: Pass 131 · Blocked 20 · Not tested 1 · N/A 1 · Fail 0
- Issues: 1 P0 (admin default credential rendering)
- Screenshots: 138+ · Recordings: 3 role nav webms
- Source routes inventoried: 128 · Actions seeded: 34

## Blockers stopping mutating E2E

1. BLK-ISOLATION
2. BLK-MAIL-SINK
3. BLK-ADMIN-CRED-EXPOSURE (P0 — separate product fix)
4. BLK-DEPLOY-SHA (deployed `ada9c7f5` ≠ local `e98cea9d`)

## What passed without mutation

- Role logins (influencer/business/admin) + invalid login generic error
- Stripe Sandbox labeling; SMTP Ready; in-app signing primary; Stripe Collaboration enabled; Airwallex disabled
- J30 centered desktop popups (business request, admin accounts/tax/plans, influencer contracts) + business mobile full-bleed
- Route inventory opens across public/member/admin
- J24 synthetic ID denial Pass; cross-account real contract Not tested (no list href)
- Agency deferred labeled

## Not claimed

- End-to-end verified
- Provider-sandbox checkout/sign/payout completion
- Notification interception
