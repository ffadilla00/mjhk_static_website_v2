#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 MENU WIRING HOTFIX VERIFY ==="

FILES=(
  "admin/tv.html"
  "admin/tv-content.html"
  "admin/tv-running-text.html"
  "admin/tv-dedicated-screens.html"
  "scripts/apply-tv-phase4da2-dedicated-screens-menu.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check scripts/apply-tv-phase4da2-dedicated-screens-menu.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

for f in admin/tv.html admin/tv-content.html admin/tv-running-text.html; do
  if grep -Fq '<a class="menu-link" href="tv-dedicated-screens.html">Dedicated Screens</a>' "$f"; then
    pass "$f Dedicated Screens link aktif"
  else
    fail "$f Dedicated Screens link belum aktif"
  fi

  if grep -Fq 'Theme &amp; Layout <small>Phase 4D</small>' "$f"; then
    pass "$f Theme & Layout tetap disabled"
  else
    fail "$f Theme & Layout berubah/tidak ditemukan"
  fi

  if grep -Fq 'Prayer Settings <small>Phase 4D</small>' "$f"; then
    pass "$f Prayer Settings tetap disabled"
  else
    fail "$f Prayer Settings berubah/tidak ditemukan"
  fi
done

if grep -Fq 'class="menu-link active" href="tv.html">Dashboard TV</a>' admin/tv.html; then
  pass "Dashboard TV active state tetap utuh"
else
  fail "Dashboard TV active state berubah"
fi

if grep -Fq 'class="menu-link active" href="tv-content.html">Slideshow</a>' admin/tv-content.html; then
  pass "Slideshow active state tetap utuh"
else
  fail "Slideshow active state berubah"
fi

if grep -Fq 'class="menu-link active" href="tv-running-text.html">Running Text</a>' admin/tv-running-text.html; then
  pass "Running Text active state tetap utuh"
else
  fail "Running Text active state berubah"
fi

if [[ -f scripts/verify-tv-phase4da2-dedicated-screens-editor.sh ]]; then
  if bash scripts/verify-tv-phase4da2-dedicated-screens-editor.sh >/tmp/mjhk-4da2-menu-editor.log 2>&1; then
    pass "Phase 4D-A2 editor regression CLEAN"
  else
    fail "Phase 4D-A2 editor regression FAIL"
    cat /tmp/mjhk-4da2-menu-editor.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
