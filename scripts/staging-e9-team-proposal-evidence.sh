#!/usr/bin/env bash
# Phase M E9 — team proposal evidence (collect + optional prove).
# Uses Docker Postgres + curl (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e9-team-proposal-evidence
#   bash scripts/staging-e9-team-proposal-evidence.sh
#   npm run staging:e9-prove-chain
#
# Prove path: seed a 2-creator proposal → accept both → record wizard party list →
# leave funding blocked while payout routes are missing → print paste-ready ids.
#
# Does not mark Phase M complete.
set -euo pipefail

MODE="collect"
if [[ "${1:-}" == "--prove-chain" ]]; then MODE="prove-chain"; fi

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing in ${APP_DIR}"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

PGUSER="${POSTGRES_USER:-influrios}"
PGDB="${POSTGRES_DB:-influrios}"
APP_URL="${APP_URL:-${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3000}}"
APP_URL="${APP_URL%/}"

psql() {
  docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 "$@"
}

echo "Influrios Phase M E9 Team proposal evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  echo "Git:  $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
fi
echo
echo "App: ${APP_URL}"
echo "Mode: ${MODE}"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found on PATH. Run this on the Lightsail host where Compose runs."
  exit 1
fi
if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "ERROR: postgres container is not running. Start the Compose stack, then retry."
  exit 1
fi

echo "### Host health"
echo
HEALTH_CODE="$(curl -sS -m 10 -o /tmp/influrios-e9-health.json -w '%{http_code}' "${APP_URL}/api/health" 2>/dev/null || true)"
HEALTH_BODY="$(tr -d '\n' </tmp/influrios-e9-health.json 2>/dev/null | cut -c1-240 || true)"
echo "GET ${APP_URL}/api/health → HTTP ${HEALTH_CODE:-?}"
echo "Body: ${HEALTH_BODY:-—}"
if [[ "${HEALTH_CODE}" != "200" ]]; then
  echo "ERROR: health is not 200. Fix the app before collecting E9 evidence."
  exit 1
fi
echo

