#!/usr/bin/env bash
set -u

GATEWAY="${1:-https://mjhk-tv-gateway.ffadilla-90.workers.dev}"
PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

check_health() {
  local origin="$1"
  local headers
  headers="$(mktemp)"

  curl -sS -D "$headers" -o /dev/null \
    --max-time 15 \
    -H "Origin: $origin" \
    "$GATEWAY/health" || true

  if grep -Fqi "access-control-allow-origin: $origin" "$headers"; then
    pass "GET /health CORS -> $origin"
  else
    fail "GET /health CORS -> $origin"
  fi

  rm -f "$headers"
}

check_pair_preflight() {
  local origin="$1"
  local headers
  headers="$(mktemp)"

  curl -sS -D "$headers" -o /dev/null \
    --max-time 15 \
    -X OPTIONS \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" \
    "$GATEWAY/v1/pair/claim" || true

  if grep -q '^HTTP/.* 204' "$headers" \
    && grep -Fqi "access-control-allow-origin: $origin" "$headers" \
    && grep -Fqi "access-control-allow-methods: GET, POST, OPTIONS" "$headers" \
    && grep -Fqi "access-control-allow-headers: Content-Type, x-mjhk-device-code, authorization" "$headers"; then
    pass "Pair preflight -> $origin"
  else
    fail "Pair preflight -> $origin"
  fi

  rm -f "$headers"
}

check_bootstrap_preflight() {
  local origin="$1"
  local headers
  headers="$(mktemp)"

  curl -sS -D "$headers" -o /dev/null \
    --max-time 15 \
    -X OPTIONS \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,x-mjhk-device-code" \
    "$GATEWAY/v1/device/bootstrap" || true

  if grep -q '^HTTP/.* 204' "$headers" \
    && grep -Fqi "access-control-allow-origin: $origin" "$headers"; then
    pass "Bootstrap preflight -> $origin"
  else
    fail "Bootstrap preflight -> $origin"
  fi

  rm -f "$headers"
}

echo "=== MJHK TV LIVE CORS MULTI-ORIGIN SMOKE ==="
echo "Gateway: $GATEWAY"
echo

for origin in \
  "http://127.0.0.1:5501" \
  "http://127.0.0.1:5502" \
  "http://127.0.0.1:5503" \
  "http://localhost:5501" \
  "http://localhost:5502" \
  "http://localhost:5503" \
  "https://www.mj-harapankita.or.id" \
  "https://mj-harapankita.or.id"
do
  check_health "$origin"
done

for origin in \
  "http://127.0.0.1:5501" \
  "http://127.0.0.1:5502" \
  "http://127.0.0.1:5503" \
  "https://www.mj-harapankita.or.id" \
  "https://mj-harapankita.or.id"
do
  check_pair_preflight "$origin"
  check_bootstrap_preflight "$origin"
done

echo
echo "PASS: $PASS"
echo "WARN: 0"
echo "FAIL: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAILED"
exit 1
