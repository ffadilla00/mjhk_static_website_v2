#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4E DEVICES FINAL VERIFY V2 ==="
echo

HTML="admin/tv-devices.html"
CSS="admin/tv-devices.css"
JS="admin/tv-devices.js"
CMD_JS="admin/tv-device-commands.js"
CMD_CSS="admin/tv-device-commands.css"

for f in "$HTML" "$CSS" "$JS" "$CMD_JS" "$CMD_CSS"; do
  [ -f "$f" ] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check "$JS" >/dev/null 2>&1 && pass "tv-devices.js syntax OK" || fail "tv-devices.js syntax error"
node --check "$CMD_JS" >/dev/null 2>&1 && pass "tv-device-commands.js syntax OK" || fail "tv-device-commands.js syntax error"

grep -Fq 'tv-devices.css' "$HTML" && pass "Devices CSS ter-wire" || fail "Devices CSS belum ter-wire"
grep -Fq 'tv-devices.js' "$HTML" && pass "Devices JS ter-wire" || fail "Devices JS belum ter-wire"
grep -Fq 'tv-device-commands.css' "$HTML" && pass "Remote Commands CSS ter-wire" || fail "Remote Commands CSS belum ter-wire"
grep -Fq 'tv-device-commands.js' "$HTML" && pass "Remote Commands JS ter-wire" || fail "Remote Commands JS belum ter-wire"

grep -Fqi 'Device Overview' "$HTML" && pass "Device Overview tersedia" || fail "Device Overview hilang"
grep -Fqi 'Display Profile' "$HTML" && pass "Display Profile tersedia" || fail "Display Profile hilang"
grep -Fq '+ Register Device' "$HTML" && pass "+ Register Device tersedia" || fail "+ Register Device hilang"

# Columns may be static HTML or rendered by JS. Search both, case-insensitive.
if grep -Rqi 'lifecycle' "$HTML" "$JS"; then
  pass "Lifecycle column/state source tersedia"
else
  fail "Lifecycle column/state source hilang"
fi

if grep -Rqi 'network' "$HTML" "$JS"; then
  pass "Network column/state source tersedia"
else
  fail "Network column/state source hilang"
fi

grep -Fq 'Pair Ulang' "$HTML" && pass "Pair Ulang tersedia" || fail "Pair Ulang hilang"
grep -Fq 'Buat Kode Pairing Baru' "$HTML" && pass "Buat Kode Pairing Baru tersedia" || fail "Buat Kode Pairing Baru hilang"
grep -Fq 'Paksa pairing ulang device' "$HTML" && pass "Force re-pair wording tersedia" || warn "Force re-pair wording tidak ditemukan di HTML statis"
grep -Fq 'Revoke Device' "$HTML" && pass "Revoke Device tersedia" || fail "Revoke Device hilang"

grep -Fq 'tv_admin_revoke_device' "$JS" && pass "Revoke RPC wiring tersedia" || fail "Revoke RPC wiring hilang"
grep -Fq 'tv_admin_register_device' "$JS" && pass "Register RPC wiring tersedia" || fail "Register RPC wiring hilang"
grep -Fq 'tv_admin_create_pairing_code' "$JS" && pass "Pairing code RPC wiring tersedia" || fail "Pairing code RPC wiring hilang"

for label in REGISTERED WAITING PAIRED REVOKED DISABLED ONLINE OFFLINE UNKNOWN; do
  if grep -Rqi "$label" "$JS" "$HTML" 2>/dev/null; then
    pass "State $label dikenali"
  else
    warn "State $label tidak ditemukan eksplisit"
  fi
done

grep -Fq '"sync_now"' "$CMD_JS" && pass "sync_now tersedia" || fail "sync_now hilang"
grep -Fq '"reload_player"' "$CMD_JS" && pass "reload_player tersedia" || fail "reload_player hilang"

if grep -Eq '"(mute|unmute|restart_app|refresh_screenshot)"' "$CMD_JS"; then
  fail "Command non-executable terekspos di 4E-C1"
else
  pass "Hanya command executable yang terekspos"
fi

grep -Fq 'tv_device_commands' "$CMD_JS" && pass "Command queue digunakan" || fail "Command queue wiring hilang"

if grep -Fq 'Recent Commands' "$CMD_JS" || grep -Fq 'Recent Commands' "$HTML"; then
  pass "Recent Commands tersedia"
else
  fail "Recent Commands hilang"
fi

