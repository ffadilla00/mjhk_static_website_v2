#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 DESKTOP LAYOUT HOTFIX VERIFY ==="

FILES=(
  "admin/tv-dedicated-screens.html"
  "admin/tv-dedicated-screens.css"
  "admin/tv-dedicated-screens.js"
  "scripts/apply-tv-phase4da2-desktop-layout-hotfix.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check scripts/apply-tv-phase4da2-desktop-layout-hotfix.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq 'PHASE4D-A2 DESKTOP SHELL HOTFIX START' admin/tv-dedicated-screens.css \
  && pass "Desktop shell hotfix marker tersedia" \
  || fail "Desktop shell hotfix marker hilang"

grep -Fq 'grid-template-columns: 250px minmax(0, 1fr)' admin/tv-dedicated-screens.css \
  && pass "Desktop two-column shell contract tersedia" \
  || fail "Desktop grid contract hilang"

grep -Fq '.admin-shell > main.content' admin/tv-dedicated-screens.css \
  && pass "main.content desktop placement tersedia" \
  || fail "main.content desktop placement hilang"

grep -Fq 'src="tv-dedicated-screens.js"' admin/tv-dedicated-screens.html \
  && pass "Dedicated Screens JS wiring tetap utuh" \
  || fail "Dedicated Screens JS wiring berubah"

if grep -qiE 'supabase|tv_state_assets|tv_content|revision|publish' \
  scripts/apply-tv-phase4da2-desktop-layout-hotfix.mjs
then
  fail "Layout hotfix tidak boleh menyentuh data/revision layer"
else
  pass "Layout hotfix bebas data/revision mutation"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
