#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3A.1 VISUAL POLISH VERIFY ==="

FILES=(
  "tv-player/index.html"
  "tv-player/assets/css/player.css"
  "tv-player/assets/js/ui.js"
  "tv-player/assets/js/player.js"
  "tv-player/assets/js/visual-config.js"
  "tv-player/MJHK_TV_Phase3A1_Visual_Contract.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/ui.js \
  tv-player/assets/js/player.js \
  tv-player/assets/js/visual-config.js
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

# Locked engine / zero transition must still be present in the working tree.
grep -Fq "Do not emit an expired countdown frame" tv-player/assets/js/engine.js \
  && pass "Locked zero-state transition tetap aktif" \
  || fail "Locked zero-state transition marker tidak ditemukan"

grep -Fq 'logoUrl: null' tv-player/assets/js/visual-config.js \
  && pass "Identity/logo config contract tersedia" \
  || fail "Identity/logo config contract tidak ditemukan"

for type in text image image_text video finance_report gallery; do
  grep -Fq "\"$type\"" tv-player/assets/js/visual-config.js \
    && pass "Slideshow type $type tersedia" \
    || fail "Slideshow type $type tidak ditemukan"
done

for state in PRE_ADHAN IQAMAH_COUNTDOWN FRIDAY_PRE_ADHAN; do
  STATE="$state" node --input-type=module -e "
    import { VISUAL_CONFIG } from './tv-player/assets/js/visual-config.js';
    const p = VISUAL_CONFIG.stateScreens[process.env.STATE];
    if (!p || p.customizable !== false || p.owner !== 'mjhk') process.exit(1);
  " >/dev/null 2>&1 \
    && pass "$state locked MJHK template" \
    || fail "$state ownership salah"
done

for state in ADHAN IQAMAH SALAT PRAYER_PROHIBITION SYURUQ ISYRAQ IMSAK FRIDAY_KHUTBAH FRIDAY_SALAT; do
  STATE="$state" node --input-type=module -e "
    import { VISUAL_CONFIG } from './tv-player/assets/js/visual-config.js';
    const p = VISUAL_CONFIG.stateScreens[process.env.STATE];
    if (!p || p.customizable !== true || p.owner !== 'admin') process.exit(1);
  " >/dev/null 2>&1 \
    && pass "$state admin-customizable contract" \
    || fail "$state custom asset contract salah"
done

grep -Fq 'audioCue: "beep"' tv-player/assets/js/visual-config.js \
  && pass "Beep tercatat sebagai audio rule terpisah" \
  || fail "Beep contract tidak ditemukan"

grep -Fq 'prayerPanelPosition: "left"' tv-player/assets/js/visual-config.js \
  && grep -Fq 'data-prayer-position="right"' tv-player/assets/css/player.css \
  && pass "Prayer panel left/right tersedia" \
  || fail "Prayer panel positioning tidak lengkap"

grep -Fq 'prayerHighlightBackground' tv-player/assets/js/visual-config.js \
  && pass "Prayer highlight custom theme tersedia" \
  || fail "Prayer highlight custom theme tidak ditemukan"

grep -Fq 'runningTextByState' tv-player/assets/js/visual-config.js \
  && grep -Fq 'running-text-hidden' tv-player/assets/css/player.css \
  && pass "Running-text state policy tersedia" \
  || fail "Running-text state policy tidak lengkap"

grep -Fq '?mode=production' tv-player/index.html \
  && grep -Fq 'mode") === "production"' tv-player/assets/js/player.js \
  && pass "Production preview mode tersedia" \
  || fail "Production preview mode tidak ditemukan"

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' tv-player; then
  fail "TV player mengandung service-role/secret reference"
else
  pass "TV player bebas service-role/secret"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
