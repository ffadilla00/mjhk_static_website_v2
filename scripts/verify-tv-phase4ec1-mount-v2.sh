#!/usr/bin/env bash
set -u

JS="admin/tv-device-commands.js"
HTML="admin/tv-devices.html"

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4E-C1 MOUNT HOTFIX VERIFY ==="

node --check "$JS" >/dev/null 2>&1 \
  && pass "tv-device-commands.js syntax OK" \
  || fail "tv-device-commands.js syntax error"

grep -Fq 'waitForSupabase' "$JS" \
  && pass "Supabase readiness wait tersedia" \
  || fail "Supabase readiness wait hilang"

grep -Fq 'BOOT_TIMEOUT_MS = 12000' "$JS" \
  && pass "Bootstrap timeout tersedia" \
  || fail "Bootstrap timeout hilang"

grep -Fq 'looksLikeSelectedPanel' "$JS" \
  && pass "Selected panel structural detector tersedia" \
  || fail "Selected panel structural detector hilang"

grep -Fq 'SELECTED DEVICE' "$JS" \
  && grep -Fq 'REGISTRATION & PAIRING' "$JS" \
  && grep -Fq 'DISPLAY PROFILE' "$JS" \
  && pass "Canonical panel text anchors tersedia" \
  || fail "Canonical panel text anchors tidak lengkap"

grep -Fq 'remoteCommandsCard' "$JS" \
  && pass "Remote Commands mount tersedia" \
  || fail "Remote Commands mount hilang"

grep -Fq 'window.mjhkRemoteCommandsDebug' "$JS" \
  && pass "Browser debug helper tersedia" \
  || fail "Browser debug helper hilang"

grep -Fq '"sync_now"' "$JS" \
  && grep -Fq '"reload_player"' "$JS" \
  && pass "Command boundary tetap sync_now + reload_player" \
  || fail "Command boundary berubah"

if grep -Eq '"mute"|"unmute"|"restart_app"|"refresh_screenshot"' "$JS"; then
  fail "Command non-executable terekspos"
else
  pass "Command non-executable tetap tersembunyi"
fi

grep -Fq 'tv-device-commands.js' "$HTML" \
  && pass "HTML wiring tetap ada" \
  || fail "HTML wiring hilang"

echo
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAILED"
exit 1
