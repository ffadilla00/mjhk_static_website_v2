#!/usr/bin/env bash
set -u

GATEWAY="${1:-https://mjhk-tv-gateway.ffadilla-90.workers.dev}"
ORIGIN="${2:-http://127.0.0.1:5501}"

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

tmp_get="$(mktemp)"
tmp_opt="$(mktemp)"
tmp_bad="$(mktemp)"
trap 'rm -f "$tmp_get" "$tmp_opt" "$tmp_bad"' EXIT

echo "=== MJHK TV GATEWAY CORS SMOKE ==="
echo "Gateway: $GATEWAY"
echo "Origin : $ORIGIN"

curl -sS -D "$tmp_get" -o /dev/null -H "Origin: $ORIGIN" "$GATEWAY/health"

grep -Eqi '^HTTP/[0-9.]+ 200' "$tmp_get" && pass "GET /health -> 200" || fail "GET /health bukan 200"
grep -Fqi "Access-Control-Allow-Origin: $ORIGIN" "$tmp_get" && pass "GET /health mengembalikan allowed origin" || fail "GET /health tidak membawa allowed origin"

curl -sS -D "$tmp_opt" -o /dev/null \
  -X OPTIONS \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,device-code,content-type" \
  "$GATEWAY/v1/device/bootstrap"

grep -Eqi '^HTTP/[0-9.]+ 204' "$tmp_opt" && pass "OPTIONS bootstrap -> 204" || fail "OPTIONS bootstrap bukan 204"
grep -Fqi "Access-Control-Allow-Origin: $ORIGIN" "$tmp_opt" && pass "Preflight allowed origin benar" || fail "Preflight allowed origin hilang"

if grep -Eqi '^Access-Control-Allow-Headers:.*device-code' "$tmp_opt" \
  && grep -Eqi '^Access-Control-Allow-Headers:.*authorization' "$tmp_opt"; then
  pass "Preflight device auth headers diizinkan"
else
  fail "Preflight device auth headers tidak lengkap"
fi

curl -sS -D "$tmp_bad" -o /dev/null -H "Origin: https://evil.example" "$GATEWAY/health"

if grep -Fqi "Access-Control-Allow-Origin:" "$tmp_bad"; then
  fail "Disallowed origin mendapat CORS permission"
else
  pass "Disallowed origin tidak mendapat CORS permission"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
