#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2C ATOMIC CONFIG HYDRATION VERIFY ==="

FILES=(
  "tv-player/runtime-config-diagnostics.html"
  "tv-player/assets/js/runtime-config-core.js"
  "tv-player/assets/js/runtime-config.js"
  "tv-player/assets/js/runtime-config-diagnostics.js"
  "scripts/test-tv-phase3b2c-runtime-config.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

for js in \
  tv-player/assets/js/runtime-config-core.js \
  tv-player/assets/js/runtime-config.js \
  tv-player/assets/js/runtime-config-diagnostics.js \
  scripts/test-tv-phase3b2c-runtime-config.mjs
do
  node --check "$js" >/dev/null 2>&1 \
    && pass "$js syntax OK" \
    || fail "$js syntax ERROR"
done

grep -Fq 'prepareRuntimeConfig' tv-player/assets/js/runtime-config-core.js \
  && pass "Runtime preparation layer tersedia" \
  || fail "Runtime preparation layer tidak ditemukan"

grep -Fq 'snapshot_dangerous_key' tv-player/assets/js/runtime-config-core.js \
  && pass "Prototype-pollution key guard tersedia" \
  || fail "Dangerous-key guard tidak ditemukan"

grep -Fq 'deepFreeze' tv-player/assets/js/runtime-config-core.js \
  && pass "Runtime config immutable/frozen" \
  || fail "Deep-freeze tidak ditemukan"

grep -Fq 'const candidate = prepareRuntimeConfig(lkgRecord);' tv-player/assets/js/runtime-config.js \
  && pass "Candidate disiapkan sebelum active runtime swap" \
  || fail "Atomic preparation ordering tidak ditemukan"

grep -Fq 'this.#current = candidate;' tv-player/assets/js/runtime-config.js \
  && pass "Atomic runtime swap tersedia" \
  || fail "Runtime swap tidak ditemukan"

grep -Fq 'rollback()' tv-player/assets/js/runtime-config.js \
  && pass "Runtime rollback tersedia" \
  || fail "Runtime rollback tidak ditemukan"

grep -Fq 'mjhk:runtime-config-changed' tv-player/assets/js/runtime-config.js \
  && pass "Runtime config change event tersedia" \
  || fail "Runtime config event tidak ditemukan"

if grep -R -Eqi 'revision.*ack|/revision/ack|ackRevision' \
  tv-player/assets/js/runtime-config*.js; then
  fail "3B.2C tidak boleh melakukan revision ACK"
else
  pass "3B.2C belum melakukan revision ACK"
fi

if grep -R -Eqi 'setState|transitionTo|engine\.|forceState|COUNTDOWN' \
  tv-player/assets/js/runtime-config*.js; then
  fail "3B.2C tidak boleh menyentuh state engine/countdown"
else
  pass "3B.2C tidak menyentuh state engine/countdown"
fi

if grep -R -Eqi 'console\.(log|info|debug|warn|error)\([^)]*(snapshot|deviceToken|device_token)' \
  tv-player/assets/js/runtime-config*.js; then
  fail "Potential snapshot/token value logging ditemukan"
else
  pass "Tidak ada snapshot/token value logging"
fi

if grep -R -Eqi 'SUPABASE_SERVICE_ROLE|sb_secret_' \
  tv-player/assets/js/runtime-config*.js; then
  fail "Runtime config layer mengandung service-role"
else
  pass "Runtime config layer bebas service-role"
fi

node scripts/test-tv-phase3b2c-runtime-config.mjs >/tmp/mjhk-3b2c-test.log 2>&1
TEST_RC=$?

if [[ "$TEST_RC" -eq 0 ]]; then
  pass "Runtime config unit test CLEAN"
else
  fail "Runtime config unit test FAIL"
  cat /tmp/mjhk-3b2c-test.log
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
