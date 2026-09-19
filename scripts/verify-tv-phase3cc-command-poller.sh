#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-C COMMAND POLLING CORE VERIFY ==="

FILES=(
  "tv-player/assets/js/runtime-command-poller-core.js"
  "tv-player/assets/js/runtime-command-poller.js"
  "scripts/apply-tv-phase3cc-command-poller.mjs"
  "scripts/test-tv-phase3cc-command-poller.mjs"
  "supabase/tv/phase3c-commands/01_verify_command_lease.sql"
  "tv-player/MJHK_TV_Phase3C_C_Command_Polling.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/runtime-command-poller-core.js \
  tv-player/assets/js/runtime-command-poller.js \
  scripts/apply-tv-phase3cc-command-poller.mjs \
  scripts/test-tv-phase3cc-command-poller.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

C="tv-player/assets/js/runtime-command-poller-core.js"
A="tv-player/assets/js/runtime-command-poller.js"
P="tv-player/assets/js/player.js"
SU="tv-player/assets/js/runtime-operations-supervisor.js"

grep -Fq \
  'GATEWAY_CONFIG.routes.commands' \
  "$A" \
  && pass "Command poller memakai Gateway route contract" \
  || fail "Gateway command route hilang"

grep -Fq '#inFlight' "$C" \
  && pass "Command polling single-flight guard tersedia" \
  || fail "Single-flight guard hilang"

grep -Fq 'command_batch_waiting_for_dispatcher' "$C" \
  && pass "Lease-aware hold tersedia" \
  || fail "Lease-aware hold hilang"

grep -Fq 'command_type_not_allowed' "$C" \
  && pass "Strict command allowlist tersedia" \
  || fail "Command allowlist guard hilang"

ACK_INDICATOR_FOUND=0

grep -R -Fq \
  'GATEWAY_CONFIG.routes.commandAck' \
  "$C" "$A" \
  && ACK_INDICATOR_FOUND=1

grep -R -Eqi \
  '/v1/device/commands/.+/ack|commandAck[[:space:]]*\(|ackCommand[[:space:]]*\(|acknowledgeCommand[[:space:]]*\(' \
  "$C" "$A" \
  && ACK_INDICATOR_FOUND=1

if [[ "$ACK_INDICATOR_FOUND" -eq 1 ]]; then
  fail "3C-C belum boleh memiliki command ACK transport"
else
  pass "3C-C belum mengirim command ACK"
fi

if grep -R -Eqi \
  'location\.reload|startRevisionStartupSync|syncOnce[[:space:]]*\(|TVStateEngine|window\.close|captureStream|getDisplayMedia|html2canvas' \
  "$C" "$A"
then
  fail "3C-C tidak boleh mengeksekusi command"
else
  pass "3C-C command names only; no execution API"
fi

if grep -R -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'\'']*\.supabase\.co' \
  "$C" "$A"
then
  fail "Command poller tidak boleh direct Supabase"
else
  pass "Command poller bebas direct Supabase"
fi

# Phase-aware runtime ownership:
# - 3C-C/3C-D: player owns poller start/stop directly.
# - 3C-E: runtime supervisor owns poller start/stop.
if [[ -f "$SU" ]] \
  && grep -Fq 'runtimeOperationsSupervisor.start();' "$P" \
  && grep -Fq 'commandPoller: runtimeCommandPoller' "$P" \
  && grep -Fq 'commandPoller.start({' "$SU"
then
  pass "Player command poller startup didelegasikan ke Phase 3C-E supervisor"
elif grep -Fq \
  'runtimeCommandPoller.start({ immediate: true })' \
  "$P"
then
  pass "Player command poller startup wiring terpasang"
else
  fail "Player command poller startup ownership hilang"
fi

if [[ -f "$SU" ]] \
  && grep -Fq 'commandPoller.stop();' "$SU"
then
  pass "Command poller cleanup didelegasikan ke Phase 3C-E supervisor"
elif grep -Fq \
  'runtimeCommandPoller.stop();' \
  "$P"
then
  pass "Player command poller cleanup terpasang"
else
  fail "Command poller cleanup ownership hilang"
fi

if node scripts/test-tv-phase3cc-command-poller.mjs \
  >/tmp/mjhk-3cc.log 2>&1
then
  pass "Command poller unit test CLEAN"
else
  fail "Command poller unit test FAIL"
  cat /tmp/mjhk-3cc.log
fi

if [[ -f scripts/verify-tv-phase3cb-heartbeat.sh ]]; then
  if bash scripts/verify-tv-phase3cb-heartbeat.sh \
    >/tmp/mjhk-3cc-3cb-reg.log 2>&1
  then
    pass "Locked Phase 3C-B regression CLEAN"
  else
    fail "Locked Phase 3C-B regression FAIL"
    cat /tmp/mjhk-3cc-3cb-reg.log
  fi
fi

if [[ -f scripts/verify-tv-phase3b2ed-revision-ack.sh ]]; then
  if bash scripts/verify-tv-phase3b2ed-revision-ack.sh \
    >/tmp/mjhk-3cc-3b-reg.log 2>&1
  then
    pass "Locked Phase 3B regression CLEAN"
  else
    fail "Locked Phase 3B regression FAIL"
    cat /tmp/mjhk-3cc-3b-reg.log
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
