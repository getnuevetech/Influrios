# COR-20–23 acceptance evidence

Product PR only (no #534 audit docs). Live collaboration deposits unchanged.

## Review follow-up (Ola request changes)

| Item | Fix |
|------|-----|
| Client must not import server modules | Browser-safe `deliverable-file-rules.ts` + `deliverable-link.ts`; FS/crypto/Prisma stay in `deliverable-files.ts` / `milestone-delivery.ts` |
| Form-action dispatch | Submit/Add files use `startTransition(() => formAction(data))`; button disabled while pending |
| Excess files | Explicit `Add up to 4 files.` — no silent `.slice` discard |
| Progress | Indeterminate full-width pulse (no hardcoded `w-2/3`) |
| MIME fallback | Only empty / `application/octet-stream` + explicit aliases; conflicts tested |
| Runtime COR-21 | Isolated Postgres: `runtime-upload-path.txt` — upload→persist→reopen bytes; owner+influencer allowed; stranger denied |

## Commands

```bash
npx tsx --test src/lib/payment-route.test.ts src/lib/deliverable-upload-path.test.ts src/lib/workspace-decision.test.tsx
DOCKER_BUILD=1 npx next build   # production build OK after client/server split
DATABASE_URL=… npx tsx --test src/lib/deliverable-upload-path.test.ts
```

## Runtime sandbox (COR-21)

See `runtime-upload-path.txt` (TAP). Proves:

1. `saveDeliverableFiles` persists PDF for held funding milestone submission  
2. `readDeliverableFile` returns the same bytes (reopen)  
3. `assertFundingAccess` allows business owner + assigned influencer  
4. Cross-account business stranger denied  
5. Route still returns 401 unauth / 404 denial (`/api/deliverables/[fileId]`)

Production build log tail: `production-build-tail.txt`

## UI captures

Screenshots / walkthrough under this folder remain useful for COR-20/22/23 chrome. Static markup alone is **not** the COR-21 runtime proof — use `runtime-upload-path.txt`.
