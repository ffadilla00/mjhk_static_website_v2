#!/usr/bin/env bash
set -u

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

CSS="admin/tv-admin.css"
PRAYER="admin/tv-prayer-settings.html"
THEME="admin/tv-theme-layout.html"

echo "=== MJHK TV CMS ACTION BUTTON CONVENTION VERIFY ==="

grep -Fq 'MJHK TV CMS action button convention v1' "$CSS" \
  && pass "shared action button convention present" \
  || fail "shared action button convention missing"

grep -Fq '.btn.btn-save' "$CSS" \
  && pass "save button class defined" \
  || fail "save button class missing"

grep -Fq '.btn.btn-cancel' "$CSS" \
  && pass "cancel button class defined" \
  || fail "cancel button class missing"

grep -Eq 'id=["'\'']saveGlobalBtn["'\''][^>]*class=["'\''][^"'\'']*btn-save|class=["'\''][^"'\'']*btn-save[^"'\'']*["'\''][^>]*id=["'\'']saveGlobalBtn["'\'']' "$PRAYER" \
  && pass "Simpan Global is green-action class" \
  || fail "Simpan Global btn-save missing"

grep -Eq 'id=["'\'']savePrayerRulesBtn["'\''][^>]*class=["'\''][^"'\'']*btn-save|class=["'\''][^"'\'']*btn-save[^"'\'']*["'\''][^>]*id=["'\'']savePrayerRulesBtn["'\'']' "$PRAYER" \
  && pass "Simpan Aturan Salat is green-action class" \
  || fail "Simpan Aturan Salat btn-save missing"

grep -Eq 'class=["'\''][^"'\'']*btn-save[^"'\'']*["'\''][^>]*>[[:space:]]*Simpan Perubahan[[:space:]]*</button>' "$THEME" \
  && pass "Theme & Layout Simpan Perubahan is green-action class" \
  || fail "Theme & Layout btn-save missing"

echo "=== RESULT: PASS=$PASS FAIL=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
