#!/usr/bin/env bash
set -u

PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3A.1 PRODUCTION BADGE VERIFY ==="

if grep -Fq 'html[data-player-mode="production"] .state-badge' \
  tv-player/assets/css/player.css; then
  pass "State badge hidden pada production"
else
  fail "Production state-badge rule tidak ditemukan"
fi

if grep -Fq 'mode") === "production"' \
  tv-player/assets/js/player.js; then
  pass "Production mode detection tetap tersedia"
else
  fail "Production mode detection hilang"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
