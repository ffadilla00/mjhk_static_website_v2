#!/usr/bin/env bash
set -u
PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2D-C2 MEDIA FALLBACK VERIFY ==="

B="tv-player/assets/js/presentation-binding.js"
C="tv-player/assets/css/presentation-player-bridge.css"

node --check "$B" >/dev/null 2>&1 \
  && pass "presentation-binding.js syntax OK" \
  || fail "presentation-binding.js syntax ERROR"

grep -Fq 'addEventListener("error"' "$B" \
  && pass "Image error handler tersedia" \
  || fail "Image error handler tidak ditemukan"

grep -Fq 'mjhk-media-fallback' "$B" \
  && pass "Graceful media fallback DOM tersedia" \
  || fail "Media fallback DOM tidak ditemukan"

grep -Fq 'image.hidden = true' "$B" \
  && pass "Browser broken-image UI disembunyikan" \
  || fail "Broken-image suppression tidak ditemukan"

grep -Fq '.mjhk-media-fallback' "$C" \
  && pass "Media fallback styling tersedia" \
  || fail "Media fallback styling tidak ditemukan"

grep -Fq 'has-media-error' "$C" \
  && pass "Image+text fallback layering tersedia" \
  || fail "Image+text fallback layering tidak ditemukan"

if grep -Eq 'innerHTML|insertAdjacentHTML|outerHTML' "$B"; then
  fail "Unsafe HTML rendering ditemukan"
else
  pass "Fallback tetap memakai safe DOM"
fi

if grep -Eqi 'import .*engine|transitionTo|forceState|engine[[:space:]]*\.' "$B"; then
  fail "Fallback tidak boleh menyentuh engine"
else
  pass "Fallback bebas state-engine control"
fi

if [[ -f scripts/verify-tv-phase3b2dc-presentation-binding.sh ]]; then
  bash scripts/verify-tv-phase3b2dc-presentation-binding.sh \
    >/tmp/mjhk-c1-fallback-reg.log 2>&1 \
    && pass "C1 regression CLEAN" \
    || { fail "C1 regression FAIL"; cat /tmp/mjhk-c1-fallback-reg.log; }
fi

if [[ -f scripts/verify-tv-phase3b2dc2-player-bridge.sh ]]; then
  bash scripts/verify-tv-phase3b2dc2-player-bridge.sh \
    >/tmp/mjhk-c2-fallback-reg.log 2>&1 \
    && pass "C2 regression CLEAN" \
    || { fail "C2 regression FAIL"; cat /tmp/mjhk-c2-fallback-reg.log; }
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
