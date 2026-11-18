#!/usr/bin/env bash
# Phase M E10 — DocuSign envelope evidence (collect + optional prove).
# Uses Docker Postgres + curl (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e10-docusign-evidence
#   bash scripts/staging-e10-docusign-evidence.sh
#   DOCUSIGN_WEBHOOK_SECRET=… npm run staging:e10-prove-chain
#
# Prove path seeds a DocuSign-channel contract + SignatureRequest, posts a completed
# Connect webhook twice (duplicate skip), and prints paste-ready ids.
#
# Does not mark Phase M complete. Live DocuSign sandbox send still needs Admin →
# Document signing credentials and a real wizard send for the envelope id.
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

echo "Influrios Phase M E10 DocuSign evidence"
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
HEALTH_CODE="$(curl -sS -m 10 -o /tmp/influrios-e10-health.json -w '%{http_code}' "${APP_URL}/api/health" 2>/dev/null || true)"
HEALTH_BODY="$(tr -d '\n' </tmp/influrios-e10-health.json 2>/dev/null | cut -c1-240 || true)"
echo "GET ${APP_URL}/api/health → HTTP ${HEALTH_CODE:-?}"
echo "Body: ${HEALTH_BODY:-—}"
if [[ "${HEALTH_CODE}" != "200" ]]; then
  echo "ERROR: health is not 200. Fix the app before collecting E10 evidence."
  exit 1
fi
echo