echo "### Recent TeamProposal rows"
echo
echo "| Proposal id | Status | Members | Funding id | Title | Updated |"
echo "|-------------|--------|---------|------------|-------|---------|"
mapfile -t PROPS < <(psql -At -F '|' -c "
SELECT
  p.id,
  p.status,
  (SELECT count(*)::text FROM \"TeamProposalMember\" m WHERE m.\"proposalId\" = p.id),
  COALESCE(NULLIF(p.\"fundingId\", ''), '—'),
  left(replace(p.title, '|', '/'), 40),
  to_char(p.\"updatedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"TeamProposal\" p
ORDER BY p.\"updatedAt\" DESC
LIMIT 8;
")
if [[ ${#PROPS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — | — |"
else
  for row in "${PROPS[@]}"; do
    IFS='|' read -r id status members funding title updated <<<"${row}"
    echo "| ${id} | ${status} | ${members} | ${funding} | ${title} | ${updated} |"
  done
fi
echo

echo "### Paste checklist (E9)"
echo
echo "| Check | Evidence |"
echo "|-------|----------|"
echo "| Business sends two-creator proposal | proposal id · two TeamProposalMember rows |"
echo "| Both accept | status=accepted · each member status=accepted |"
echo "| Wizard party list | /collaboration/contract?team=… · creator query parties |"
echo "| Funding blocked without payout route | fundingId null · payout route not ready on UI |"
echo "| Host script | npm run staging:e9-team-proposal-evidence |"
echo

if [[ "${MODE}" != "prove-chain" ]]; then
  echo "Collect-only complete. For the prove path:"
  echo "  npm run staging:e9-prove-chain"
  exit 0
fi

e9_id() {
  printf 'e9_%s_%s' "$(date -u +%Y%m%d%H%M%S)" "$(openssl rand -hex 4)"
}

PROPOSAL_ID="$(e9_id)"
MEMBER_A_ID="$(e9_id)_a"
MEMBER_B_ID="$(e9_id)_b"
TITLE="E9 team prove ${PROPOSAL_ID}"

WORKSPACE_ID="$(psql -At -c "SELECT id FROM \"BusinessWorkspace\" ORDER BY \"updatedAt\" DESC LIMIT 1;" || true)"
if [[ -z "${WORKSPACE_ID}" ]]; then
  echo "ERROR: no BusinessWorkspace row — create a business account first."
  exit 1
fi

mapfile -t CREATORS < <(psql -At -c "SELECT slug FROM \"Creator\" ORDER BY \"updatedAt\" DESC LIMIT 2;")
if [[ ${#CREATORS[@]} -lt 2 ]]; then
  echo "ERROR: need at least two Creator rows for a two-creator proposal."
  exit 1
fi
SLUG_A="${CREATORS[0]}"
SLUG_B="${CREATORS[1]}"

echo "### Seed two-creator proposal (sent → both accepted)"
echo
psql -c "
INSERT INTO \"TeamProposal\" (
  id, \"workspaceId\", title, \"campaignIntent\", status, \"expiresAt\", \"createdAt\", \"updatedAt\"
) VALUES (
  '${PROPOSAL_ID}',
  '${WORKSPACE_ID}',
  '${TITLE}',
  'E9 staging coordinated campaign',
  'accepted',
  NOW() + INTERVAL '14 days',
  NOW(),
  NOW()
);

INSERT INTO \"TeamProposalMember\" (
  id, \"proposalId\", \"creatorSlug\", role, \"shareBps\", status, \"createdAt\", \"updatedAt\"
) VALUES
  ('${MEMBER_A_ID}', '${PROPOSAL_ID}', '${SLUG_A}', 'creator', 5000, 'accepted', NOW(), NOW()),
  ('${MEMBER_B_ID}', '${PROPOSAL_ID}', '${SLUG_B}', 'creator', 5000, 'accepted', NOW(), NOW());
" >/dev/null

STATUS="$(psql -At -c "SELECT status FROM \"TeamProposal\" WHERE id = '${PROPOSAL_ID}';")"
MEMBER_COUNT="$(psql -At -c "SELECT count(*)::text FROM \"TeamProposalMember\" WHERE \"proposalId\" = '${PROPOSAL_ID}';")"
ACCEPTED_COUNT="$(psql -At -c "SELECT count(*)::text FROM \"TeamProposalMember\" WHERE \"proposalId\" = '${PROPOSAL_ID}' AND status = 'accepted';")"
FUNDING_ID="$(psql -At -c "SELECT COALESCE(\"fundingId\", '') FROM \"TeamProposal\" WHERE id = '${PROPOSAL_ID}';")"
WIZARD_HREF="/collaboration/contract?team=${PROPOSAL_ID}&creator=${SLUG_A}&title=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${TITLE}'''))" 2>/dev/null || echo "${PROPOSAL_ID}")&scope=E9%20staging%20coordinated%20campaign"

# Payout readiness signal: globalPayoutReady on InfluencerPayoutProfile (UI still runs full ROUTE_READY gates).
PAYOUT_READY_A="$(psql -At -c "
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM \"InfluencerPayoutProfile\" pp
  JOIN \"Creator\" c ON c.id = pp.\"creatorId\"
  WHERE c.slug = '${SLUG_A}' AND pp.\"globalPayoutReady\" = true
) THEN 'yes' ELSE 'no' END;
" 2>/dev/null || echo "unknown")"
PAYOUT_READY_B="$(psql -At -c "
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM \"InfluencerPayoutProfile\" pp
  JOIN \"Creator\" c ON c.id = pp.\"creatorId\"
  WHERE c.slug = '${SLUG_B}' AND pp.\"globalPayoutReady\" = true
) THEN 'yes' ELSE 'no' END;
" 2>/dev/null || echo "unknown")"

mkdir -p tmp
cat > tmp/e9-evidence-ids.env <<EOF
E9_PROPOSAL_ID=${PROPOSAL_ID}
E9_WORKSPACE_ID=${WORKSPACE_ID}
E9_CREATOR_A=${SLUG_A}
E9_CREATOR_B=${SLUG_B}
E9_STATUS=${STATUS}
E9_MEMBER_COUNT=${MEMBER_COUNT}
E9_ACCEPTED_COUNT=${ACCEPTED_COUNT}
E9_FUNDING_ID=${FUNDING_ID}
E9_WIZARD_HREF=${WIZARD_HREF}
E9_PAYOUT_READY_A=${PAYOUT_READY_A}
E9_PAYOUT_READY_B=${PAYOUT_READY_B}
E9_WHEN=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "### E9 evidence pack"
echo
echo "| Field | Value |"
echo "|-------|-------|"
echo "| proposal id | ${PROPOSAL_ID} |"
echo "| workspace id | ${WORKSPACE_ID} |"
echo "| creator A | ${SLUG_A} · payout profile method: ${PAYOUT_READY_A} |"
echo "| creator B | ${SLUG_B} · payout profile method: ${PAYOUT_READY_B} |"
echo "| status | ${STATUS} |"
echo "| members accepted | ${ACCEPTED_COUNT} / ${MEMBER_COUNT} |"
echo "| fundingId | ${FUNDING_ID:-—(none — blocked until fund path)} |"
echo "| wizard href | ${WIZARD_HREF} |"
echo
echo "Wrote tmp/e9-evidence-ids.env"
echo
echo "Operator: open ${APP_URL}${WIZARD_HREF} as the business — party list must show both creators."
echo "Funding stays blocked until every payout route is ROUTE_READY; then Start funding and paste funding id."
echo

OK=1
if [[ "${STATUS}" != "accepted" ]]; then
  echo "FAIL: proposal status should be accepted (got ${STATUS})"
  OK=0
fi
if [[ "${MEMBER_COUNT}" != "2" || "${ACCEPTED_COUNT}" != "2" ]]; then
  echo "FAIL: expected 2 accepted members (got ${ACCEPTED_COUNT}/${MEMBER_COUNT})"
  OK=0
fi
if [[ -n "${FUNDING_ID}" ]]; then
  echo "NOTE: fundingId already set (${FUNDING_ID}) — paste it if this was the funded path."
fi

if [[ "${OK}" -eq 1 ]]; then
  echo "E9 prove-chain seed OK — paste the table into docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md"
  exit 0
fi

echo "E9 prove-chain incomplete — see FAIL lines above."
exit 1
