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

echo "=== PHASE 9C.1 VERIFY ==="

# IMPORTANT:
# Scan only active HTML source files, not local *.phase9c1.bak backups.
ACTIVE_HTML=(
  index.html
  admin/index.html
  admin/login.html
  admin/profile.html
  profile/program-fasilitas.html
  profile/sejarah.html
  profile/struktur-dkm.html
  profile/visi-misi.html
)

FLOATING="$(
  grep -HnE \
    'cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2(["'\'']|</|$)|cdn\.jsdelivr\.net/npm/marked/marked\.min\.js' \
    "${ACTIVE_HTML[@]}" 2>/dev/null || true
)"

if [ -n "$FLOATING" ]; then
  fail "Masih ada floating CDN dependency pada ACTIVE source:"
  echo "$FLOATING"
else
  pass "Floating Supabase/Marked CDN references tidak ada pada active source"
fi

SUPA_COUNT="$(
  grep -ho 'cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0' \
    "${ACTIVE_HTML[@]}" 2>/dev/null | wc -l | tr -d ' '
)"
if [ "$SUPA_COUNT" -gt 0 ]; then
  pass "Supabase JS exact version pinned (2.116.0), refs=$SUPA_COUNT"
else
  fail "Pinned Supabase JS tidak ditemukan"
fi

MARKED_COUNT="$(
  grep -ho 'cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js' \
    "${ACTIVE_HTML[@]}" 2>/dev/null | wc -l | tr -d ' '
)"
if [ "$MARKED_COUNT" -gt 0 ]; then
  pass "Marked exact version pinned (12.0.2), refs=$MARKED_COUNT"
else
  warn "Marked pinned reference tidak ditemukan; mungkin memang tidak dipakai"
fi

for f in admin/index.html admin/login.html admin/profile.html; do
  if grep -Eqi '<meta[^>]+name=["'\'']robots["'\''][^>]+noindex' "$f"; then
    pass "$f noindex"
  else
    fail "$f belum noindex"
  fi
done

if [ -f robots.txt ] && grep -Fq 'Disallow: /admin/' robots.txt; then
  pass "robots.txt melarang crawler /admin/"
else
  fail "robots.txt belum benar"
fi

if node --check admin/admin.js >/dev/null 2>&1; then
  pass "admin/admin.js syntax OK"
else
  fail "admin/admin.js syntax error"
fi

if bash scripts/build-public-dist.sh >/tmp/mjhk-9c1-build.log 2>&1; then
  pass "public-dist build tetap berhasil"
else
  fail "public-dist build gagal"
  cat /tmp/mjhk-9c1-build.log
fi

if [ -f public-dist/robots.txt ]; then
  pass "robots.txt ikut public-dist"
else
  warn "robots.txt belum ikut public-dist"
fi

# Backup files are expected locally, but MUST NOT be in public-dist.
LOCAL_BACKUP_COUNT="$(find admin profile -type f -name '*.phase9c1.bak' 2>/dev/null | wc -l | tr -d ' ')"
if [ "$LOCAL_BACKUP_COUNT" -gt 0 ]; then
  pass "Local Phase 9C.1 backup tersedia ($LOCAL_BACKUP_COUNT file) dan diabaikan dari source audit"
else
  warn "Local Phase 9C.1 backup tidak ditemukan; bukan blocker bila memang sudah dihapus"
fi

if find public-dist -type f -name '*.phase9c1.bak' -print -quit 2>/dev/null | grep -q .; then
  fail "Backup Phase 9C.1 tidak boleh ikut public-dist"
else
  pass "Backup Phase 9C.1 tidak ikut public-dist"
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
