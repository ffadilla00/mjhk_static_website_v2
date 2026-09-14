#!/usr/bin/env bash
set -u

PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== PHASE 9C.5 DESKTOP NAVBAR POLISH VERIFY ==="

FILE="assets/css/profile-nav-mobile.css"

[[ -f "$FILE" ]] && pass "profile-nav-mobile.css tersedia" || fail "profile-nav-mobile.css tidak ada"

grep -Fq "Phase 9C.5 desktop navbar polish START" "$FILE" \
  && pass "Desktop navbar polish block tersedia" \
  || fail "Desktop navbar polish block tidak ditemukan"

grep -Fq "@media (min-width: 901px)" "$FILE" \
  && pass "Desktop rule dibatasi mulai 901px" \
  || fail "Desktop breakpoint tidak ditemukan"

grep -Fq "width: 62px;" "$FILE" && grep -Fq "height: 62px;" "$FILE" \
  && pass "Logo desktop 62px" \
  || fail "Ukuran logo desktop 62px tidak ditemukan"

grep -Fq "font-size: 18px;" "$FILE" \
  && pass "Nama masjid desktop 18px" \
  || fail "Font nama masjid 18px tidak ditemukan"

grep -Fq "font-size: 16px;" "$FILE" \
  && pass "Menu navbar desktop 16px" \
  || fail "Font menu navbar 16px tidak ditemukan"

grep -Fq "height: 92px;" "$FILE" \
  && pass "Tinggi header desktop 92px" \
  || fail "Tinggi header desktop 92px tidak ditemukan"

if MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh >/tmp/mjhk-desktop-nav-polish.log 2>&1; then
  pass "public-dist build report-only berhasil"
else
  fail "public-dist build gagal"
  tail -n 20 /tmp/mjhk-desktop-nav-polish.log || true
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
else
  echo "RESULT: FAIL"
  exit 1
fi
