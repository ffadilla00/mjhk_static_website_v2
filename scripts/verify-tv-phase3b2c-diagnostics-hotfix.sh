#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2C DIAGNOSTICS HOTFIX VERIFY ==="

JS="tv-player/assets/js/runtime-config-diagnostics.js"
HTML="tv-player/runtime-config-diagnostics.html"

[[ -f "$JS" ]] && pass "$JS tersedia" || fail "$JS tidak ditemukan"
[[ -f "$HTML" ]] && pass "$HTML tersedia" || fail "$HTML tidak ditemukan"

node --check "$JS" >/dev/null 2>&1 \
  && pass "Diagnostics JS syntax OK" \
  || fail "Diagnostics JS syntax ERROR"

grep -Fq 'Object.create(null)' "$JS" \
  && pass "Dangerous-key test memakai null-prototype object" \
  || fail "Null-prototype dangerous-key test tidak ditemukan"

grep -Fq 'dangerousNested["__proto__"]' "$JS" \
  && pass "__proto__ dibuat sebagai own property" \
  || fail "Own-property __proto__ test tidak ditemukan"

grep -Fq 'error?.code === "snapshot_dangerous_key"' "$JS" \
  && pass "Failure test memverifikasi rejection code yang benar" \
  || fail "Dangerous-key rejection assertion tidak ditemukan"

grep -Fq 'id="hydrateRollback"' "$HTML" \
  && pass "Rollback memiliki status row terpisah" \
  || fail "Rollback status row tidak ditemukan"

grep -Fq 'EXPECTED • belum ada runtime sebelumnya untuk rollback' "$JS" \
  && pass "First-apply rollback diperlakukan sebagai expected warning" \
  || fail "Expected rollback handling tidak ditemukan"

if grep -Fq 'set(refs.runtime, "warning", safeError(error))' "$JS"; then
  fail "Rollback masih menimpa Runtime Config status"
else
  pass "Rollback tidak menimpa Runtime Config status"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
