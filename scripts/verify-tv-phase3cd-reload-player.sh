#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-D RELOAD_PLAYER DISPATCHER + ACK VERIFY ==="

FILES=(
  "tv-player/assets/js/runtime-command-dispatcher-core.js"
  "tv-player/assets/js/runtime-command-dispatcher.js"
  "scripts/apply-tv-phase3cd-reload-player.mjs"
  "scripts/test-tv-phase3cd-reload-player.mjs"
  "supabase/tv/phase3c-commands/04_seed_reload_player_acceptance.sql"
  "supabase/tv/phase3c-commands/05_verify_reload_player_ack.sql"
  "tv-player/MJHK_TV_Phase3C_D_ReloadPlayer.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/runtime-command-dispatcher-core.js \
  tv-player/assets/js/runtime-command-dispatcher.js \
  scripts/apply-tv-phase3cd-reload-player.mjs \
  scripts/test-tv-phase3cd-reload-player.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

C="tv-player/assets/js/runtime-command-dispatcher-core.js"
A="tv-player/assets/js/runtime-command-dispatcher.js"

grep -Fq \
  'commandType === "sync_now"' \
  "$C" \
  && pass "sync_now path tetap tersedia" \
  || fail "sync_now path hilang"

grep -Fq \
  'commandType === "reload_player"' \
  "$C" \
  && pass "reload_player path tersedia" \
  || fail "reload_player path hilang"

grep -Fq \
  'prepareReloadPlayer' \
  "$C" "$A" \
  && pass "Reload capability diprepare sebelum ACK" \
  || fail "Reload capability preparation hilang"

grep -Fq \
  'after_ack' \
  "$C" "$A" \
  && pass "Post-ACK reload action tersedia" \
  || fail "Post-ACK reload action hilang"

grep -Fq \
  'windowRef.location.reload()' \
  "$A" \
  && pass "Real browser reload capability tersedia" \
  || fail "Browser reload capability hilang"

grep -Fq \
  'GATEWAY_CONFIG.routes.commandAck' \
  "$A" \
  && pass "Command ACK tetap memakai Gateway contract" \
  || fail "Gateway command ACK route hilang"

if grep -R -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'\'']*\.supabase\.co' \
  "$C" "$A"
then
  fail "Reload dispatcher tidak boleh direct Supabase"
else
  pass "Reload dispatcher bebas direct Supabase"
fi

if grep -R -Eqi \
  'TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' \
  "$C" "$A"
then
  fail "Reload dispatcher tidak boleh mengontrol state engine"
else
  pass "Reload dispatcher bebas state-engine control"
fi

if node scripts/test-tv-phase3cd-reload-player.mjs \
  >/tmp/mjhk-3cd-reload.log 2>&1
then
  pass "reload_player unit test CLEAN"
else
  fail "reload_player unit test FAIL"
  cat /tmp/mjhk-3cd-reload.log
fi

if [[ -f scripts/verify-tv-phase3cd-sync-now.sh ]]; then
  if bash scripts/verify-tv-phase3cd-sync-now.sh \
    >/tmp/mjhk-3cd-sync-reg.log 2>&1
  then
    pass "Locked sync_now regression CLEAN"
  else
    fail "Locked sync_now regression FAIL"
    cat /tmp/mjhk-3cd-sync-reg.log
  fi
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
