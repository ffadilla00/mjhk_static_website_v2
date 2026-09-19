#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-B HEARTBEAT CORE VERIFY ==="

FILES=(
  "tv-player/assets/js/runtime-heartbeat-core.js"
  "tv-player/assets/js/runtime-heartbeat.js"
  "scripts/apply-tv-phase3cb-heartbeat.mjs"
  "scripts/test-tv-phase3cb-heartbeat.mjs"
  "supabase/tv/phase3c-heartbeat/01_verify_heartbeat.sql"
  "tv-player/MJHK_TV_Phase3C_B_Heartbeat.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/runtime-heartbeat-core.js \
  tv-player/assets/js/runtime-heartbeat.js \
  scripts/apply-tv-phase3cb-heartbeat.mjs \
  scripts/test-tv-phase3cb-heartbeat.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

C="tv-player/assets/js/runtime-heartbeat-core.js"
A="tv-player/assets/js/runtime-heartbeat.js"
P="tv-player/assets/js/player.js"
SU="tv-player/assets/js/runtime-operations-supervisor.js"

grep -Fq \
  'GATEWAY_CONFIG.routes.heartbeat' \
  "$A" \
  && pass "Heartbeat memakai Gateway route contract" \
  || fail "Gateway heartbeat route hilang"

grep -Fq \
  '#inFlight' \
  "$C" \
  && pass "Heartbeat single-flight guard tersedia" \
  || fail "Single-flight guard hilang"

grep -Fq \
  'MAX_BACKOFF_MS' \
  "$C" \
  && pass "Heartbeat bounded backoff tersedia" \
  || fail "Backoff guard hilang"

grep -Fq \
  'sanitizeTelemetry' \
  "$C" \
  && pass "Telemetry allowlist sanitizer tersedia" \
  || fail "Telemetry sanitizer hilang"

if grep -R -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'\'']*\.supabase\.co' \
  "$C" "$A"
then
  fail "Heartbeat tidak boleh direct Supabase"
else
  pass "Heartbeat bebas direct Supabase"
fi

if grep -R -Eqi \
  'TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' \
  "$C" "$A"
then
  fail "Heartbeat tidak boleh mengontrol state engine"
else
  pass "Heartbeat bebas state-engine control"
fi

if grep -Eqi \
  'console\.(log|info|debug|warn|error).*device(Token|_token)|console\.(log|info|debug|warn|error).*Bearer' \
  "$C" "$A"
then
  fail "Potential device credential logging ditemukan"
else
  pass "Heartbeat bebas credential logging"
fi

grep -Fq \
  'createRuntimeHeartbeat' \
  "$P" \
  && pass "Player heartbeat wiring terpasang" \
  || fail "Player heartbeat wiring belum terpasang"

# Phase-aware runtime ownership:
# - 3C-B/3C-C/3C-D: player starts heartbeat directly.
# - 3C-E: runtime supervisor owns heartbeat start/stop.
if [[ -f "$SU" ]] \
  && grep -Fq 'runtimeOperationsSupervisor.start();' "$P" \
  && grep -Fq 'heartbeat: runtimeHeartbeat' "$P" \
  && grep -Fq 'heartbeat.start({' "$SU"
then
  pass "Heartbeat startup didelegasikan ke Phase 3C-E supervisor"
elif grep -Fq \
  'runtimeHeartbeat.start({ immediate: true })' \
  "$P"
then
  pass "Heartbeat start setelah startup sync tersedia"
else
  fail "Heartbeat startup ownership tidak ditemukan"
fi

if node scripts/test-tv-phase3cb-heartbeat.mjs \
  >/tmp/mjhk-3cb.log 2>&1
then
  pass "Heartbeat unit test CLEAN"
else
  fail "Heartbeat unit test FAIL"
  cat /tmp/mjhk-3cb.log
fi

if [[ -f scripts/verify-tv-phase3b2ed-revision-ack.sh ]]; then
  if bash scripts/verify-tv-phase3b2ed-revision-ack.sh \
    >/tmp/mjhk-3cb-3b-reg.log 2>&1
  then
    pass "Locked Phase 3B regression CLEAN"
  else
    fail "Locked Phase 3B regression FAIL"
    cat /tmp/mjhk-3cb-3b-reg.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] \
  && echo "RESULT: CLEAN" \
  && exit 0

echo "RESULT: FAIL"
exit 1
