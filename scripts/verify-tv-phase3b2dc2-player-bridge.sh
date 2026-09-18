#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2D-C2 SURGICAL PLAYER BRIDGE VERIFY ==="

FILES=(
  "tv-player/assets/js/presentation-player-bridge.js"
  "tv-player/assets/css/presentation-player-bridge.css"
  "scripts/apply-tv-phase3b2dc2-player-bridge.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/presentation-player-bridge.js \
  scripts/apply-tv-phase3b2dc2-player-bridge.mjs \
  tv-player/assets/js/presentation-binding.js \
  tv-player/assets/js/presentation-scheduler.js
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq 'presentation-player-bridge.css' tv-player/index.html \
  && pass "Bridge CSS terpasang di player" \
  || fail "Bridge CSS belum terpasang"

grep -Fq 'createPresentationPlayerBridge' tv-player/assets/js/player.js \
  && pass "Player menginisialisasi presentation bridge" \
  || fail "Player bridge initialization tidak ditemukan"

grep -Fq 'presentationBridge.setPresentationState(event.detail.state)' \
  tv-player/assets/js/player.js \
  && pass "Engine state hanya diteruskan ke presentation layer" \
  || fail "State forwarding tidak ditemukan"

grep -Fq '#normalContent' tv-player/assets/js/presentation-player-bridge.js \
  && grep -Fq '#runningText' tv-player/assets/js/presentation-player-bridge.js \
  && grep -Fq '#tvStage' tv-player/assets/js/presentation-player-bridge.js \
  && pass "Bridge memakai DOM contract hasil audit" \
  || fail "DOM contract bridge tidak lengkap"

grep -Fq 'presentationMount' tv-player/assets/js/presentation-player-bridge.js \
  && pass "Non-destructive presentation mount tersedia" \
  || fail "Presentation mount tidak ditemukan"

grep -Fq 'data-presentation-fullscreen' tv-player/assets/css/presentation-player-bridge.css \
  && pass "Fullscreen layout binding tersedia" \
  || fail "Fullscreen CSS binding tidak ditemukan"

grep -Fq '#stateOverlay' tv-player/assets/css/presentation-player-bridge.css \
  && pass "Dedicated state overlay tetap di atas presentation" \
  || fail "State overlay protection tidak ditemukan"

if grep -R -Eqi \
  'import[[:space:]].*engine|TVStateEngine|transitionTo|forceState|engine[[:space:]]*\.' \
  tv-player/assets/js/presentation-player-bridge.js
then
  fail "Bridge tidak boleh mengontrol state engine"
else
  pass "Bridge bebas state-engine control"
fi

if grep -R -Eqi 'revision.*ack|/revision/ack|ackRevision' \
  tv-player/assets/js/presentation-player-bridge.js
then
  fail "Bridge belum boleh melakukan revision ACK"
else
  pass "Bridge tidak melakukan revision ACK"
fi

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_|supabase\.co' \
  tv-player/assets/js/presentation-player-bridge.js
then
  fail "Bridge tidak boleh direct Supabase/service-role"
else
  pass "Bridge bebas direct Supabase/service-role"
fi

if grep -Eq 'innerHTML|insertAdjacentHTML|outerHTML' \
  tv-player/assets/js/presentation-player-bridge.js
then
  fail "Unsafe HTML ditemukan di bridge"
else
  pass "Bridge bebas unsafe HTML"
fi

# Locked engine file is only required to remain present.
[[ -f tv-player/assets/js/engine.js ]] \
  && pass "Locked engine tetap tersedia" \
  || fail "Locked engine hilang"

# Re-run C1 verifier when available.
if [[ -x scripts/verify-tv-phase3b2dc-presentation-binding.sh ]] || \
   [[ -f scripts/verify-tv-phase3b2dc-presentation-binding.sh ]]; then
  if bash scripts/verify-tv-phase3b2dc-presentation-binding.sh \
      >/tmp/mjhk-c1-regression.log 2>&1; then
    pass "C1 presentation binding regression CLEAN"
  else
    fail "C1 presentation binding regression FAIL"
    cat /tmp/mjhk-c1-regression.log
  fi
else
  warn "C1 verifier tidak ditemukan"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
