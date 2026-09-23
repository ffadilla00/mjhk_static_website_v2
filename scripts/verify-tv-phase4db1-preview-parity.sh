#!/usr/bin/env bash
set -u

PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-B1 PREVIEW PARITY VERIFY ==="

[[ -f tv-player/preview.html ]] \
  && pass "preview.html exists" \
  || fail "preview.html missing"

[[ -f tv-player/assets/js/preview-renderer.js ]] \
  && pass "preview renderer exists" \
  || fail "preview renderer missing"

[[ -f admin/tv-theme-layout-parity.js ]] \
  && pass "CMS parity bridge exists" \
  || fail "CMS parity bridge missing"

grep -Fq 'assets/css/player.css' tv-player/preview.html \
  && pass "preview uses player.css" \
  || fail "player.css missing"

grep -Fq 'assets/css/full-bleed-polish.css' tv-player/preview.html \
  && pass "preview uses full-bleed-polish.css" \
  || fail "full-bleed-polish.css missing"

grep -Fq 'assets/css/presentation-player-bridge.css' tv-player/preview.html \
  && pass "preview uses presentation-player-bridge.css" \
  || fail "presentation-player-bridge.css missing"

grep -Fq 'assets/js/preview-renderer.js' tv-player/preview.html \
  && pass "preview renderer entry wired" \
  || fail "preview renderer entry missing"

if grep -Fq 'assets/js/player.js' tv-player/preview.html; then
  fail "preview must not boot production player.js"
else
  pass "preview does not boot production player.js"
fi

grep -Fq 'assets/js/player.js' tv-player/index.html \
  && pass "production player entry unchanged" \
  || fail "production player entry changed"

grep -Fq 'applyVisualConfig' tv-player/assets/js/preview-renderer.js \
  && pass "preview reuses real applyVisualConfig" \
  || fail "applyVisualConfig reuse missing"

if grep -En \
  'revision-sync|runtime-heartbeat|runtime-command|gateway-client|fetch\(|\.rpc\(' \
  tv-player/assets/js/preview-renderer.js >/dev/null 2>&1; then
  fail "preview renderer must not have runtime/network side effects"
else
  pass "preview renderer is runtime/network isolated"
fi

grep -Fq 'mjhk-tv-theme-preview' admin/tv-theme-layout-parity.js \
  && pass "CMS postMessage bridge present" \
  || fail "CMS postMessage bridge missing"

grep -Fq 'mjhk-tv-theme-preview-ready' tv-player/assets/js/preview-renderer.js \
  && pass "preview ready handshake present" \
  || fail "preview ready handshake missing"

grep -Fq 'event.origin !== window.location.origin' admin/tv-theme-layout-parity.js \
  && pass "CMS message origin guard present" \
  || fail "CMS message origin guard missing"

grep -Fq 'event.origin !== window.location.origin' tv-player/assets/js/preview-renderer.js \
  && pass "player preview origin guard present" \
  || fail "player preview origin guard missing"

grep -Fq 'tv-theme-layout-parity.js' admin/tv-theme-layout.html \
  && pass "Theme page bridge wired" \
  || fail "Theme page bridge not wired"

grep -Fq 'tv-player-preview-frame' admin/tv-theme-layout.css \
  && pass "iframe styling present" \
  || fail "iframe styling missing"

node --check tv-player/assets/js/preview-renderer.js >/dev/null 2>&1 \
  && pass "preview-renderer.js syntax clean" \
  || fail "preview-renderer.js syntax error"

node --check admin/tv-theme-layout-parity.js >/dev/null 2>&1 \
  && pass "theme parity JS syntax clean" \
  || fail "theme parity JS syntax error"

echo "=== RESULT: PASS=$PASS FAIL=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
