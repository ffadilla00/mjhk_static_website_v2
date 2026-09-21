#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4B PROFILE MENU SEPARATION HOTFIX VERIFY ==="

[[ -f admin/tv.html ]] \
  && pass "admin/tv.html tersedia" \
  || fail "admin/tv.html tidak ditemukan"

[[ -f admin/index.html ]] \
  && pass "admin/index.html tersedia" \
  || fail "admin/index.html tidak ditemukan"

node --check scripts/apply-tv-phase4b-profile-menu-hotfix.mjs \
  >/dev/null 2>&1 \
  && pass "Apply script syntax OK" \
  || fail "Apply script syntax ERROR"

if grep -Eqi \
  'href=["'\'']profile\.html["'\'']' \
  admin/tv.html
then
  fail "Profile Masjid masih berada di TV CMS sidebar"
else
  pass "Profile Masjid sudah keluar dari TV CMS sidebar"
fi

if grep -Eqi \
  'href=["'\'']profile\.html["'\'']|Profile Masjid' \
  admin/index.html
then
  pass "Profile Masjid tetap tersedia di Admin utama"
else
  warn "Link Profile Masjid tidak terdeteksi di admin/index.html"
fi

grep -Fq \
  'href="index.html"' \
  admin/tv.html \
  && pass "TV CMS tetap memiliki link kembali ke Dashboard Admin" \
  || fail "Link kembali ke Dashboard Admin hilang"

if [[ -f scripts/verify-tv-phase4b-cms-dashboard.sh ]]; then
  if bash scripts/verify-tv-phase4b-cms-dashboard.sh \
    >/tmp/mjhk-4b-profile-reg.log 2>&1
  then
    pass "Locked Phase 4B dashboard regression CLEAN"
  else
    fail "Phase 4B dashboard regression FAIL"
    cat /tmp/mjhk-4b-profile-reg.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] \
  && echo "RESULT: CLEAN" \
  && exit 0

echo "RESULT: FAIL"
exit 1
