#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2D-B TYPED PRESENTATION ADAPTER VERIFY ==="

FILES=(
  "tv-player/presentation-adapter-diagnostics.html"
  "tv-player/assets/js/presentation-adapter.js"
  "tv-player/assets/js/presentation-adapter-diagnostics.js"
  "scripts/test-tv-phase3b2d-presentation-adapter.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/presentation-adapter.js \
  tv-player/assets/js/presentation-adapter-diagnostics.js \
  scripts/test-tv-phase3b2d-presentation-adapter.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

ADAPTER="tv-player/assets/js/presentation-adapter.js"

grep -Fq '"image",' "$ADAPTER" \
  && grep -Fq '"text",' "$ADAPTER" \
  && grep -Fq '"image_text",' "$ADAPTER" \
  && pass "Observed slideshow union types locked" \
  || fail "Playlist union types incomplete"

grep -Fq '"IQAMAH_COUNTDOWN"' "$ADAPTER" \
  && grep -Fq '"FRIDAY_KHUTBAH"' "$ADAPTER" \
  && pass "Locked state allowlist tersedia" \
  || fail "Locked state allowlist incomplete"

grep -Fq 'url_https_required' "$ADAPTER" \
  && pass "HTTPS media URL guard tersedia" \
  || fail "HTTPS guard tidak ditemukan"

grep -Fq 'datetime_window_invalid' "$ADAPTER" \
  && pass "Scheduling window guard tersedia" \
  || fail "Scheduling guard tidak ditemukan"

grep -Fq 'deepFreeze(output)' "$ADAPTER" \
  && pass "Typed presentation output immutable" \
  || fail "Deep-freeze output tidak ditemukan"

if grep -R -Eqi 'revision.*ack|/revision/ack|ackRevision' \
  tv-player/assets/js/presentation-adapter*.js; then
  fail "3B.2D-B tidak boleh melakukan revision ACK"
else
  pass "3B.2D-B tidak melakukan revision ACK"
fi

if grep -R -Eqi 'setState|transitionTo|engine\.|forceState' \
  tv-player/assets/js/presentation-adapter*.js; then
  fail "3B.2D-B tidak boleh menyentuh state engine"
else
  pass "3B.2D-B tidak menyentuh state engine"
fi

if grep -R -Eqi 'innerHTML|insertAdjacentHTML|document\.querySelector.*player' \
  tv-player/assets/js/presentation-adapter.js; then
  fail "Typed adapter tidak boleh melakukan DOM binding"
else
  pass "Typed adapter bebas DOM binding"
fi

if grep -R -Eqi 'console\.(log|info|debug|warn|error)\([^)]*(text|image_url|body|heading)' \
  tv-player/assets/js/presentation-adapter*.js; then
  fail "Potential content-value logging ditemukan"
else
  pass "Tidak ada content-value logging"
fi

node scripts/test-tv-phase3b2d-presentation-adapter.mjs >/tmp/mjhk-3b2d-b.log 2>&1
TEST_RC=$?

if [[ "$TEST_RC" -eq 0 ]]; then
  pass "Typed presentation adapter unit test CLEAN"
else
  fail "Typed presentation adapter unit test FAIL"
  cat /tmp/mjhk-3b2d-b.log
fi

[[ -f "tv-player/assets/js/engine.js" ]] \
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
