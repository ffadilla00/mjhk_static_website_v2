#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-E RUNTIME RECOVERY + FINAL ACCEPTANCE VERIFY ==="

FILES=(
  "tv-player/assets/js/runtime-command-coordinator.js"
  "tv-player/assets/js/runtime-command-dispatcher.js"
  "tv-player/assets/js/runtime-operations-supervisor.js"
  "scripts/apply-tv-phase3ce-runtime-recovery.mjs"
  "scripts/test-tv-phase3ce-command-recovery.mjs"
  "scripts/test-tv-phase3ce-runtime-supervisor.mjs"
  "supabase/tv/phase3c-final/01_final_runtime_acceptance.sql"
  "tv-player/MJHK_TV_Phase3C_E_Final_Acceptance.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/runtime-command-coordinator.js \
  tv-player/assets/js/runtime-command-dispatcher.js \
  tv-player/assets/js/runtime-operations-supervisor.js \
  scripts/apply-tv-phase3ce-runtime-recovery.mjs \
  scripts/test-tv-phase3ce-command-recovery.mjs \
  scripts/test-tv-phase3ce-runtime-supervisor.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

CO="tv-player/assets/js/runtime-command-coordinator.js"
DI="tv-player/assets/js/runtime-command-dispatcher.js"
SU="tv-player/assets/js/runtime-operations-supervisor.js"
P="tv-player/assets/js/player.js"

grep -Fq \
  'command_ack_retry_scheduled' \
  "$CO" \
  && pass "Command ACK retry backoff tersedia" \
  || fail "Command ACK retry hilang"

grep -Fq \
  'retryNow()' \
  "$CO" \
  && pass "Immediate command recovery hook tersedia" \
  || fail "Immediate recovery hook hilang"

grep -Fq \
  'COMMAND_NOT_FOUND_OR_ALREADY_FINAL' \
  "$DI" \
  && pass "Already-final ACK recovery tersedia" \
  || fail "Already-final ACK recovery hilang"

grep -Fq \
  'windowRef.addEventListener(' \
  "$SU" \
  && grep -Fq '"offline"' "$SU" \
  && grep -Fq '"online"' "$SU" \
  && pass "Browser online/offline supervisor tersedia" \
  || fail "Online/offline supervisor hilang"

grep -Fq \
  'runtimeOperationsSupervisor.start();' \
  "$P" \
  && pass "Player runtime supervisor wiring terpasang" \
  || fail "Runtime supervisor startup wiring hilang"

if grep -R -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'\'']*\.supabase\.co' \
  "$CO" "$DI" "$SU"
then
  fail "Recovery layer tidak boleh direct Supabase"
else
  pass "Recovery layer bebas direct Supabase"
fi

if grep -R -Eqi \
  'TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' \
  "$CO" "$DI" "$SU"
then
  fail "Recovery layer tidak boleh mengontrol state engine"
else
  pass "Recovery layer bebas state-engine control"
fi

if node scripts/test-tv-phase3ce-command-recovery.mjs \
  >/tmp/mjhk-3ce-command.log 2>&1
then
  pass "Command recovery unit test CLEAN"
else
  fail "Command recovery unit test FAIL"
  cat /tmp/mjhk-3ce-command.log
fi

if node scripts/test-tv-phase3ce-runtime-supervisor.mjs \
  >/tmp/mjhk-3ce-supervisor.log 2>&1
then
  pass "Runtime supervisor unit test CLEAN"
else
  fail "Runtime supervisor unit test FAIL"
  cat /tmp/mjhk-3ce-supervisor.log
fi

for suite in \
  scripts/verify-tv-phase3cd-reload-backcompat-hotfix.sh \
  scripts/verify-tv-phase3cd-reload-player.sh \
  scripts/verify-tv-phase3cd-sync-now.sh \
  scripts/verify-tv-phase3cc-command-poller.sh \
  scripts/verify-tv-phase3cb-heartbeat.sh \
  scripts/verify-tv-phase3b2ed-revision-ack.sh
do
  if [[ -f "$suite" ]]; then
    name="$(basename "$suite")"
    if bash "$suite" \
      >/tmp/mjhk-3ce-reg.log 2>&1
    then
      pass "$name regression CLEAN"
    else
      fail "$name regression FAIL"
      cat /tmp/mjhk-3ce-reg.log
    fi
  else
    warn "$suite tidak ditemukan"
  fi
done

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
