#!/usr/bin/env bash
set -u

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

THEME_JS="admin/tv-theme-layout.js"
PARITY_JS="admin/tv-theme-layout-parity.js"
RENDERER="tv-player/assets/js/preview-renderer.js"
CSS="admin/tv-theme-layout.css"

echo "=== MJHK TV PHASE 4D-B1 PREVIEW PARITY HOTFIX V2 VERIFY ==="

grep -Fq 'window.mjhkThemePreviewRefresh' "$THEME_JS" \
  && pass "legacy updatePreview delegates to iframe bridge" \
  || fail "updatePreview delegate missing"

if grep -Fq 'const root = $("tvPreview")' "$THEME_JS"; then
  fail "legacy #tvPreview DOM dependency still present"
else
  pass "legacy #tvPreview DOM dependency removed"
fi

grep -Fq 'window.mjhkThemePreviewRefresh = sendPreview' "$PARITY_JS" \
  && pass "preview refresh bridge exported" \
  || fail "preview refresh bridge missing"

grep -Fq 'const LOGICAL_WIDTH = 1920' "$PARITY_JS" \
  && pass "logical preview width 1920" \
  || fail "logical preview width missing"

grep -Fq 'const LOGICAL_HEIGHT = 1080' "$PARITY_JS" \
  && pass "logical preview height 1080" \
  || fail "logical preview height missing"

grep -Fq 'ResizeObserver' "$PARITY_JS" \
  && pass "responsive iframe scaler present" \
  || fail "responsive iframe scaler missing"

grep -Fq 'prayerPositionSelect: $("#prayerPositionSelect")' "$RENDERER" \
  && pass "prayerPositionSelect ref present" \
  || fail "prayerPositionSelect ref missing"

grep -Fq 'applyVisualConfig(refs, visualConfig)' "$RENDERER" \
  && pass "real visual config application retained" \
  || fail "real visual config application missing"

grep -Fq 'tv-player-preview-viewport' "$CSS" \
  && pass "preview viewport CSS present" \
  || fail "preview viewport CSS missing"

grep -Fq 'width:1920px' "$CSS" \
  && pass "iframe logical width CSS present" \
  || fail "iframe logical width CSS missing"

grep -Fq 'height:1080px' "$CSS" \
  && pass "iframe logical height CSS present" \
  || fail "iframe logical height CSS missing"

if grep -En \
  'revision-sync|runtime-heartbeat|runtime-command|gateway-client|fetch\(|\.rpc\(' \
  "$RENDERER" >/dev/null 2>&1; then
  fail "preview renderer has runtime/network side effects"
else
  pass "preview renderer remains runtime/network isolated"
fi

node --check "$THEME_JS" >/dev/null 2>&1 \
  && pass "theme JS syntax clean" \
  || fail "theme JS syntax error"

node --check "$PARITY_JS" >/dev/null 2>&1 \
  && pass "parity JS syntax clean" \
  || fail "parity JS syntax error"

node --check "$RENDERER" >/dev/null 2>&1 \
  && pass "preview renderer syntax clean" \
  || fail "preview renderer syntax error"

echo "=== RESULT: PASS=$PASS FAIL=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
