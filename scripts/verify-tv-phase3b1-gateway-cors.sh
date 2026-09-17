#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

FILE="worker-tv-mjhk/src/index.js"
echo "=== MJHK TV PHASE 3B.1 CORS VERIFY ==="

[[ -f "$FILE" ]] && pass "$FILE tersedia" || fail "$FILE tidak ditemukan"
node --check "$FILE" >/dev/null 2>&1 && pass "Worker syntax OK" || fail "Worker syntax ERROR"

grep -Fq 'MJHK_PHASE3B1_CORS_V1' "$FILE" && pass "CORS hotfix marker tersedia" || fail "CORS hotfix marker tidak ditemukan"
grep -Fq '"http://127.0.0.1:5501"' "$FILE" && pass "127.0.0.1:5501 diizinkan" || fail "127.0.0.1:5501 belum diizinkan"
grep -Fq '"http://localhost:5501"' "$FILE" && pass "localhost:5501 diizinkan" || fail "localhost:5501 belum diizinkan"
grep -Fq 'return corsPreflight(request, requestId);' "$FILE" && pass "OPTIONS memakai preflight handler" || fail "OPTIONS preflight handler tidak ditemukan"
grep -Fq '"Access-Control-Allow-Origin": origin' "$FILE" && pass "Access-Control-Allow-Origin tersedia" || fail "Access-Control-Allow-Origin tidak ditemukan"
grep -Fq '"Access-Control-Allow-Methods": CORS_ALLOW_METHODS' "$FILE" && pass "Access-Control-Allow-Methods tersedia" || fail "Access-Control-Allow-Methods tidak ditemukan"
grep -Fq '"Access-Control-Allow-Headers": CORS_ALLOW_HEADERS' "$FILE" && pass "Access-Control-Allow-Headers tersedia" || fail "Access-Control-Allow-Headers tidak ditemukan"
grep -Fq 'Content-Type, x-mjhk-device-code, authorization' "$FILE" && pass "Auth/preflight headers lengkap" || fail "Auth/preflight headers tidak lengkap"
grep -Fq '...corsHeaders(request)' "$FILE" && pass "Normal JSON response membawa CORS" || fail "Normal JSON response belum membawa CORS"
grep -Fq 'function errorResponse(err, requestId, request)' "$FILE" && pass "Error response menerima request context" || fail "Error response belum request-aware"
grep -Fq '"X-Frame-Options": "DENY"' "$FILE" && pass "X-Frame-Options DENY tetap aktif" || fail "X-Frame-Options DENY hilang"
grep -Fq '"X-Content-Type-Options": "nosniff"' "$FILE" && pass "nosniff tetap aktif" || fail "nosniff hilang"

if grep -Fq '"Access-Control-Allow-Origin": "*"' "$FILE"; then
  fail "Wildcard CORS tidak diizinkan untuk device-auth gateway"
else
  pass "Tidak menggunakan wildcard CORS"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
