#!/usr/bin/env bash
set -u
PASS=0; WARN=0; FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 UI TEMPLATE ALIGNMENT HOTFIX VERIFY ==="

FILES=(
  "admin/tv-dedicated-screens.html"
  "admin/tv-dedicated-screens.css"
  "scripts/apply-tv-phase4da2-ui-template-alignment.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check scripts/apply-tv-phase4da2-ui-template-alignment.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq 'class="admin-shell"' admin/tv-dedicated-screens.html \
  && pass "Dedicated Screens memakai existing admin-shell" \
  || fail "admin-shell belum terpasang"

grep -Fq 'class="sidebar"' admin/tv-dedicated-screens.html \
  && pass "Dedicated Screens memakai existing sidebar" \
  || fail "Existing sidebar belum dipakai"

grep -Fq 'class="content"' admin/tv-dedicated-screens.html \
  && grep -Fq 'class="topbar"' admin/tv-dedicated-screens.html \
  && pass "Existing content/topbar layout terpasang" \
  || fail "content/topbar layout tidak sesuai"

grep -Fq 'class="menu-link active" href="tv-dedicated-screens.html"' admin/tv-dedicated-screens.html \
  && pass "Dedicated Screens active menu benar" \
  || fail "Dedicated Screens active menu salah"

if grep -Fq 'class="tv-shell"' admin/tv-dedicated-screens.html \
  || grep -Fq 'class="tv-sidebar"' admin/tv-dedicated-screens.html \
  || grep -Fq 'class="tv-main"' admin/tv-dedicated-screens.html
then
  fail "Legacy custom A2 shell masih tersisa"
else
  pass "Legacy custom A2 shell sudah dihapus"
fi

grep -Fq 'Theme &amp; Layout <small>Phase 4D</small>' admin/tv-dedicated-screens.html \
  && pass "Theme & Layout tetap disabled" \
  || fail "Theme & Layout boundary berubah"

grep -Fq 'Prayer Settings <small>Phase 4D</small>' admin/tv-dedicated-screens.html \
  && pass "Prayer Settings tetap disabled" \
  || fail "Prayer Settings boundary berubah"

grep -Fq 'src="tv-dedicated-screens.js"' admin/tv-dedicated-screens.html \
  && pass "Existing Dedicated Screens JS tetap wired" \
  || fail "Dedicated Screens JS wiring hilang"

if [[ -f scripts/verify-tv-phase4da2-menu-wiring-hotfix.sh ]]; then
  if bash scripts/verify-tv-phase4da2-menu-wiring-hotfix.sh >/tmp/mjhk-4da2-template-menu.log 2>&1; then
    pass "Menu wiring regression CLEAN"
  else
    fail "Menu wiring regression FAIL"
    cat /tmp/mjhk-4da2-template-menu.log
  fi
fi

if [[ -f scripts/verify-tv-phase4da2-dedicated-screens-editor.sh ]]; then
  if bash scripts/verify-tv-phase4da2-dedicated-screens-editor.sh >/tmp/mjhk-4da2-template-editor.log 2>&1; then
    pass "Dedicated Screens editor regression CLEAN"
  else
    fail "Dedicated Screens editor regression FAIL"
    cat /tmp/mjhk-4da2-template-editor.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"; exit 1
