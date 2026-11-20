# COR-SEC-01 / R0 acceptance

## Scope

Remove concrete bootstrap credential hints from public admin sign-in and eliminate default-password fallbacks in admin bootstrap. Preserve `/admin/setup` invitation flow. Live deposits unchanged. Agency deferred. No R1/R2/annual work.

## Checks

| Check | Evidence |
|-------|----------|
| Public `/admin/login` source has no email `defaultValue`, no “Default super admin” credential line, no `ADMIN_SUPER_*` env names with values | `public-output-check.txt` + unit test |
| Bootstrap without `ADMIN_SUPER_EMAIL` / `ADMIN_SUPER_PASSWORD` fails (incl. `NODE_ENV=production`) | `admin-auth.test.ts` COR-SEC-01 suite |
| No hardcoded `ADMIN_SUPER_* \|\| "…"` secrets in `admin-auth.ts` | same |
| Setup invitation page preserved | `src/app/admin/setup/page.tsx` |
| Rotation documented; not executed without authorization | store `internal/cor-sec-01-r0-rotation.md` |

## Commands

```bash
npx tsx --test src/lib/admin-auth.test.ts
```
