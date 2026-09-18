#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2D-C1 PRESENTATION BINDING VERIFY ==="

FILES=(
  tv-player/presentation-binding-diagnostics.html
  tv-player/assets/js/presentation-scheduler.js
  tv-player/assets/js/presentation-binding.js
  tv-player/assets/js/presentation-binding-diagnostics.js
  tv-player/assets/css/presentation-binding-diagnostics.css
  scripts/test-tv-phase3b2dc-presentation-binding.mjs
  scripts/audit-tv-phase3b2dc-player-wiring.sh
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/presentation-scheduler.js \
  tv-player/assets/js/presentation-binding.js \
  tv-player/assets/js/presentation-binding-diagnostics.js \
  scripts/test-tv-phase3b2dc-presentation-binding.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

B="tv-player/assets/js/presentation-binding.js"

grep -Fq 'this.#state !== "NORMAL"' "$B" \
  && pass "NORMAL-only slideshow guard tersedia" \
  || fail "NORMAL-only slideshow guard hilang"

grep -Fq 'setPresentationState(state)' "$B" \
  && pass "Presentation-only state API eksplisit" \
  || fail "Presentation-only state API tidak ditemukan"

grep -Fq 'document.createElement' "$B" \
  && grep -Fq 'textContent' "$B" \
  && pass "Safe DOM rendering tersedia" \
  || fail "Safe DOM rendering hilang"

if grep -Eq 'innerHTML|insertAdjacentHTML|outerHTML' "$B"; then
  fail "Unsafe HTML rendering ditemukan"
else
  pass "Tidak ada unsafe HTML rendering"
fi

grep -Fq 'presentationFullscreen' "$B" \
  && pass "Fullscreen flag tersedia" \
  || fail "Fullscreen flag hilang"

grep -Fq 'runningTextLine' "$B" \
  && pass "State-aware running text tersedia" \
  || fail "Running text binding hilang"

grep -Fq 'seconds * 1000' "$B" \
  && pass "Per-slide duration cycle tersedia" \
  || fail "Duration cycle hilang"

if grep -R -Eqi \
  'import[[:space:]].*engine|from[[:space:]]+["'\''].*engine|transitionTo|forceState|engine[[:space:]]*\.[[:space:]]*setState' \
  tv-player/assets/js/presentation-binding*.js \
  tv-player/assets/js/presentation-scheduler.js
then
  fail "State-engine control ditemukan"
else
  pass "Presentation binding bebas state-engine control"
fi

if grep -R -Eqi 'revision.*ack|/revision/ack|ackRevision' \
  tv-player/assets/js/presentation-binding*.js \
  tv-player/assets/js/presentation-scheduler.js
then
  fail "ACK tidak boleh ada"
else
  pass "Tidak melakukan revision ACK"
fi

node scripts/test-tv-phase3b2dc-presentation-binding.mjs \
  >/tmp/mjhk3b2dc.log 2>&1 \
  && pass "Scheduler unit test CLEAN" \
  || { fail "Scheduler unit test FAIL"; cat /tmp/mjhk3b2dc.log; }

[[ -f tv-player/assets/js/engine.js ]] \
  && pass "Locked engine tetap tersedia" \
  || fail "Locked engine hilang"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
