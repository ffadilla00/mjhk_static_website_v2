#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== PHASE 9B ADMIN HARDENING VERIFY ==="

if node --check admin/admin.js >/dev/null 2>&1; then
  pass "admin/admin.js syntax OK"
else
  fail "admin/admin.js syntax error"
  node --check admin/admin.js
fi

if grep -q 'function escHTML(value)' admin/admin.js; then
  pass "escHTML helper ditemukan"
else
  fail "escHTML helper tidak ditemukan"
fi

if grep -q 'function setMetaLines(target,lines)' admin/admin.js; then
  pass "setMetaLines helper ditemukan"
else
  fail "setMetaLines helper tidak ditemukan"
fi

raw_fields="$(mktemp)"
trap 'rm -f "$raw_fields"' EXIT

# Known high-risk raw DB fields inside template literals.
grep -nE '\$\{[A-Za-z_$][A-Za-z0-9_$]*\.(judul|tema|materi|penceramah|narasumber|waktu|lokasi|jenis|jenis_agenda|kategori|kategori_utama|youtube_url|status|uraian|catatan|keterangan|label|nama)([[:space:]]*(\|\||\?\?)[[:space:]]*(""|'\'''\''))?[[:space:]]*\}' \
  admin/admin.js > "$raw_fields" 2>/dev/null || true

if [ -s "$raw_fields" ]; then
  warn "Masih ada raw template interpolation field teks; review:"
  cat "$raw_fields"
else
  pass "Tidak ada raw interpolation untuk field teks yang diaudit"
fi

if grep -n '$(meta).innerHTML=.*Sumber: File lokal' admin/admin.js >/dev/null 2>&1; then
  fail "File lokal metadata masih memakai innerHTML"
else
  pass "File lokal metadata tidak memakai innerHTML"
fi

if grep -n '$(meta).innerHTML=.*Sumber: Supabase Storage' admin/admin.js >/dev/null 2>&1; then
  fail "Storage metadata masih memakai innerHTML"
else
  pass "Storage metadata tidak memakai innerHTML"
fi

echo
echo "=== PUBLIC BUILD VERIFY ==="

if bash scripts/build-public-dist.sh >/tmp/mjhk-build-phase9b.log 2>&1; then
  pass "public-dist berhasil dibangun dan denylist check lolos"
else
  fail "public-dist build/check gagal"
  cat /tmp/mjhk-build-phase9b.log
fi

for req in public-dist/index.html public-dist/assets public-dist/profile public-dist/admin; do
  if [ -e "$req" ]; then
    pass "$req tersedia"
  else
    fail "$req tidak tersedia"
  fi
done

for forbidden in public-dist/worker-tanya-mjhk public-dist/scripts public-dist/.git public-dist/.vscode; do
  if [ -e "$forbidden" ]; then
    fail "$forbidden tidak boleh berada di artifact"
  else
    pass "$forbidden tidak ada"
  fi
done

echo
echo "=== LEGACY ASSET USAGE CHECK ==="
legacy_hits="$(git grep -n -E 'assets/data/|keuangan-2026-08-' -- '*.html' '*.js' '*.css' 2>/dev/null || true)"

if [ -n "$legacy_hits" ]; then
  warn "Legacy assets masih direferensikan; JANGAN exclude dulu:"
  echo "$legacy_hits"
else
  pass "Tidak ditemukan referensi assets/data atau keuangan-2026-08-* pada HTML/JS/CSS"
  echo "      Kandidat aman untuk dikeluarkan dari artifact pada tahap berikutnya."
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL"
  exit 2
fi

echo "RESULT: OK - lanjut smoke test UI"
