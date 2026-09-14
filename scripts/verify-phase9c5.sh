#!/usr/bin/env bash
set -u
PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== PHASE 9C.5 FINAL VERIFY ==="

node --check assets/js/profile-nav-mobile.js >/dev/null 2>&1 \
  && pass "profile-nav-mobile.js syntax OK" \
  || fail "profile-nav-mobile.js syntax error"

[[ -f assets/css/profile-nav-mobile.css ]] \
  && pass "profile-nav-mobile.css tersedia" \
  || fail "profile-nav-mobile.css tidak ada"

[[ $(grep -Foc 'assets/css/profile-nav-mobile.css' index.html 2>/dev/null || true) -eq 1 ]] \
  && pass "index.html memuat CSS tepat satu kali" \
  || fail "CSS reference index.html tidak tepat"

[[ $(grep -Foc 'assets/js/profile-nav-mobile.js' index.html 2>/dev/null || true) -eq 1 ]] \
  && pass "index.html memuat JS tepat satu kali" \
  || fail "JS reference index.html tidak tepat"

grep -q 'id="navLinks"' index.html && grep -q 'nav-dropdown-toggle' index.html && grep -q 'nav-dropdown-menu' index.html \
  && pass "Struktur dropdown Profile homepage lengkap" \
  || fail "Struktur dropdown Profile homepage tidak lengkap"

found=0
for p in profile/sejarah.html profile/visi-misi.html profile/struktur-dkm.html profile/program-fasilitas.html; do
  grep -Fq "$p" index.html && found=$((found+1))
done
[[ "$found" -eq 4 ]] && pass "4 submenu Profile homepage tersedia" || fail "Submenu Profile hanya $found/4"

bad=0
for f in profile/sejarah.html profile/visi-misi.html profile/struktur-dkm.html profile/program-fasilitas.html; do
  if grep -Fq 'profile-nav-mobile.js' "$f" || grep -Fq 'profile-nav-mobile.css' "$f"; then
    bad=$((bad+1))
  fi
done
[[ "$bad" -eq 0 ]] \
  && pass "Halaman profile tetap memakai navbar sederhana" \
  || fail "$bad halaman profile masih memuat asset mobile navbar utama"

grep -q '@media (max-width: 900px)' assets/css/profile-nav-mobile.css \
  && pass "Fix dibatasi viewport mobile <=900px" \
  || fail "Breakpoint mobile tidak ditemukan"

grep -q 'aria-expanded' assets/js/profile-nav-mobile.js \
  && pass "ARIA state dikelola" \
  || fail "ARIA state tidak ditemukan"

if MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh >/tmp/mjhk-phase9c5.log 2>&1; then
  pass "public-dist build report-only berhasil"
else
  fail "public-dist build gagal"
  tail -n 20 /tmp/mjhk-phase9c5.log || true
fi

[[ -f public-dist/assets/js/profile-nav-mobile.js ]] \
  && pass "public-dist JS mobile nav tersedia" \
  || fail "public-dist JS mobile nav tidak ada"

[[ -f public-dist/assets/css/profile-nav-mobile.css ]] \
  && pass "public-dist CSS mobile nav tersedia" \
  || fail "public-dist CSS mobile nav tidak ada"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