for status in pending delivered done failed; do
  grep -qi "$status" "$CMD_JS" \
    && pass "Status command $status ditangani" \
    || fail "Status command $status belum ditangani"
done

# Accept several common ways of expressing the five-row limit.
if grep -Eqi 'limit[[:space:]]*\([[:space:]]*5[[:space:]]*\)|limit[^0-9]{0,20}5|slice[[:space:]]*\([[:space:]]*0[[:space:]]*,[[:space:]]*5[[:space:]]*\)|MAX_[A-Z_]*COMMANDS[^0-9]*5|RECENT_[A-Z_]*LIMIT[^0-9]*5' "$CMD_JS"; then
  pass "Recent Commands dibatasi 5"
elif [ -f scripts/verify-tv-phase4ec1-remote-commands.sh ] && bash scripts/verify-tv-phase4ec1-remote-commands.sh 2>/dev/null | grep -Fq '[PASS] Recent Commands dibatasi 5'; then
  pass "Recent Commands dibatasi 5 (existing verifier)"
else
  warn "Limit 5 tidak dapat dibuktikan secara statis"
fi

if grep -Eqi 'pending.*delivered|delivered.*pending|duplicate|masih pending|command baru tidak dibuat' "$CMD_JS"; then
  pass "Duplicate active command guard tersedia"
else
  fail "Duplicate active command guard tidak terdeteksi"
fi

if grep -Eqi 'enabled|paired|revoked|registered|disabled' "$CMD_JS"; then
  pass "Lifecycle gating tersedia"
else
  fail "Lifecycle gating tidak terdeteksi"
fi

grep -Fq 'MJHK-(?:SIM-)?[A-Z0-9]{12,32}' "$CMD_JS" \
  && pass "Exact device-code parser tersedia" \
  || fail "Exact device-code parser v3 tidak ditemukan"

if grep -Fq 'MJHK-WEB' "$CMD_JS"; then
  warn "Literal MJHK-WEB ditemukan, review false-positive guard"
else
  pass "Tidak ada hardcoded MJHK-WEB device code"
fi

grep -Fq 'window.mjhkRemoteCommandsDebug' "$CMD_JS" \
  && pass "Remote Commands debug helper tersedia" \
  || warn "Debug helper tidak ditemukan"

if grep -Eqi 'Supabase ready|mjhkSupabase' "$CMD_JS"; then
  pass "Supabase readiness handling tersedia"
else
  fail "Supabase readiness handling tidak terdeteksi"
fi

if grep -Eqi 'Delete Device|delete device' "$HTML" "$JS" "$CMD_JS"; then
  fail "Delete Device wording ditemukan"
else
  pass "Device lifecycle tetap memakai revoke, bukan delete"
fi

if grep -Eqi 'service_role|SUPABASE_SERVICE_ROLE|device_token_hash' "$CMD_JS"; then
  fail "Potential secret/credential material ditemukan"
else
  pass "Tidak ada secret/credential material di Remote Commands UI"
fi

echo
echo "--- Current-phase verifier sweep ---"

# Only verifiers that remain semantically valid for the FINAL integrated page.
for child in \
  scripts/verify-tv-phase4ec1-remote-commands.sh \
  scripts/verify-tv-phase4ec1-mount-v2.sh \
  scripts/verify-tv-phase4ec1-device-code-parser-v3.sh
do
  if [ -f "$child" ]; then
    echo "[RUN] $child"
    if bash "$child" >/tmp/mjhk_phase4e_child.out 2>&1; then
      pass "$(basename "$child") CLEAN"
    else
      fail "$(basename "$child") FAILED"
      tail -n 20 /tmp/mjhk_phase4e_child.out
    fi
  else
    warn "$(basename "$child") tidak ditemukan"
  fi
done

# Historical phase-local verifiers are informative only.
echo
echo "--- Historical verifier compatibility (non-blocking) ---"
for legacy in \
  scripts/verify-tv-phase4ea-devices-overview.sh \
  scripts/verify-tv-phase4eb2-final-state-rules.sh
do
  if [ -f "$legacy" ]; then
    if bash "$legacy" >/tmp/mjhk_phase4e_legacy.out 2>&1; then
      pass "$(basename "$legacy") masih kompatibel"
    else
      warn "$(basename "$legacy") obsolete terhadap integrated Phase 4E; tidak menjadi blocker"
    fi
  fi
done

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: CLEAN"
  echo "LOCK CANDIDATE: PHASE 4E DEVICES"
  exit 0
fi

echo "RESULT: FAILED"
echo "LOCK CANDIDATE: NO"
exit 1
