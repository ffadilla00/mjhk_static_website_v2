#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-E SUPERVISOR WIRING HOTFIX v4 VERIFY ==="

P="tv-player/assets/js/player.js"
S="tv-player/assets/js/runtime-operations-supervisor.js"

for f in "$P" "$S"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

node --check "$P" >/dev/null 2>&1 \
  && pass "player.js syntax OK" \
  || fail "player.js syntax ERROR"

node --check "$S" >/dev/null 2>&1 \
  && pass "runtime supervisor syntax OK" \
  || fail "runtime supervisor syntax ERROR"

grep -Fq \
  'createRuntimeOperationsSupervisor' \
  "$P" \
  && pass "Supervisor import/creation tersedia" \
  || fail "Supervisor import/creation hilang"

grep -Fq \
  'heartbeat: runtimeHeartbeat' \
  "$P" \
  && grep -Fq \
  'commandPoller: runtimeCommandPoller' \
  "$P" \
  && grep -Fq \
  'commandCoordinator: runtimeCommandCoordinator' \
  "$P" \
  && pass "Supervisor dependency wiring lengkap" \
  || fail "Supervisor dependency wiring tidak lengkap"

START_COUNT="$(
  grep -oF \
    'runtimeOperationsSupervisor.start();' \
    "$P" | wc -l | tr -d '[:space:]'
)"

[[ "$START_COUNT" == "1" ]] \
  && pass "Supervisor start tepat satu kali" \
  || fail "Supervisor start count = $START_COUNT"

if grep -Fq \
  'runtimeHeartbeat.start({ immediate: true })' \
  "$P"
then
  fail "player.js masih start heartbeat secara langsung"
else
  pass "Direct heartbeat start sudah dihapus"
fi

if grep -Fq \
  'runtimeCommandPoller.start({ immediate: true })' \
  "$P"
then
  fail "player.js masih start command poller secara langsung"
else
  pass "Direct command poller start sudah dihapus"
fi

grep -Fq \
  'runtimeOperationsSupervisor.stop();' \
  "$P" \
  && pass "Supervisor pagehide cleanup terpasang" \
  || fail "Supervisor cleanup hilang"

grep -Fq \
  'SUPERVISOR_VERSION = "3c-e-v4"' \
  "$S" \
  && pass "Supervisor runtime marker v4 tersedia" \
  || fail "Supervisor version marker hilang"

grep -Fq \
  'runtimeSupervisorVersion' \
  "$S" \
  && grep -Fq \
  'runtimeNetworkStatus' \
  "$S" \
  && pass "Runtime diagnostic dataset markers tersedia" \
  || fail "Runtime dataset diagnostics hilang"

if node scripts/test-tv-phase3ce-runtime-supervisor.mjs \
  >/tmp/mjhk-3ce-v4-supervisor.log 2>&1
then
  pass "Runtime supervisor unit test CLEAN"
else
  fail "Runtime supervisor unit test FAIL"
  cat /tmp/mjhk-3ce-v4-supervisor.log
fi

if [[ -f scripts/verify-tv-phase3ce-runtime-recovery.sh ]]; then
  if bash scripts/verify-tv-phase3ce-runtime-recovery.sh \
    >/tmp/mjhk-3ce-v4-full.log 2>&1
  then
    pass "Full Phase 3C-E regression CLEAN"
  else
    fail "Full Phase 3C-E regression FAIL"
    cat /tmp/mjhk-3ce-v4-full.log
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
