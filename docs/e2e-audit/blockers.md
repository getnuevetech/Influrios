# Blockers (revision r3.1 — Stripe re-probe)

## Open — requires fresh worker

### BLK-STRIPE-TEST-KEYS-NOT-IN-THIS-VM
- **Ola stated:** `STRIPE_SECRET_KEY` (sk_test) + `STRIPE_WEBHOOK_SECRET` are bound.
- **This VM re-probe (names only, 2026-11-19):** both **ABSENT** from:
  - agent shell `process.env`
  - `/workspace/.env.local` (mtime 2026-11-18T23:47:38Z — no `STRIPE_*` keys)
  - `next-server` process environ (started 2026-11-19T00:29:36Z)
- **Conclusion:** This running VM/process **predates or never received** the binding. J13 → J16 → J15 **cannot** execute here.
- **Smallest Ola action:** Start a **new worker** on the same branch with secrets injected at boot; then re-run J13, J16, J15 on the local harness (no live money).
- Evidence: [`stripe-secret-probe.json`](./stripe-secret-probe.json)

### BLK-PAYOUT-SANDBOX
- Depends on J13 funding succeeding after Stripe secrets are visible.

## Explained (not a Stripe blocker)

### J02 local admin Fail
- **Root cause:** harness password fallback ≠ seeded `ADMIN_SUPER_PASSWORD` hash. See [`admin-login-root-cause.md`](./admin-login-root-cause.md).
- Re-probe with `ADMIN_SUPER_PASSWORD` → `/admin` Pass.
- Remains separate from product P0 admin-cred hotfix scope.

## Resolved for non-money journeys
- Local Postgres + Mailpit + synthetic fixtures; J01/J04–J12/J23/J24 completed on this VM.
