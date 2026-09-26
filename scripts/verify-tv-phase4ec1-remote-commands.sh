#!/usr/bin/env bash
set -u

HTML="admin/tv-devices.html"
JS="admin/tv-device-commands.js"
CSS="admin/tv-device-commands.css"

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4E-C1 REMOTE COMMANDS VERIFY ==="

for f in "$HTML" "$JS" "$CSS"; do
  if [ -f "$f" ]; then pass "$f tersedia"; else fail "$f tidak ditemukan"; fi
done

if [ ! -f "$JS" ] || [ ! -f "$HTML" ]; then
  echo
  echo "PASS: $PASS"
  echo "WARN: $WARN"
  echo "FAIL: $FAIL"
  echo "RESULT: FAILED"
  exit 1
fi

grep -Fq 'tv-device-commands.css' "$HTML" \
  && pass "CSS 4E-C1 ter-wire" \
  || fail "CSS 4E-C1 belum ter-wire"

grep -Fq 'tv-device-commands.js' "$HTML" \
  && pass "JS 4E-C1 ter-wire" \
  || fail "JS 4E-C1 belum ter-wire"

grep -Fq 'window.mjhkSupabase' "$JS" \
  && pass "Menggunakan Supabase client browser existing" \
  || fail "Supabase client contract tidak ditemukan"

grep -Fq '.from("tv_device_commands")' "$JS" \
  && pass "Command queue digunakan" \
  || fail "tv_device_commands tidak digunakan"

grep -Fq '.insert({' "$JS" \
  && pass "CMS dapat enqueue command" \
  || fail "Insert command tidak ditemukan"

grep -Fq '"sync_now"' "$JS" \
  && pass "sync_now tersedia" \
  || fail "sync_now hilang"

grep -Fq '"reload_player"' "$JS" \
  && pass "reload_player tersedia" \
  || fail "reload_player hilang"

if grep -Eq '"mute"|"unmute"|"restart_app"|"refresh_screenshot"' "$JS"; then
  fail "Command belum executable ikut terekspos"
else
  pass "Hanya command executable yang diekspos"
fi

grep -Fq '.limit(HISTORY_LIMIT)' "$JS" \
  && grep -Fq 'const HISTORY_LIMIT = 5' "$JS" \
  && pass "Recent Commands dibatasi 5" \
  || fail "History limit 5 tidak terverifikasi"

grep -Fq 'pending: "PENDING"' "$JS" \
  && grep -Fq 'delivered: "DELIVERED"' "$JS" \
  && grep -Fq 'done: "DONE"' "$JS" \
  && grep -Fq 'failed: "FAILED"' "$JS" \
  && grep -Fq 'expired: "EXPIRED"' "$JS" \
  && pass "Status command lengkap" \
  || fail "Status command tidak lengkap"

grep -Fq 'Boolean(currentDevice?.paired_at)' "$JS" \
  && grep -Fq 'Boolean(currentDevice?.enabled)' "$JS" \
  && pass "Command gated oleh paired + enabled" \
  || fail "Lifecycle gate belum lengkap"

grep -Fq 'Device sedang offline. Command tetap masuk antrean' "$JS" \
  && pass "Offline queue behavior eksplisit" \
  || fail "Offline queue behavior tidak eksplisit"

grep -Fq 'activeDuplicateExists' "$JS" \
  && grep -Fq '.in("status", ["pending", "delivered"])' "$JS" \
  && pass "Duplicate active command dicegah" \
  || warn "Duplicate guard tidak terverifikasi"

grep -Fq 'window.confirm(' "$JS" \
  && pass "Reload Player memiliki konfirmasi" \
  || warn "Reload Player tidak memiliki confirmation guard"

if grep -Eqi 'service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE|device_token_hash|pairing_code_hash' "$JS" "$HTML"; then
  fail "Secret / credential material terdeteksi di UI"
else
  pass "Tidak ada secret / credential material"
fi

if node --check "$JS" >/dev/null 2>&1; then
  pass "tv-device-commands.js syntax OK"
else
  fail "tv-device-commands.js syntax error"
fi

if grep -Fq '"tv_admin_revoke_device"' admin/tv-devices.js 2>/dev/null; then
  pass "4E-B revoke wiring tetap ada"
else
  warn "Tidak dapat memastikan 4E-B revoke wiring dari admin/tv-devices.js"
fi

if grep -Eq 'remote command tetap dipisahkan ke phase berikutnya|Pairing dan remote command tetap dipisahkan ke phase berikutnya' "$HTML"; then
  warn "Copy lama masih menyebut remote command phase berikutnya"
else
  pass "Tidak ada boundary copy lama yang konflik"
fi

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
