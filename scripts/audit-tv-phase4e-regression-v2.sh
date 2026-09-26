#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4E REGRESSION AUDIT V2 ==="
echo

HTML="admin/tv-devices.html"
JS="admin/tv-devices.js"
CMD="admin/tv-device-commands.js"

for f in "$HTML" "$JS" "$CMD"; do
  [ -f "$f" ] && pass "$f tersedia" || fail "$f hilang"
done

node --check "$JS" >/dev/null 2>&1 && pass "Devices JS syntax OK" || fail "Devices JS syntax error"
node --check "$CMD" >/dev/null 2>&1 && pass "Commands JS syntax OK" || fail "Commands JS syntax error"

grep -Fq 'tv_admin_register_device' "$JS" && pass "Register contract preserved" || fail "Register contract hilang"
grep -Fq 'tv_admin_create_pairing_code' "$JS" && pass "Pairing contract preserved" || fail "Pairing contract hilang"
grep -Fq 'tv_admin_revoke_device' "$JS" && pass "Revoke contract preserved" || fail "Revoke contract hilang"

grep -Fq 'p_invalidate_existing_token' "$JS" \
  && pass "Force re-pair token invalidation path preserved" \
  || warn "Force re-pair param tidak terdeteksi"

if grep -Eqi 'lifecycle' "$JS" && grep -Eqi 'network' "$JS"; then
  pass "Lifecycle dan network tetap dipisah"
else
  fail "Lifecycle/network separation tidak terdeteksi"
fi

if grep -Eqi 'revoke' "$HTML" "$JS" && ! grep -Eqi 'delete device' "$HTML" "$JS"; then
  pass "Revoke semantics preserved"
else
  fail "Revoke semantics berubah"
fi

if grep -Fq 'Remote Commands' "$CMD" || grep -Fq 'Remote Commands' "$HTML"; then
  pass "Remote Commands panel preserved"
else
  fail "Remote Commands panel hilang"
fi

grep -Fq '"sync_now"' "$CMD" && grep -Fq '"reload_player"' "$CMD" \
  && pass "Executable command set preserved" \
  || fail "Executable command set rusak"

if grep -Eq '"(mute|unmute|restart_app|refresh_screenshot)"' "$CMD"; then
  fail "Deferred command bocor ke 4E-C1"
else
  pass "Deferred command tetap tersembunyi"
fi

grep -Fq 'MJHK-(?:SIM-)?[A-Z0-9]{12,32}' "$CMD" \
  && pass "Device-code parser exact pattern preserved" \
  || fail "Device-code parser regression"

if grep -Eqi 'pending.*delivered|delivered.*pending|command baru tidak dibuat|duplicate' "$CMD"; then
  pass "Duplicate guard preserved"
else
  fail "Duplicate guard hilang"
fi

if grep -Eqi 'belum paired|belum selesai pairing|direvoke|tidak tersedia|disabled|enabled' "$CMD"; then
  pass "Lifecycle guard copy/logic preserved"
else
  warn "Lifecycle guard tidak terdeteksi statis"
fi

if grep -Eqi 'offline|antrean|queue' "$CMD"; then
  pass "Offline queue behavior masih dijelaskan/ditangani"
else
  warn "Offline queue behavior tidak terdeteksi statis"
fi

if grep -Eqi 'Recent Commands|requested|result|attempt' "$CMD" "$HTML"; then
  pass "Command history UI preserved"
else
  fail "Command history UI hilang"
fi

echo
echo "=== REGRESSION SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAILED"
exit 1
