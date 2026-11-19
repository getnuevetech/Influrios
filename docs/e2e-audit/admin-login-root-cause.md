# J02 local admin login Fail — root cause

## What failed
`J02-local-login-admin` recorded **Fail** with `actual=http://127.0.0.1:3000/admin/login` (stayed on login). Business/influencer local logins **Pass**.

## Root cause (proven by re-probe; no secret values printed)
1. Seed (`scripts/e2e-audit/seed-local-fixtures.ts`) hashes the super-admin password as `process.env.ADMIN_SUPER_PASSWORD || AuditLocalPass!2026`.
2. In this environment, `ADMIN_SUPER_PASSWORD` **is set** (length 20) and equals the distinct value historically referred to as `AuditLocalAdmin!2026` — **not** the member fixture password `AuditLocalPass!2026`.
3. `loginAdmin()` API check:
   - `ADMIN_SUPER_PASSWORD` → **ok: true**
   - `AuditLocalPass!2026` → **ok: false** (`Invalid email or password`)
4. Harness (`run-local-journeys.mjs`) calls `adminLogin(..., process.env.ADMIN_SUPER_PASSWORD || PASSWORD)` where `PASSWORD = AuditLocalPass!2026`.
5. Plain `node` harness processes do **not** auto-load Next `.env.local`. If `ADMIN_SUPER_PASSWORD` was missing from that Node process env at run time, the harness fell back to `AuditLocalPass!2026`, which does not match the DB hash → server returns invalid credentials → browser remains on `/admin/login` → Fail.

## Not the cause
- Wrong admin email (fixture `audit.admin@example.com` matches env / DB row; user active, `role_super`).
- Admin auth stack broken (same credentials succeed via API + Playwright `page.fill` when env password is used).
- Product “silent fix” required for this Fail classification — it is a **harness env-loading / password-source mismatch**, separate from the P0 product admin-cred topic.

## Fix for future local runs (harness only)
Load `.env.local` into the harness process (or always pass `ADMIN_SUPER_PASSWORD` explicitly); do not reuse the member `AuditLocalPass!2026` fallback for admin.
