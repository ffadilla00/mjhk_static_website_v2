#!/usr/bin/env bash
set -u

BASE="worker-tv-mjhk"
PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 2C PACK VERIFY ==="

FILES=(
  "$BASE/src/index.js"
  "$BASE/wrangler.jsonc"
  "$BASE/package.json"
  "$BASE/.gitignore"
  "$BASE/.dev.vars.example"
  "$BASE/README.md"
  "$BASE/ARCHITECTURE.md"
  "$BASE/DEPLOYMENT_CHECKLIST.md"
  "scripts/smoke-tv-gateway.sh"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check "$BASE/src/index.js" >/dev/null 2>&1 \
  && pass "Worker JavaScript syntax OK" \
  || fail "Worker JavaScript syntax ERROR"

J="$BASE/src/index.js"

for endpoint in \
  "/health" \
  "/v1/pair/claim" \
  "/v1/device/bootstrap" \
  "/v1/device/heartbeat" \
  "/v1/device/revision" \
  "/v1/device/commands" \
  "/v1/device/screenshot"
do
  grep -Fq "$endpoint" "$J" \
    && pass "Endpoint $endpoint tersedia" \
    || fail "Endpoint $endpoint tidak ditemukan"
done

grep -Fq "mediaMatch" "$J" && grep -Fq "tv_content" "$J" \
  && pass "Endpoint media private tersedia" \
  || fail "Endpoint media private tidak ditemukan"

grep -Fq "SUPABASE_SERVICE_ROLE_KEY" "$J" \
  && pass "Worker membaca service-role dari env" \
  || fail "Service-role env binding tidak ditemukan"

if grep -Eq 'eyJ[a-zA-Z0-9_-]{50,}' "$BASE/wrangler.jsonc" "$BASE/src/index.js"; then
  fail "Potensi JWT hardcoded ditemukan"
else
  pass "Tidak ada JWT/service-role hardcoded"
fi

grep -Fq "Cache-Control" "$J" && grep -Fq "no-store" "$J" \
  && pass "no-store hardening tersedia" \
  || fail "no-store hardening tidak lengkap"

grep -Fq "SCREENSHOT_LIMIT" "$J" && grep -Fq "screenshot_too_large" "$J" \
  && pass "Screenshot size guard tersedia" \
  || fail "Screenshot size guard tidak ditemukan"

grep -Fq "readDeviceAuth(request)" "$J" \
  && pass "Protected device auth guard tersedia" \
  || fail "Device auth guard tidak ditemukan"

grep -Fq "tv_device_claim_pairing" "$J" \
  && grep -Fq "tv_device_heartbeat" "$J" \
  && grep -Fq "tv_device_pull_commands" "$J" \
  && pass "Phase 2B device RPC wiring tersedia" \
  || fail "Phase 2B RPC wiring tidak lengkap"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
