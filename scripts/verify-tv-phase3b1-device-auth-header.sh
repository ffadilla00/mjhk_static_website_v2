#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.1 DEVICE AUTH HEADER VERIFY ==="

WORKER="worker-tv-mjhk/src/index.js"
CONTRACT="tv-player/assets/js/gateway-contract.generated.js"
GENERATOR="scripts/generate-tv-gateway-contract.mjs"

for f in "$WORKER" "$CONTRACT" "$GENERATOR"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check "$WORKER" >/dev/null 2>&1 \
  && pass "Worker syntax OK" || fail "Worker syntax ERROR"

node --check "$CONTRACT" >/dev/null 2>&1 \
  && pass "Generated contract syntax OK" || fail "Generated contract syntax ERROR"

node --check "$GENERATOR" >/dev/null 2>&1 \
  && pass "Generator syntax OK" || fail "Generator syntax ERROR"

grep -Fq 'request.headers.get("x-mjhk-device-code")' "$WORKER" \
  && pass "Worker expects x-mjhk-device-code" \
  || fail "Worker canonical device header tidak ditemukan"

grep -Fq 'authorization.startsWith("Bearer ")' "$WORKER" \
  && pass "Worker expects Bearer token" \
  || fail "Worker Bearer contract tidak ditemukan"

grep -Fq 'deviceCodeHeader: "x-mjhk-device-code"' "$CONTRACT" \
  && pass "Browser contract memakai x-mjhk-device-code" \
  || fail "Browser device header masih salah"

grep -Fq 'deviceTokenHeader: "authorization"' "$CONTRACT" \
  && pass "Browser contract memakai authorization" \
  || fail "Browser token header salah"

grep -Fq 'tokenScheme: "bearer"' "$CONTRACT" \
  && pass "Browser contract memakai Bearer" \
  || fail "Browser token scheme salah"

grep -Fq 'Content-Type, x-mjhk-device-code, authorization' "$WORKER" \
  && pass "CORS allow-header sesuai actual auth contract" \
  || fail "CORS allow-header belum sesuai actual auth contract"

if grep -Fq 'Content-Type, device-code, authorization' "$WORKER"; then
  fail "Legacy device-code masih dipakai di CORS"
else
  pass "Legacy device-code sudah tidak dipakai di CORS"
fi

grep -Fq 'canonicalCodeHeader' "$GENERATOR" \
  && pass "Generator canonical header preference tersedia" \
  || fail "Generator canonical header preference tidak ditemukan"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
