#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== FINANCE TYPOGRAPHY v2.1 VERIFY ==="

node --check admin/admin.js >/dev/null 2>&1 \
  && pass "admin/admin.js syntax OK" \
  || fail "admin/admin.js syntax error"

grep -Fq 'function fitPosterRowLabels' admin/admin.js \
  && pass "Adaptive label fitting v2.0 tetap aktif" \
  || fail "Adaptive fitting tidak ditemukan"

grep -Fq 'const MIN_SIZE=12.5;' admin/admin.js \
  && pass "Adaptive minimum font = 12.5px" \
  || fail "MIN_SIZE 12.5px tidak ditemukan"

grep -Fq 'Finance Typography v2.1 START' admin/admin.css \
  && pass "CSS v2.1 marker tersedia" \
  || fail "CSS v2.1 marker tidak ditemukan"

grep -Fq 'grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);' admin/admin.css \
  && pass "Kolom Pemasukan/Pengeluaran = 55/45" \
  || fail "Rasio kolom 55/45 tidak ditemukan"

grep -Fq 'gap:8px;' admin/admin.css \
  && pass "Gap row dipadatkan ke 8px" \
  || fail "Gap row 8px tidak ditemukan"

grep -Fq 'finalCanvas.width=1920;finalCanvas.height=1080' admin/admin.js \
  && pass "Output JPG tetap 1920x1080" \
  || fail "Output 1920x1080 tidak ditemukan"

grep -Fq 'function buildPeriodicPdf' admin/admin.js \
  && pass "Generator PDF periodik tetap tersedia" \
  || fail "Generator PDF periodik tidak ditemukan"

grep -qxF '*.finance-typography-v2-1.bak' .gitignore 2>/dev/null \
  && pass "Backup v2.1 diabaikan Git" \
  || warn "Rule backup v2.1 belum ada di .gitignore"

echo
echo "=== PRODUCTION ARTIFACT BUILD ==="
if MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh >/tmp/mjhk-finance-typography-v2-1-build.log 2>&1; then
  pass "public-dist build report-only berhasil"
else
  fail "public-dist build gagal"
  tail -n 30 /tmp/mjhk-finance-typography-v2-1-build.log 2>/dev/null || true
fi

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
