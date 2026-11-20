# Fixtures & run instructions

## Run

- runId: `AUDIT_20261118170047`
- Harness (agent store): `/cursor/stores/self/internal/e2e-audit-work/`
- Secrets: `AUDIT_*` (never commit). Optional: `MAIL_SINK_TO`, `AUDIT_ISOLATION_CONFIRMED=1`, `AUDIT_BASE_URL`

## Fixtures used

| Alias | Source | Notes |
|-------|--------|-------|
| AUDIT influencer/business/admin | Cloud Agent secrets | Existing accounts; not freshly seeded this run |
| AUDIT_<runId> namespace seeds | **Not created** | Blocked by BLK-ISOLATION |
| Main campaign entity | **Not created** | Requires UI mutations after isolation confirm |

Auth storage kept under `/tmp/e2e-audit/auth` (not in pack).
