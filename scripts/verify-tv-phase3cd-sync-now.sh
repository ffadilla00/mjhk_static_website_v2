#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-D SYNC_NOW DISPATCHER + ACK VERIFY ==="

FILES=(
  "tv-player/assets/js/runtime-command-dispatcher-core.js"
  "tv-player/assets/js/runtime-command-dispatcher.js"
  "tv-player/assets/js/runtime-command-coordinator.js"
  "scripts/apply-tv-phase3cd-sync-now.mjs"
  "scripts/test-tv-phase3cd-command-dispatcher.mjs"
  "supabase/tv/phase3c-commands/02_seed_sync_now_acceptance.sql"
  "supabase/tv/phase3c-commands/03_verify_sync_now_ack.sql"
  "tv-player/MJHK_TV_Phase3C_D_SyncNow.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/runtime-command-dispatcher-core.js \
  tv-player/assets/js/runtime-command-dispatcher.js \
  tv-player/assets/js/runtime-command-coordinator.js \
  scripts/apply-tv-phase3cd-sync-now.mjs \
  scripts/test-tv-phase3cd-command-dispatcher.mjs \
  tv-player/assets/js/revision-sync-startup.js
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

C="tv-player/assets/js/runtime-command-dispatcher-core.js"
A="tv-player/assets/js/runtime-command-dispatcher.js"
R="tv-player/assets/js/revision-sync-startup.js"
P="tv-player/assets/js/player.js"

grep -Fq \
  'runRevisionSyncNow' \
  "$A" "$R" \
  && pass "sync_now memakai locked revision startup pipeline" \
  || fail "sync_now revision pipeline wiring hilang"

grep -Fq \
  'GATEWAY_CONFIG.routes.commandAck' \
  "$A" \
  && pass "Command ACK memakai Gateway contract" \
  || fail "Command ACK Gateway route hilang"

grep -Fq \
  'status === "success"' \
  "$A" \
  && grep -Fq \
  'status === "noop"' \
  "$A" \
  && pass "Success dan NOOP dianggap sync_now berhasil" \
  || fail "sync_now success/NOOP semantics tidak lengkap"

grep -Fq \
  'isBatchFullyAcknowledged' \
  tv-player/assets/js/runtime-command-coordinator.js \
  && pass "Poller hold hanya dilepas setelah ACK batch selesai" \
  || fail "ACK-gated hold release hilang"

if grep -R -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'\'']*\.supabase\.co' \
  "$C" "$A" tv-player/assets/js/runtime-command-coordinator.js
then
  fail "Command dispatcher tidak boleh direct Supabase"
else
  pass "Command dispatcher bebas direct Supabase"
fi

if grep -R -Eqi \
  'TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' \
  "$C" "$A" tv-player/assets/js/runtime-command-coordinator.js
then
  fail "Command dispatcher tidak boleh mengontrol state engine"
else
  pass "Command dispatcher bebas state-engine control"
fi

grep -Fq \
  'createRuntimeCommandDispatcher' \
  "$P" \
  && grep -Fq \
  'attachRuntimeCommandCoordinator' \
  "$P" \
  && pass "Player dispatcher/coordinator wiring terpasang" \
  || fail "Player command dispatcher wiring hilang"

grep -Fq \
  'ack_result: ackResult' \
  "$R" \
  && pass "Revision startup mengembalikan safe sync outcome" \
  || fail "Revision startup result bridge hilang"

if node scripts/test-tv-phase3cd-command-dispatcher.mjs \
  >/tmp/mjhk-3cd.log 2>&1
then
  pass "Command dispatcher unit test CLEAN"
else
  fail "Command dispatcher unit test FAIL"
  cat /tmp/mjhk-3cd.log
fi

if [[ -f scripts/verify-tv-phase3cc-command-poller.sh ]]; then
  if bash scripts/verify-tv-phase3cc-command-poller.sh \
    >/tmp/mjhk-3cd-3cc-reg.log 2>&1
  then
    pass "Locked Phase 3C-C regression CLEAN"
  else
    fail "Locked Phase 3C-C regression FAIL"
    cat /tmp/mjhk-3cd-3cc-reg.log
  fi
fi

if [[ -f scripts/verify-tv-phase3cb-heartbeat.sh ]]; then
  if bash scripts/verify-tv-phase3cb-heartbeat.sh \
    >/tmp/mjhk-3cd-3cb-reg.log 2>&1
  then
    pass "Locked Phase 3C-B regression CLEAN"
  else
    fail "Locked Phase 3C-B regression FAIL"
    cat /tmp/mjhk-3cd-3cb-reg.log
  fi
fi

if [[ -f scripts/verify-tv-phase3b2ed-revision-ack.sh ]]; then
  if bash scripts/verify-tv-phase3b2ed-revision-ack.sh \
    >/tmp/mjhk-3cd-3b-reg.log 2>&1
  then
    pass "Locked Phase 3B regression CLEAN"
  else
    fail "Locked Phase 3B regression FAIL"
    cat /tmp/mjhk-3cd-3b-reg.log
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
