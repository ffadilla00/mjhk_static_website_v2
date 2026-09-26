#!/usr/bin/env bash
set -u

FILE="admin/tv-device-commands.js"

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4E-C1 DEVICE CODE PARSER V3 VERIFY ==="

node --check "$FILE" >/dev/null 2>&1 \
  && pass "tv-device-commands.js syntax OK" \
  || fail "tv-device-commands.js syntax error"

grep -Fq 'new RegExp("MJHK-(?:SIM-)?[A-Z0-9]{12,32}", "i")' "$FILE" \
  && pass "Exact device-code RegExp constructor tersedia" \
  || fail "Exact device-code RegExp constructor hilang"

grep -Fq 'DEVICE CODE' "$FILE" \
  && pass "Canonical DEVICE CODE field diprioritaskan" \
  || fail "Canonical DEVICE CODE field hilang"

grep -Fq 'panelMatch' "$FILE" \
  && pass "Panel fallback tersedia" \
  || fail "Panel fallback hilang"

if grep -Fq '\\\\b/i' "$FILE"; then
  fail "Escaped word-boundary lama masih aktif"
else
  pass "Escaped word-boundary lama sudah hilang"
fi

grep -Fq 'window.mjhkRemoteCommandsDebug' "$FILE" \
  && pass "Debug helper tetap tersedia" \
  || fail "Debug helper hilang"

grep -Fq '"sync_now"' "$FILE" \
  && grep -Fq '"reload_player"' "$FILE" \
  && pass "Command boundary tetap benar" \
  || fail "Command boundary berubah"

grep -Fq 'remoteCommandsCard' "$FILE" \
  && pass "Remote Commands mount tetap ada" \
  || fail "Remote Commands mount hilang"

echo
echo "PASS: $PASS"
echo "WARN: 0"
echo "FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAILED"
exit 1
