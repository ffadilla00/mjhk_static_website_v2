#!/usr/bin/env bash
set -u

FILE="worker-tv-mjhk/src/index.js"
PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV CORS SOURCE VERIFY ==="

[[ -f "$FILE" ]] && pass "$FILE tersedia" || { fail "$FILE tidak ada"; exit 1; }

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
  grep -Fq "\"$origin\"" "$FILE" \
    && pass "$origin diizinkan" \
    || fail "$origin belum diizinkan"
done

grep -Fq 'const CORS_ALLOW_METHODS = "GET, POST, OPTIONS";' "$FILE" \
  && pass "CORS methods tidak berubah" \
  || fail "CORS methods berubah"

grep -Fq 'const CORS_ALLOW_HEADERS = "Content-Type, x-mjhk-device-code, authorization";' "$FILE" \
  && pass "CORS headers tidak berubah" \
  || fail "CORS headers berubah"

if grep -Eq 'Access-Control-Allow-Origin["'\'']?[[:space:]]*:[[:space:]]*["'\'']\*["'\'']|Access-Control-Allow-Origin.*\*' "$FILE"; then
  fail "Wildcard Access-Control-Allow-Origin ditemukan"
else
  pass "Tidak ada wildcard Access-Control-Allow-Origin"
fi

grep -Fq 'if (!CORS_ALLOWED_ORIGINS.has(origin))' "$FILE" \
  && pass "Preflight tetap menolak origin di luar allowlist" \
  || fail "Preflight allowlist guard hilang"

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
