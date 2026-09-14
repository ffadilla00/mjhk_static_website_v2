#!/usr/bin/env bash
set -u

PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== PHASE 9C.5 NAVBAR SIZE POLISH VERIFY ==="

FILE="assets/css/profile-nav-mobile.css"

[[ -f "$FILE" ]] && pass "profile-nav-mobile.css tersedia" || fail "profile-nav-mobile.css tidak ada"

grep -Fq "Phase 9C.5 navbar size polish START" "$FILE" \
  && pass "Navbar size polish block tersedia" \
  || fail "Navbar size polish block tidak ditemukan"

grep -Fq "width: 56px;" "$FILE" && grep -Fq "height: 56px;" "$FILE" \
  && pass "Logo mobile diperbesar ke 56px" \
  || fail "Ukuran logo 56px tidak ditemukan"

grep -Fq "font-size: 16px;" "$FILE" \
  && pass "Font navbar mobile diperbesar" \
  || fail "Font 16px tidak ditemukan"

grep -Fq "height: 86px;" "$FILE" && grep -Fq "top: 86px;" "$FILE" \
  && pass "Header dan posisi menu sinkron di 86px" \
  || fail "Sinkronisasi tinggi navbar/top menu tidak ditemukan"

grep -Fq "@media (max-width: 380px)" "$FILE" \
  && pass "Fallback layar sangat sempit tersedia" \
  || fail "Fallback <=380px tidak ditemukan"

if MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh >/tmp/mjhk-nav-polish-build.log 2>&1; then
  pass "public-dist build report-only berhasil"
else
  fail "public-dist build gagal"
  tail -n 20 /tmp/mjhk-nav-polish-build.log || true
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
