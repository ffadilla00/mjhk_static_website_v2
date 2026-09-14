#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== FINANCE TYPOGRAPHY v2.0 VERIFY ==="

if node --check admin/admin.js >/dev/null 2>&1; then
  pass "admin/admin.js syntax OK"
else
  fail "admin/admin.js syntax error"
fi

[[ -f admin/admin.css ]] \
  && pass "admin/admin.css tersedia" \
  || fail "admin/admin.css tidak ditemukan"

[[ $(grep -Foc 'Phase Finance Typography v2.0 START' admin/admin.js 2>/dev/null || true) -eq 1 ]] \
  && pass "JS patch marker tepat satu kali" \
  || fail "JS patch marker tidak tepat"

[[ $(grep -Foc 'Finance Typography v2.0 START' admin/admin.css 2>/dev/null || true) -eq 1 ]] \
  && pass "CSS patch marker tepat satu kali" \
  || fail "CSS patch marker tidak tepat"

grep -Fq 'grid-template-columns:176px 1fr' admin/admin.css \
  && pass "Panel branding kiri diperkecil menjadi 176px (~18%)" \
  || fail "Lebar panel branding v2.0 tidak ditemukan"

grep -Fq 'width:108px' admin/admin.css && grep -Fq 'height:108px' admin/admin.css \
  && pass "Logo panel kiri diproporsikan ke 108px" \
  || fail "Ukuran logo v2.0 tidak ditemukan"

grep -Fq 'font-size:15.5px' admin/admin.css \
  && pass "Typography detail transaksi diperbesar" \
  || fail "Font detail 15.5px tidak ditemukan"

grep -Fq 'function fitPosterRowLabels' admin/admin.js \
  && pass "Adaptive label fitting aktif" \
  || fail "Adaptive label fitting tidak ditemukan"

grep -Fq 'class="poster-row-label"' admin/admin.js \
  && pass "Row label hook tersedia" \
  || fail "Row label hook tidak ditemukan"

grep -Fq 'escHTML(label)' admin/admin.js \
  && pass "Label transaksi tetap di-escape sebelum render" \
  || fail "Escape label transaksi tidak ditemukan"

grep -Fq 'source.slice(0,8)' admin/admin.js \
  && pass "Batas maksimal 8 transaksi tetap dipertahankan" \
  || fail "Batas 8 transaksi berubah/hilang"

grep -Fq 'finalCanvas.width=1920;finalCanvas.height=1080' admin/admin.js \
  && pass "Output JPG tetap 1920x1080" \
  || fail "Output 1920x1080 tidak ditemukan"

grep -Fq 'function buildPeriodicPdf' admin/admin.js \
  && pass "Generator PDF bulanan/tahunan tetap tersedia" \
  || fail "Generator PDF periodik tidak ditemukan"

grep -Fq 'A4 PDF monthly/yearly reporting' admin/admin.css \
  && pass "CSS PDF bulanan/tahunan tetap tersedia" \
  || fail "CSS PDF bulanan/tahunan tidak ditemukan"

grep -qxF '*.finance-typography-v2.bak' .gitignore 2>/dev/null \
  && pass "Backup Finance Typography v2.0 diabaikan Git" \
  || warn "Rule backup belum ada di .gitignore"

echo
echo "=== PRODUCTION ARTIFACT BUILD ==="
if MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh >/tmp/mjhk-finance-typography-v2-build.log 2>&1; then
  pass "public-dist build report-only berhasil"
else
  fail "public-dist build gagal"
  tail -n 30 /tmp/mjhk-finance-typography-v2-build.log 2>/dev/null || true
fi

[[ -f public-dist/admin/admin.js ]] \
  && pass "public-dist/admin/admin.js tersedia" \
  || fail "public-dist/admin/admin.js tidak tersedia"

[[ -f public-dist/admin/admin.css ]] \
  && pass "public-dist/admin/admin.css tersedia" \
  || fail "public-dist/admin/admin.css tidak tersedia"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
else
  echo "RESULT: FAIL"
  exit 1
fi
