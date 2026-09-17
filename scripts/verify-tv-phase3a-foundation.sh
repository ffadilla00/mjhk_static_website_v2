#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

FILES=(
  "tv-player/index.html"
  "tv-player/assets/css/player.css"
  "tv-player/assets/js/states.js"
  "tv-player/assets/js/scenarios.js"
  "tv-player/assets/js/engine.js"
  "tv-player/assets/js/ui.js"
  "tv-player/assets/js/player.js"
  "tv-player/README.md"
)

echo "=== MJHK TV PHASE 3A FOUNDATION VERIFY ==="

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in tv-player/assets/js/*.js; do
  node --check "$js" >/dev/null 2>&1     && pass "$js syntax OK"     || fail "$js syntax ERROR"
done

grep -Fq 'width: 1920px' tv-player/assets/css/player.css   && grep -Fq 'height: 1080px' tv-player/assets/css/player.css   && pass "Canvas 1920x1080 tersedia"   || fail "Canvas 1920x1080 tidak ditemukan"

for state in NORMAL PRE_ADHAN ADHAN IQAMAH_COUNTDOWN IQAMAH SALAT PRAYER_PROHIBITION SYURUQ ISYRAQ IMSAK FRIDAY_PRE_ADHAN FRIDAY_KHUTBAH FRIDAY_SALAT
do
  grep -Fq "$state" tv-player/assets/js/states.js     && pass "State $state tersedia"     || fail "State $state tidak ditemukan"
done

grep -Fq "Ramadan mode" tv-player/index.html   && grep -Fq "IMSAK" tv-player/assets/js/states.js   && pass "Ramadan/Imsak wiring tersedia"   || fail "Ramadan/Imsak wiring tidak lengkap"

grep -Fq "FRIDAY_KHUTBAH" tv-player/assets/js/scenarios.js   && pass "Friday scenario tersedia"   || fail "Friday scenario tidak ditemukan"

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' tv-player; then
  fail "Player tidak boleh mengandung service-role credential"
else
  pass "Player bebas service-role"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
