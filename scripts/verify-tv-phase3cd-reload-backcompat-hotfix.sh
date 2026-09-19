#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-D RELOAD BACK-COMPAT HOTFIX VERIFY ==="

F="tv-player/assets/js/runtime-command-dispatcher-core.js"

[[ -f "$F" ]] \
  && pass "Dispatcher core tersedia" \
  || fail "Dispatcher core tidak ditemukan"

node --check "$F" >/dev/null 2>&1 \
  && pass "Dispatcher core syntax OK" \
  || fail "Dispatcher core syntax ERROR"

if grep -Fq \
  'command_dispatcher_reload_player_required' \
  "$F"
then
  fail "Reload dependency masih mandatory"
else
  pass "Reload dependency tidak lagi mandatory"
fi

grep -Fq \
  'reload_player_capability_unavailable' \
  "$F" \
  && pass "Fallback reload capability tersedia" \
  || fail "Fallback reload capability hilang"

if [[ -f scripts/verify-tv-phase3cd-sync-now.sh ]]; then
  if bash scripts/verify-tv-phase3cd-sync-now.sh \
    >/tmp/mjhk-3cd-sync-backcompat.log 2>&1
  then
    pass "Locked sync_now regression CLEAN"
  else
    fail "Locked sync_now regression FAIL"
    cat /tmp/mjhk-3cd-sync-backcompat.log
  fi
fi

if [[ -f scripts/verify-tv-phase3cd-reload-player.sh ]]; then
  if bash scripts/verify-tv-phase3cd-reload-player.sh \
    >/tmp/mjhk-3cd-reload-backcompat.log 2>&1
  then
    pass "reload_player verifier CLEAN"
  else
    fail "reload_player verifier FAIL"
    cat /tmp/mjhk-3cd-reload-backcompat.log
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
