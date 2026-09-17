#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3A.1 FULL-BLEED VERIFY ==="

CSS="tv-player/assets/css/full-bleed-polish.css"
INDEX="tv-player/index.html"

[[ -f "$CSS" ]] && pass "$CSS tersedia" || fail "$CSS tidak ditemukan"

grep -Fq 'assets/css/full-bleed-polish.css' "$INDEX" \
  && pass "index.html memuat full-bleed stylesheet" \
  || fail "full-bleed stylesheet belum direferensikan"

grep -Fq '.content-panel' "$CSS" \
  && grep -Fq 'padding: 0 !important' "$CSS" \
  && pass "Whitespace content-panel dihapus" \
  || fail "content-panel belum full-bleed"

grep -Fq '.slide-card' "$CSS" \
  && grep -Fq 'border-radius: 0 !important' "$CSS" \
  && pass "Slideshow surface full area" \
  || fail "Slideshow masih memiliki outer radius/gutter"

grep -Fq '.state-overlay' "$CSS" \
  && grep -Fq 'inset: 0 !important' "$CSS" \
  && pass "Dedicated state surface full area" \
  || fail "Dedicated state belum full-bleed"

grep -Fq -- '--mjhk-content-safe-x: 64px' "$CSS" \
  && grep -Fq -- '--mjhk-content-safe-y: 56px' "$CSS" \
  && pass "Safe-area internal tetap tersedia" \
  || fail "Safe-area content tidak ditemukan"

grep -Fq 'object-fit: cover' "$CSS" \
  && pass "Future image/video full-bleed contract tersedia" \
  || fail "Media fill contract tidak ditemukan"

# Guard: this patch must not touch the locked logic files.
if [[ -e "tv-player/assets/js/engine.js" ]]; then
  pass "Locked engine tetap tersedia"
else
  fail "engine.js hilang"
fi

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' "$CSS"; then
  fail "Secret/service-role reference terdeteksi"
else
  pass "Patch bebas secret/service-role"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
