#!/usr/bin/env bash
set -u

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: bash scripts/smoke-tv-gateway-revision-route.sh https://<worker>.workers.dev"
  exit 2
fi

BASE_URL="${BASE_URL%/}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# A syntactically valid fake device credential is intentional:
# correct routing should reach the device RPC and be rejected as 401.
# The previous route-shadow bug returned 405 before authentication/RPC.
CODE="MJHK-ROUTE-TEST"
TOKEN="$(printf 'a%.0s' {1..64})"
REVISION="00000000-0000-4000-8000-000000000000"

STATUS="$(curl -sS -o "$TMP" -w "%{http_code}" \
  -X POST "$BASE_URL/v1/device/revision/ack" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-MJHK-Device-Code: $CODE" \
  -H "Content-Type: application/json" \
  --data "{\"revision_id\":\"$REVISION\",\"success\":true}" || true)"

echo "=== REVISION ACK ROUTE REGRESSION ==="
echo "HTTP: $STATUS"

if [[ "$STATUS" == "401" ]]; then
  echo "[PASS] POST /v1/device/revision/ack reaches auth/RPC path (not shadowed)"
  echo "RESULT: CLEAN"
  exit 0
fi

if [[ "$STATUS" == "405" ]]; then
  echo "[FAIL] revision ACK is still shadowed by dynamic GET revision route"
else
  echo "[FAIL] expected 401 with fake credential, got $STATUS"
fi

cat "$TMP" 2>/dev/null || true
echo
echo "RESULT: FAIL"
exit 1
