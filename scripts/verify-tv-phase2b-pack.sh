#!/usr/bin/env bash
set -u

BASE="supabase/tv/phase2b"
PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 2B PACK VERIFY ==="

FILES=(
  "$BASE/00_phase2b_preflight.sql"
  "$BASE/01_phase2b_secure_device_rpc.sql"
  "$BASE/02_phase2b_verify.sql"
  "$BASE/99_phase2b_safe_rollback.sql"
  "$BASE/MJHK_TV_Phase2B_Architecture.md"
  "$BASE/MJHK_TV_Phase2B_RPC_API_Contract.md"
  "$BASE/EXECUTION_CHECKLIST.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

M="$BASE/01_phase2b_secure_device_rpc.sql"

grep -Fq "2B.1.0" "$M" \
  && pass "Schema version 2B.1.0 tersedia" \
  || fail "Schema version 2B.1.0 tidak ditemukan"

grep -Fq "tv_device_pairing_sessions" "$M" \
  && pass "Pairing session architecture tersedia" \
  || fail "Pairing session architecture tidak ditemukan"

grep -Fq "pairing_code_hash" "$M" \
  && grep -Fq "device_token_hash" "$M" \
  && pass "Pairing/token menggunakan hash storage" \
  || fail "Hash credential model tidak lengkap"

grep -Fq "gen_random_bytes(32)" "$M" \
  && pass "Device token menggunakan 256-bit randomness" \
  || fail "256-bit token generation tidak ditemukan"

grep -Fq "tv_admin_publish_config" "$M" \
  && grep -Fq "desired_revision_id" "$M" \
  && grep -Fq "applied_revision_id" "$M" \
  && pass "Atomic revision publish/sync tersedia" \
  || fail "Atomic revision architecture tidak lengkap"

grep -Fq "lease_expires_at" "$M" \
  && grep -Fq "delivery_attempts" "$M" \
  && pass "Command lease/redelivery tersedia" \
  || fail "Command lease architecture tidak lengkap"

grep -Fq "to service_role" "$M" \
  && pass "Device RPC grant service_role tersedia" \
  || fail "service_role device grant tidak ditemukan"

if grep -Eq 'grant execute on function public\.tv_device_.*to anon' "$M"; then
  fail "Device RPC tidak boleh di-grant ke anon"
else
  pass "Tidak ada device RPC execute grant ke anon"
fi

if grep -Eq 'grant execute on function public\.tv_device_.*to authenticated' "$M"; then
  fail "Device RPC tidak boleh di-grant ke authenticated"
else
  pass "Tidak ada device RPC execute grant ke authenticated"
fi

if grep -Eqi 'SUPABASE_SERVICE_ROLE(_KEY)?[[:space:]]*=' "$M"; then
  fail "Credential service-role hardcoded terdeteksi"
else
  pass "Tidak ada credential service-role hardcoded"
fi

if grep -Eqi 'alter table public\.(kajian|media|keuangan|profile_pages)|drop table.*(kajian|media|keuangan|profile_pages)' "$M"; then
  fail "Migration menyentuh core table existing"
else
  pass "Migration tetap additive terhadap core MJHK"
fi

grep -Fq "storage_path" "$M" \
  && grep -Fq "last_screenshot_path" "$M" \
  && pass "Private media/screenshot path model tersedia" \
  || fail "Private storage path model tidak lengkap"

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
