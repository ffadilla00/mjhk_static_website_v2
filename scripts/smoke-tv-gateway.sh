#!/usr/bin/env bash
set -u

BASE_URL="${1:-}"
PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: bash scripts/smoke-tv-gateway.sh https://<worker>.workers.dev"
  exit 2
fi

BASE_URL="${BASE_URL%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "=== MJHK TV GATEWAY SMOKE ==="
echo "Gateway: $BASE_URL"

code="$(curl -sS -o "$TMP/health.json" -w "%{http_code}" "$BASE_URL/health" || true)"
if [[ "$code" == "200" ]] && grep -Fq '"service":"mjhk-tv-gateway"' "$TMP/health.json"; then
  pass "Health OK"
else
  fail "Health gagal (HTTP $code)"
fi

headers="$(curl -sSI "$BASE_URL/health" || true)"
grep -Fqi "cache-control: no-store" <<<"$headers" \
  && pass "no-store aktif" || fail "no-store tidak ditemukan"
grep -Fqi "x-content-type-options: nosniff" <<<"$headers" \
  && pass "nosniff aktif" || fail "nosniff tidak ditemukan"

code="$(curl -sS -o "$TMP/bootstrap.json" -w "%{http_code}" "$BASE_URL/v1/device/bootstrap" || true)"
[[ "$code" == "401" ]] \
  && pass "Bootstrap tanpa device auth ditolak" \
  || fail "Bootstrap tanpa auth harus 401, dapat $code"

code="$(curl -sS -o "$TMP/pair-get.json" -w "%{http_code}" "$BASE_URL/v1/pair/claim" || true)"
[[ "$code" == "405" ]] \
  && pass "Pair endpoint menolak GET" \
  || fail "Pair GET harus 405, dapat $code"

code="$(curl -sS -o "$TMP/pair-type.json" -w "%{http_code}" \
  -X POST "$BASE_URL/v1/pair/claim" \
  -H "Content-Type: text/plain" \
  --data 'abc' || true)"
[[ "$code" == "415" ]] \
  && pass "Pair endpoint mewajibkan JSON" \
  || fail "Pair non-JSON harus 415, dapat $code"

code="$(curl -sS -o "$TMP/pair-bad.json" -w "%{http_code}" \
  -X POST "$BASE_URL/v1/pair/claim" \
  -H "Content-Type: application/json" \
  --data '{"pairing_code":"BAD"}' || true)"
if [[ "$code" == "401" || "$code" == "400" ]]; then
  pass "Pairing code invalid ditolak aman"
else
  fail "Pairing invalid diharapkan 400/401, dapat $code"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