echo "### Signing provider + unsigned webhook"
echo
mapfile -t SIGNING < <(psql -At -F '|' -c "
SELECT code, CASE WHEN enabled THEN 'yes' ELSE 'no' END,
  CASE WHEN COALESCE(\"webhookCipher\", '') <> '' THEN 'yes' ELSE 'no' END,
  CASE WHEN COALESCE(\"secretCipher\", '') <> '' THEN 'yes' ELSE 'no' END
FROM \"IntegrationProvider\"
WHERE kind = 'signing'
ORDER BY enabled DESC, \"updatedAt\" DESC;
")
echo "| Code | Enabled | Webhook secret | API secret |"
echo "|------|---------|----------------|------------|"
if [[ ${#SIGNING[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — |"
else
  for row in "${SIGNING[@]}"; do
    IFS='|' read -r code enabled webhook secret <<<"${row}"
    echo "| ${code} | ${enabled} | ${webhook} | ${secret} |"
  done
fi
echo

WH_CODE="$(curl -sS -m 10 -o /tmp/influrios-e10-wh.json -w '%{http_code}' \
  -X POST -H 'content-type: application/json' -H 'x-docusign-signature-1: bogus' \
  -d '{"event":"envelope-completed","data":{"envelopeId":"probe","envelopeSummary":{"status":"completed"}}}' \
  "${APP_URL}/api/signing/webhook" 2>/dev/null || true)"
WH_BODY="$(tr -d '\n' </tmp/influrios-e10-wh.json 2>/dev/null | cut -c1-200 || true)"
echo "POST /api/signing/webhook (unsigned) → HTTP ${WH_CODE:-?}"
echo "Body: ${WH_BODY:-—}"
echo
echo "Expect 401 when DocuSign webhook secret is Ready; 503 when no signing provider is ready."
echo

echo "### Recent DocuSign contracts / signature requests"
echo
echo "| Contract id | Status | Envelope | Channel | Updated |"
echo "|-------------|--------|----------|---------|---------|"
mapfile -t DOCS < <(psql -At -F '|' -c "
SELECT id, status, COALESCE(NULLIF(\"envelopeId\", ''), '—'), \"signingChannel\",
  to_char(\"updatedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"ContractDocument\"
WHERE \"signingChannel\" = 'docusign'
ORDER BY \"updatedAt\" DESC
LIMIT 8;
")
if [[ ${#DOCS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${DOCS[@]}"; do
    IFS='|' read -r id status env channel updated <<<"${row}"
    echo "| ${id} | ${status} | ${env} | ${channel} | ${updated} |"
  done
fi
echo

echo "| SignatureRequest id | Status | External id | Updated |"
echo "|---------------------|--------|-------------|---------|"
mapfile -t SIGS < <(psql -At -F '|' -c "
SELECT id, status, COALESCE(NULLIF(\"externalId\", ''), '—'),
  to_char(\"updatedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"SignatureRequest\"
ORDER BY \"updatedAt\" DESC
LIMIT 8;
")
if [[ ${#SIGS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — |"
else
  for row in "${SIGS[@]}"; do
    IFS='|' read -r id status ext updated <<<"${row}"
    echo "| ${id} | ${status} | ${ext} | ${updated} |"
  done
fi
echo

echo "### Paste checklist (E10)"
echo
echo "| Check | Evidence |"
echo "|-------|----------|"
echo "| DocuSign Ready (unsigned → 401) | Admin → Document signing webhook secret |"
echo "| Wizard send returns envelope id | ContractDocument.envelopeId + SignatureRequest.externalId |"
echo "| Both parties complete in sandbox | SignatureRequest status signed · ContractDocument status signed |"
echo "| Duplicate webhook | second POST same body leaves a single completion |"
echo "| Host script | npm run staging:e10-docusign-evidence |"
echo

if [[ "${MODE}" != "prove-chain" ]]; then
  echo "Collect-only complete. For the webhook prove path:"
  echo "  DOCUSIGN_WEBHOOK_SECRET=… npm run staging:e10-prove-chain"
  exit 0
fi

SECRET="${DOCUSIGN_WEBHOOK_SECRET:-}"
if [[ -z "${SECRET}" ]]; then
  echo "ERROR: prove-chain needs DOCUSIGN_WEBHOOK_SECRET (Admin → Document signing webhook secret)."
  exit 1
fi

e10_id() {
  printf 'e10_%s_%s' "$(date -u +%Y%m%d%H%M%S)" "$(openssl rand -hex 4)"
}

DOC_ID="$(e10_id)"
PARTY_A="$(e10_id)_a"
PARTY_B="$(e10_id)_b"
SIG_ID="$(e10_id)_sig"
ENVELOPE_ID="env_${DOC_ID}"
TITLE="E10 DocuSign prove ${DOC_ID}"

WORKSPACE_ID="$(psql -At -c "SELECT id FROM \"BusinessWorkspace\" ORDER BY \"updatedAt\" DESC LIMIT 1;" || true)"
PROVIDER_ID="$(psql -At -c "SELECT id FROM \"IntegrationProvider\" WHERE kind = 'signing' AND code ILIKE '%docusign%' ORDER BY enabled DESC, \"updatedAt\" DESC LIMIT 1;" || true)"
if [[ -z "${WORKSPACE_ID}" ]]; then
  echo "ERROR: no BusinessWorkspace row."
  exit 1
fi
if [[ -z "${PROVIDER_ID}" ]]; then
  echo "ERROR: no DocuSign IntegrationProvider row — enable DocuSign in Admin → Document signing."
  exit 1
fi

USER_ID="$(psql -At -c "SELECT id FROM \"User\" ORDER BY \"updatedAt\" DESC LIMIT 1;" || true)"
COLLAB_ID="$(psql -At -c "SELECT id FROM \"Collaboration\" ORDER BY \"updatedAt\" DESC LIMIT 1;" || true)"

echo "### Seed DocuSign contract (+ SignatureRequest when a Collaboration exists)"
echo
psql -c "
INSERT INTO \"ContractDocument\" (
  id, \"workspaceId\", \"collaborationId\", title, \"agreementRef\", \"documentType\", \"versionLabel\",
  \"renderedBody\", \"contentDigest\", \"pdfBytes\", status, \"signingChannel\", \"envelopeId\",
  \"createdByUserId\", \"createdAt\", \"updatedAt\"
) VALUES (
  '${DOC_ID}',
  '${WORKSPACE_ID}',
  NULLIF('${COLLAB_ID}', ''),
  '${TITLE}',
  'AGR-E10',
  'collaboration',
  'v1.0',
  'E10 DocuSign staging body',
  'e10digest',
  decode('255044462d312e340a', 'hex'),
  'sent',
  'docusign',
  '${ENVELOPE_ID}',
  NULLIF('${USER_ID}', ''),
  NOW(),
  NOW()
);

INSERT INTO \"ContractParty\" (
  id, \"documentId\", role, name, email, status, \"shareBps\", \"createdAt\"
) VALUES
  ('${PARTY_A}', '${DOC_ID}', 'business', 'E10 Business', 'e10-business@example.com', 'pending', 0, NOW()),
  ('${PARTY_B}', '${DOC_ID}', 'creator', 'E10 Creator', 'e10-creator@example.com', 'pending', 10000, NOW());
" >/dev/null

if [[ -n "${COLLAB_ID}" ]]; then
  psql -c "
  INSERT INTO \"SignatureRequest\" (
    id, \"collaborationId\", \"providerId\", status, title, \"externalId\", \"createdAt\", \"updatedAt\"
  ) VALUES (
    '${SIG_ID}',
    '${COLLAB_ID}',
    '${PROVIDER_ID}',
    'sent',
    '${TITLE}',
    '${ENVELOPE_ID}',
    NOW(),
    NOW()
  );
  " >/dev/null
else
  echo "NOTE: no Collaboration row — proving ContractDocument completion only (SignatureRequest skipped)."
  SIG_ID=""
fi

BODY="$(printf '%s' "{\"event\":\"envelope-completed\",\"data\":{\"envelopeId\":\"${ENVELOPE_ID}\",\"envelopeSummary\":{\"status\":\"completed\"}}}")"
SIG_B64="$(printf '%s' "${BODY}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | openssl base64 -A)"

echo "### POST completed webhook"
echo
CODE1="$(curl -sS -m 30 -o /tmp/influrios-e10-prove1.json -w '%{http_code}' \
  -X POST "${APP_URL}/api/signing/webhook" \
  -H 'content-type: application/json' \
  -H "x-docusign-signature-1: ${SIG_B64}" \
  -d "${BODY}" || true)"
echo "First → HTTP ${CODE1} $(tr -d '\n' </tmp/influrios-e10-prove1.json | cut -c1-200)"
echo

CODE2="$(curl -sS -m 30 -o /tmp/influrios-e10-prove2.json -w '%{http_code}' \
  -X POST "${APP_URL}/api/signing/webhook" \
  -H 'content-type: application/json' \
  -H "x-docusign-signature-1: ${SIG_B64}" \
  -d "${BODY}" || true)"
echo "Duplicate → HTTP ${CODE2} $(tr -d '\n' </tmp/influrios-e10-prove2.json | cut -c1-200)"
echo

DOC_STATUS="$(psql -At -c "SELECT status FROM \"ContractDocument\" WHERE id = '${DOC_ID}';")"
if [[ -n "${SIG_ID}" ]]; then
  SIG_STATUS="$(psql -At -c "SELECT status FROM \"SignatureRequest\" WHERE id = '${SIG_ID}';")"
else
  SIG_STATUS="—(no Collaboration)"
fi
PARTY_SIGNED="$(psql -At -c "SELECT count(*)::text FROM \"ContractParty\" WHERE \"documentId\" = '${DOC_ID}' AND status = 'signed';")"

mkdir -p tmp
cat > tmp/e10-evidence-ids.env <<EOF
E10_CONTRACT_ID=${DOC_ID}
E10_ENVELOPE_ID=${ENVELOPE_ID}
E10_SIGNATURE_REQUEST_ID=${SIG_ID:-}
E10_CONTRACT_STATUS=${DOC_STATUS}
E10_SIGNATURE_STATUS=${SIG_STATUS}
E10_PARTIES_SIGNED=${PARTY_SIGNED}
E10_WEBHOOK_FIRST=${CODE1}
E10_WEBHOOK_DUP=${CODE2}
E10_WHEN=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "### E10 evidence pack"
echo
echo "| Field | Value |"
echo "|-------|-------|"
echo "| contract id | ${DOC_ID} |"
echo "| envelope id | ${ENVELOPE_ID} |"
echo "| SignatureRequest id | ${SIG_ID:-—(none)} |"
echo "| contract status | ${DOC_STATUS} |"
echo "| SignatureRequest status | ${SIG_STATUS} |"
echo "| parties signed | ${PARTY_SIGNED} / 2 |"
echo "| webhook first HTTP | ${CODE1} |"
echo "| webhook duplicate HTTP | ${CODE2} |"
echo
echo "Wrote tmp/e10-evidence-ids.env"
echo
echo "Operator: for a live sandbox envelope, enable DocuSign, send from the contract wizard, complete both parties in DocuSign, then paste that envelope id here too."
echo

OK=1
if [[ "${DOC_STATUS}" != "signed" ]]; then
  echo "FAIL: contract should be signed (got ${DOC_STATUS})"
  OK=0
fi
if [[ -n "${SIG_ID}" && "${SIG_STATUS}" != "signed" ]]; then
  echo "FAIL: SignatureRequest should be signed (got ${SIG_STATUS})"
  OK=0
fi
if [[ "${PARTY_SIGNED}" != "2" ]]; then
  echo "FAIL: both parties should be signed (got ${PARTY_SIGNED})"
  OK=0
fi
if [[ "${CODE1}" != "200" ]]; then
  echo "FAIL: first webhook should be HTTP 200 (got ${CODE1})"
  OK=0
fi

if [[ "${OK}" -eq 1 ]]; then
  echo "E10 prove-chain OK — paste the table into docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md"
  exit 0
fi

echo "E10 prove-chain incomplete — see FAIL lines above."
exit 1
