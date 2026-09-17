#!/usr/bin/env bash
set -u

GATEWAY="${1:-https://mjhk-tv-gateway.ffadilla-90.workers.dev}"
ORIGIN="${2:-http://127.0.0.1:5501}"

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "=== MJHK TV GATEWAY AUTH PREFLIGHT SMOKE ==="

curl -sS -D "$TMP" -o /dev/null \
  -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,x-mjhk-device-code" \
  "$GATEWAY/v1/device/bootstrap"

grep -Eqi '^HTTP/[0-9.]+ 204' "$TMP" \
  && pass "OPTIONS bootstrap -> 204" \
  || fail "OPTIONS bootstrap bukan 204"

grep -Fqi "Access-Control-Allow-Origin: $ORIGIN" "$TMP" \
  && pass "Allowed origin benar" \
  || fail "Allowed origin hilang"

if grep -Eqi '^Access-Control-Allow-Headers:.*x-mjhk-device-code' "$TMP"; then
  pass "x-mjhk-device-code diizinkan CORS"
else
  fail "x-mjhk-device-code belum diizinkan CORS"
fi

if grep -Eqi '^Access-Control-Allow-Headers:.*authorization' "$TMP"; then
  pass "authorization diizinkan CORS"
else
  fail "authorization belum diizinkan CORS"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
