#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.1 FOUNDATION VERIFY ==="

FILES=(
  "tv-player/gateway-diagnostics.html"
  "tv-player/assets/js/gateway-config.js"
  "tv-player/assets/js/device-session.js"
  "tv-player/assets/js/gateway-client.js"
  "tv-player/assets/js/gateway-diagnostics.js"
  "tv-player/assets/js/gateway-contract.generated.js"
  "scripts/generate-tv-gateway-contract.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/gateway-config.js \
  tv-player/assets/js/device-session.js \
  tv-player/assets/js/gateway-client.js \
  tv-player/assets/js/gateway-diagnostics.js \
  tv-player/assets/js/gateway-contract.generated.js \
  scripts/generate-tv-gateway-contract.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq 'https://mjhk-tv-gateway.ffadilla-90.workers.dev' \
  tv-player/assets/js/gateway-config.js \
  && pass "Gateway production URL tersedia" \
  || fail "Gateway production URL tidak ditemukan"

for route in \
  '/health' \
  '/v1/pair/claim' \
  '/v1/device/bootstrap' \
  '/v1/device/heartbeat' \
  '/v1/device/revision' \
  '/v1/device/revision/ack' \
  '/v1/device/commands' \
  '/v1/device/screenshot'
do
  grep -Fq "$route" tv-player/assets/js/gateway-config.js \
    && pass "Route $route tersedia" \
    || fail "Route $route tidak ditemukan"
done

if grep -R -Eqi 'SUPABASE_URL|SUPABASE_SERVICE_ROLE|sb_secret_' \
  tv-player/assets/js/gateway-*.js tv-player/assets/js/device-session.js; then
  fail "Player gateway layer tidak boleh direct Supabase/service-role"
else
  pass "Player gateway layer bebas direct Supabase/service-role"
fi

# Security guard: detect logging of secret-bearing values only.
# Safe diagnostic strings such as "Device token header" / tokenHeader are allowed.
if grep -R -Eqi \
  'console\.(log|info|debug|warn|error)\([^)]*((session\.)?deviceToken|tokenValue|device_token)' \
  tv-player/assets/js scripts/generate-tv-gateway-contract.mjs; then
  fail "Potential device-token VALUE logging ditemukan"
else
  pass "Tidak ada device-token VALUE logging pada Phase 3B.1"
fi

grep -Fq 'tokenPresent: true' tv-player/assets/js/device-session.js \
  && pass "Safe session metadata tanpa token tersedia" \
  || fail "Safe session metadata tidak ditemukan"

if grep -Fq 'ready: true' tv-player/assets/js/gateway-contract.generated.js; then
  pass "Device auth contract sudah generated"
else
  warn "Device auth contract masih placeholder — jalankan generator"
fi

[[ -f "tv-player/assets/js/engine.js" ]] \
  && pass "Locked engine tetap tersedia" \
  || fail "engine.js tidak ditemukan"

[[ -f "tv-player/assets/js/states.js" ]] \
  && pass "Locked states tetap tersedia" \
  || fail "states.js tidak ditemukan"

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
