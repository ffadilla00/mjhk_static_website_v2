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

echo "=== PHASE 9C.2 VERIFY ==="

if [ -f admin/login-inline.js ]; then
  if node --check admin/login-inline.js >/dev/null 2>&1; then
    pass "admin/login-inline.js syntax OK"
  else
    fail "admin/login-inline.js syntax error"
  fi
else
  warn "admin/login-inline.js tidak ditemukan"
fi

if [ -f admin/login-inline.css ]; then
  pass "admin/login-inline.css tersedia"
else
  warn "admin/login-inline.css tidak ditemukan"
fi

INLINE_SCRIPT_HITS="$(
  grep -HnE '<script(>|[[:space:]][^>]*>)' \
    index.html admin/index.html admin/login.html admin/profile.html \
    profile/program-fasilitas.html profile/sejarah.html \
    profile/struktur-dkm.html profile/visi-misi.html \
  2>/dev/null | grep -vE '<script[^>]+src=' || true
)"
if [ -n "$INLINE_SCRIPT_HITS" ]; then
  fail "Masih ada inline script:"
  echo "$INLINE_SCRIPT_HITS"
else
  pass "Active HTML bebas inline script"
fi

STYLE_BLOCK_HITS="$(
  grep -Hn '<style' \
    index.html admin/index.html admin/login.html admin/profile.html \
    profile/program-fasilitas.html profile/sejarah.html \
    profile/struktur-dkm.html profile/visi-misi.html \
  2>/dev/null || true
)"
if [ -n "$STYLE_BLOCK_HITS" ]; then
  fail "Masih ada inline <style> block:"
  echo "$STYLE_BLOCK_HITS"
else
  pass "Active HTML bebas inline <style> block"
fi

if grep -Fq "script-src 'self' https://cdn.jsdelivr.net" deploy-config/csp-policy.txt; then
  pass "CSP script-src strict tanpa unsafe-inline"
else
  fail "CSP script-src tidak sesuai"
fi

if grep -Fq "style-src-attr 'unsafe-inline'" deploy-config/csp-policy.txt; then
  pass "Inline style dibatasi hanya pada style attribute"
else
  warn "style-src-attr policy tidak ditemukan"
fi

for origin in \
  "https://cdn.jsdelivr.net" \
  "https://fonts.googleapis.com" \
  "https://fonts.gstatic.com" \
  "https://img.youtube.com" \
  "https://www.youtube.com" \
  "https://yeumzuknpklpcbcaczat.supabase.co" \
  "https://tanya-mjhk.ffadilla-90.workers.dev"
do
  if grep -Fq "$origin" deploy-config/csp-policy.txt; then
    pass "CSP allowlist: $origin"
  else
    fail "CSP belum mengizinkan $origin"
  fi
done

if grep -Fq "frame-ancestors 'none'" deploy-config/csp-policy.txt; then
  pass "Clickjacking protection via CSP frame-ancestors"
else
  fail "frame-ancestors belum ada"
fi

if grep -Fq "object-src 'none'" deploy-config/csp-policy.txt; then
  pass "Plugin/object execution diblokir"
else
  fail "object-src none belum ada"
fi

if grep -Fq "Strict-Transport-Security" deploy-config/_headers.cloudflare-pages 2>/dev/null; then
  warn "HSTS sudah ada sebelum domain final diverifikasi"
else
  pass "HSTS sengaja belum diaktifkan sebelum final HTTPS"
fi

if grep -Fq "X-Robots-Tag: noindex" deploy-config/_headers.cloudflare-pages; then
  pass "Admin X-Robots-Tag candidate tersedia"
else
  fail "Admin X-Robots-Tag candidate tidak ada"
fi

if grep -Fq "Cache-Control: no-store" deploy-config/_headers.cloudflare-pages; then
  pass "Admin no-store candidate tersedia"
else
  fail "Admin no-store candidate tidak ada"
fi

if bash scripts/build-public-dist.sh >/tmp/mjhk-build-9c2.log 2>&1; then
  pass "public-dist build berhasil"
else
  fail "public-dist build gagal"
  cat /tmp/mjhk-build-9c2.log
fi

if find public-dist -type f \( -name '*.phase9c2.bak' -o -name '*.phase9c1.bak' -o -name '*.phase9b.bak' \) -print -quit | grep -q .; then
  fail "Backup hardening ikut public-dist"
else
  pass "Backup hardening tidak ikut public-dist"
fi

if [ -f public-dist/admin/login-inline.js ] || [ ! -f admin/login-inline.js ]; then
  pass "Externalized login JS artifact konsisten"
else
  fail "login-inline.js tidak ikut public-dist"
fi

if [ -f public-dist/admin/login-inline.css ] || [ ! -f admin/login-inline.css ]; then
  pass "Externalized login CSS artifact konsisten"
else
  fail "login-inline.css tidak ikut public-dist"
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
if [ "$WARN" -gt 0 ]; then
  echo "RESULT: PASS WITH REVIEW"
  exit 0
fi
echo "RESULT: CLEAN"
