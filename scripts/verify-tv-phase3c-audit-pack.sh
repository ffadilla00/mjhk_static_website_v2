#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3C-A AUDIT PACK VERIFY ==="

FILES=(
  "scripts/audit-tv-phase3c-runtime-ops.sh"
  "supabase/tv/phase3c-audit/00_runtime_ops_contract_audit.sql"
  "tv-player/MJHK_TV_Phase3C_Runtime_Operations_Contract.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

A="scripts/audit-tv-phase3c-runtime-ops.sh"
Q="supabase/tv/phase3c-audit/00_runtime_ops_contract_audit.sql"

grep -Fq 'tv_device_heartbeat' "$A" \
  && pass "Heartbeat Worker/RPC audit tersedia" \
  || fail "Heartbeat audit hilang"

grep -Fq 'tv_device_pull_commands' "$A" \
  && pass "Command pull audit tersedia" \
  || fail "Command pull audit hilang"

grep -Fq 'tv_device_ack_command' "$A" \
  && pass "Command ACK audit tersedia" \
  || fail "Command ACK audit hilang"

grep -Fq 'tv_device_commands' "$Q" \
  && pass "DB command schema audit tersedia" \
  || fail "DB command schema audit hilang"

grep -Fq 'pg_get_functiondef' "$Q" \
  && pass "Exact RPC definition audit tersedia" \
  || fail "RPC definition audit hilang"

grep -Fq "MJHK TEMP SIMULATOR" "$Q" \
  && pass "TEMP simulator baseline query tersedia" \
  || fail "TEMP simulator query hilang"

if grep -Eqi \
  '^[[:space:]]*(insert|update|delete|truncate|alter|drop|create)[[:space:]]' \
  "$Q"
then
  fail "DB audit harus read-only"
else
  pass "DB audit read-only"
fi

if [[ -f scripts/verify-tv-phase3b2ed-revision-ack.sh ]]; then
  if bash scripts/verify-tv-phase3b2ed-revision-ack.sh \
    >/tmp/mjhk-3c-a-reg.log 2>&1
  then
    pass "Locked Phase 3B regression tetap CLEAN"
  else
    fail "Locked Phase 3B regression FAIL"
    cat /tmp/mjhk-3c-a-reg.log
  fi
else
  warn "Phase 3B verifier tidak ditemukan"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
