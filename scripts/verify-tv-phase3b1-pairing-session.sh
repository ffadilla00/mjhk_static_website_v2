#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.1 PAIRING/SESSION VERIFY ==="

FILES=(
  "tv-player/gateway-diagnostics.html"
  "tv-player/assets/js/gateway-client.js"
  "tv-player/assets/js/gateway-diagnostics.js"
  "tv-player/assets/js/device-session.js"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/gateway-client.js \
  tv-player/assets/js/gateway-diagnostics.js \
  tv-player/assets/js/device-session.js
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq 'async claimPairing' tv-player/assets/js/gateway-client.js \
  && pass "Gateway client memiliki claimPairing()" \
  || fail "claimPairing() tidak ditemukan"

grep -Fq 'pairing_code: code' tv-player/assets/js/gateway-client.js \
  && grep -Fq 'device_info:' tv-player/assets/js/gateway-client.js \
  && pass "Pair claim payload sesuai Worker contract" \
  || fail "Pair claim payload tidak lengkap"

grep -Fq 'type="password"' tv-player/gateway-diagnostics.html \
  && pass "Pairing code disamarkan di UI" \
  || fail "Pairing code belum disamarkan"

grep -Fq 'sessionStore.save(credentials)' tv-player/assets/js/gateway-diagnostics.js \
  && pass "Claim success disimpan langsung ke DeviceSessionStore" \
  || fail "Session enrollment wiring tidak ditemukan"

grep -Fq 'refs.pairingCode.value = ""' tv-player/assets/js/gateway-diagnostics.js \
  && pass "Pairing code dibersihkan setelah sukses" \
  || fail "Pairing code tidak dibersihkan setelah sukses"

grep -Fq 'token present [never printed]' tv-player/assets/js/gateway-diagnostics.js \
  && pass "UI hanya menampilkan token presence" \
  || fail "Safe token-presence display tidak ditemukan"

if grep -Eqi 'console\.(log|info|debug|warn|error)\([^)]*(deviceToken|device_token|tokenValue)' \
  tv-player/assets/js/gateway-diagnostics.js tv-player/assets/js/device-session.js; then
  fail "Potential device-token logging ditemukan"
else
  pass "Tidak ada device-token VALUE logging"
fi

grep -Fq 'async bootstrap(session)' tv-player/assets/js/gateway-client.js \
  && pass "Authenticated bootstrap client tersedia" \
  || fail "bootstrap() tidak ditemukan"

grep -Fq 'refs.runBootstrap.disabled = !DEVICE_AUTH_CONTRACT.ready' \
  tv-player/assets/js/gateway-diagnostics.js \
  && pass "Bootstrap aktif hanya setelah session tersedia" \
  || fail "Bootstrap enablement guard tidak ditemukan"

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' \
  tv-player/assets/js/gateway-client.js \
  tv-player/assets/js/gateway-diagnostics.js \
  tv-player/assets/js/device-session.js; then
  fail "Browser pairing layer mengandung service-role/secret"
else
  pass "Browser pairing layer bebas service-role"
fi

[[ -f "tv-player/assets/js/engine.js" ]] \
  && pass "Locked engine tetap tersedia" \
  || fail "Locked engine hilang"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
