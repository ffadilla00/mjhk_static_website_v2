#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== PHASE 9B.1 PUBLIC BUILD VERIFY ==="

if bash scripts/build-public-dist.sh >/tmp/mjhk-build-9b1.log 2>&1; then
  pass "public-dist berhasil dibangun"
else
  fail "public-dist gagal dibangun"
  cat /tmp/mjhk-build-9b1.log
fi

for req in public-dist/index.html public-dist/assets public-dist/profile public-dist/admin; do
  if [ -e "$req" ]; then
    pass "$req tersedia"
  else
    fail "$req tidak tersedia"
  fi
done

if find public-dist -type f \( -name '*.bak' -o -name '*.phase9b.bak' \) -print -quit | grep -q .; then
  fail "Backup file masih ada di public-dist"
else
  pass "Backup file tidak ada"
fi

if [ -e public-dist/assets/data ]; then
  fail "assets/data masih ada"
else
  pass "assets/data legacy tidak ada"
fi

if find public-dist/assets/images -maxdepth 1 -type f -name 'keuangan-2026-08-*.jpg' -print -quit | grep -q .; then
  fail "Legacy finance JPG masih ada"
else
  pass "Legacy finance JPG tidak ada"
fi

echo
echo "PASS: $PASS"
echo "FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL"
  exit 2
fi

echo "RESULT: CLEAN"
