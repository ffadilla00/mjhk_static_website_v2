#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2E-C PLAYER STARTUP INTEGRATION VERIFY ==="

FILES=(
  "tv-player/assets/js/revision-sync-startup-dependencies.js"
  "tv-player/assets/js/revision-sync-startup.js"
  "tv-player/assets/js/revision-sync-orchestrator.js"
  "tv-player/assets/js/presentation-player-bridge.js"
  "scripts/apply-tv-phase3b2ec-player-startup.mjs"
  "scripts/test-tv-phase3b2ec-startup-dependencies.mjs"
  "tv-player/MJHK_TV_Phase3B2E_C_Player_Startup.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/revision-sync-startup-dependencies.js \
  tv-player/assets/js/revision-sync-startup.js \
  tv-player/assets/js/revision-sync-orchestrator.js \
  tv-player/assets/js/presentation-player-bridge.js \
  scripts/apply-tv-phase3b2ec-player-startup.mjs \
  scripts/test-tv-phase3b2ec-startup-dependencies.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq \
  'startRevisionStartupSync' \
  tv-player/assets/js/player.js \
  && pass "Player startup sync terpasang" \
  || fail "Player startup sync belum terpasang"

grep -Fq \
  'void startRevisionStartupSync({ presentationBridge });' \
  tv-player/assets/js/player.js \
  && pass "Player boot memakai startup coordinator" \
  || fail "Startup coordinator call tidak ditemukan"

if grep -Fq \
  'void presentationBridge.initialize();' \
  tv-player/assets/js/player.js
then
  fail "Legacy standalone bridge initialize masih aktif"
else
  pass "Bridge initialization sudah dimiliki startup coordinator"
fi

D="tv-player/assets/js/revision-sync-startup-dependencies.js"
S="tv-player/assets/js/revision-sync-startup.js"
B="tv-player/assets/js/presentation-player-bridge.js"
ACK="tv-player/assets/js/revision-ack-delivery.js"

grep -Fq \
  'GATEWAY_CONFIG.routes.revisionById(revisionId)' \
  "$D" \
  && pass "Desired revision fetch memakai Gateway contract" \
  || fail "Revision fetch contract tidak ditemukan"

grep -Fq \
  'prepareCandidatePresentation' \
  "$D" \
  && pass "Candidate preflight path tersedia" \
  || fail "Candidate preflight path hilang"

grep -Fq \
  'presentationBridge.applyPresentationConfig' \
  "$D" \
  && pass "Candidate presentation apply tersedia" \
  || fail "Candidate presentation apply hilang"

grep -Fq \
  'revisionStore.promoteCandidate' \
  "$D" \
  && pass "Candidate promotion dependency tersedia" \
  || fail "Candidate promotion dependency hilang"

grep -Fq \
  'rollbackPresentation' \
  "$D" \
  && pass "Promotion-failure UI rollback guard tersedia" \
  || fail "UI rollback guard hilang"

grep -Fq \
  'applyPresentationConfig' \
  "$B" \
  && grep -Fq \
  'clearPresentationConfig' \
  "$B" \
  && pass "Bridge transactional config API tersedia" \
  || fail "Bridge transactional API tidak lengkap"

# Phase-aware ACK rule:
# - Before Phase D exists, Phase C must not send ACK.
# - After Phase D exists, startup may orchestrate ACK, but transport endpoint must
#   remain delegated to revision-ack-delivery.js, never hardcoded in startup/deps.
if [[ -f "$ACK" ]]; then
  if grep -Fq 'RevisionAckDelivery' "$S" \
    && ! grep -Fq '/v1/device/revision/ack' "$S" \
    && ! grep -Fq '/v1/device/revision/ack' "$D"
  then
    pass "ACK didelegasikan ke Phase 3B.2E-D delivery layer"
  else
    fail "ACK Phase D tidak terdelegasi dengan benar"
  fi
else
  if grep -R -Eqi \
    'revision/ack|ackRevision|RevisionAckDelivery|revisionAck' \
    "$S" "$D"
  then
    fail "3B.2E-C belum boleh mengirim revision ACK"
  else
    pass "Startup integration belum mengirim revision ACK"
  fi
fi

if grep -R -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'\'']*\.supabase\.co' \
  "$S" "$D"
then
  fail "Startup integration tidak boleh direct Supabase"
else
  pass "Startup integration bebas direct Supabase"
fi

if grep -R -Eqi \
  'TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' \
  "$S" "$D"
then
  fail "Startup sync tidak boleh mengontrol state engine"
else
  pass "Startup sync bebas state-engine control"
fi

if node scripts/test-tv-phase3b2ec-startup-dependencies.mjs \
  >/tmp/mjhk-3b2ec.log 2>&1
then
  pass "Startup dependency unit test CLEAN"
else
  fail "Startup dependency unit test FAIL"
  cat /tmp/mjhk-3b2ec.log
fi

if [[ -f scripts/verify-tv-phase3b2e-b-sync-orchestrator.sh ]]; then
  if bash scripts/verify-tv-phase3b2e-b-sync-orchestrator.sh \
    >/tmp/mjhk-3b2eb-reg.log 2>&1
  then
    pass "3B.2E-B regression CLEAN"
  else
    fail "3B.2E-B regression FAIL"
    cat /tmp/mjhk-3b2eb-reg.log
  fi
fi

if [[ -f scripts/verify-tv-phase3b2dc2-player-bridge.sh ]]; then
  if bash scripts/verify-tv-phase3b2dc2-player-bridge.sh \
    >/tmp/mjhk-3b2dc2-reg.log 2>&1
  then
    pass "3B.2D-C2 regression CLEAN"
  else
    fail "3B.2D-C2 regression FAIL"
    cat /tmp/mjhk-3b2dc2-reg.log
  fi
fi

[[ -f tv-player/assets/js/engine.js ]] \
  && pass "Locked engine tetap tersedia" \
  || fail "Locked engine hilang"

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
