#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-E TRANSPORT RECOVERY HOTFIX VERIFY ==="

SU="tv-player/assets/js/runtime-operations-supervisor.js"

[[ -f "$SU" ]] \
  && pass "Runtime supervisor tersedia" \
  || fail "Runtime supervisor hilang"

node --check "$SU" >/dev/null 2>&1 \
  && pass "Runtime supervisor syntax OK" \
  || fail "Runtime supervisor syntax ERROR"

grep -Fq \
  'mjhk:runtime-heartbeat' \
  "$SU" \
  && pass "Supervisor mendengar heartbeat runtime event" \
  || fail "Heartbeat runtime event listener hilang"

grep -Fq \
  'heartbeat_transport_failed' \
  "$SU" \
  && pass "Transport failure state tersedia" \
  || fail "Transport failure state hilang"

grep -Fq \
  'heartbeat_recovered' \
  "$SU" \
  && pass "Heartbeat recovery state tersedia" \
  || fail "Heartbeat recovery state hilang"

grep -Fq \
  'heartbeat.start({' \
  "$SU" \
  && grep -Fq \
  'commandPoller.stop();' \
  "$SU" \
  && pass "Heartbeat probe tetap aktif saat command poller dipause" \
  || fail "Recovery probe ownership tidak benar"

if node scripts/test-tv-phase3ce-runtime-supervisor.mjs \
  >/tmp/mjhk-3ce-transport.log 2>&1
then
  pass "Transport recovery unit test CLEAN"
else
  fail "Transport recovery unit test FAIL"
  cat /tmp/mjhk-3ce-transport.log
fi

if [[ -f scripts/verify-tv-phase3ce-runtime-recovery.sh ]]; then
  if bash scripts/verify-tv-phase3ce-runtime-recovery.sh \
    >/tmp/mjhk-3ce-full-reg.log 2>&1
  then
    pass "Full Phase 3C-E regression CLEAN"
  else
    fail "Full Phase 3C-E regression FAIL"
    cat /tmp/mjhk-3ce-full-reg.log
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
