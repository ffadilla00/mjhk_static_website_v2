#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

FILES=(
  "supabase/tv/phase2c-test/00_create_temp_simulator.sql"
  "supabase/tv/phase2c-test/01_verify_temp_simulator.sql"
  "supabase/tv/phase2c-test/99_cleanup_temp_simulator.sql"
  "scripts/tv-device-simulator.mjs"
  "fixtures/mjhk-tv-simulator-1920x1080.png"
)

echo "=== MJHK TV TEMP SIMULATOR PACK VERIFY ==="

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check scripts/tv-device-simulator.mjs >/dev/null 2>&1 \
  && pass "Simulator JavaScript syntax OK" \
  || fail "Simulator JavaScript syntax ERROR"

if grep -Eqi 'service[_ -]?role|SUPABASE_SERVICE_ROLE' scripts/tv-device-simulator.mjs; then
  fail "Simulator tidak boleh menggunakan service-role"
else
  pass "Simulator bebas service-role"
fi

grep -Fq "device_token" scripts/tv-device-simulator.mjs \
  && pass "Simulator menangani device token" \
  || fail "Device token flow tidak ditemukan"

grep -Fq "/v1/device/screenshot" scripts/tv-device-simulator.mjs \
  && pass "Screenshot cycle tersedia" \
  || fail "Screenshot cycle tidak ditemukan"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
