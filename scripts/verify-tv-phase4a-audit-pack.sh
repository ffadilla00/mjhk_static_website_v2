#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4A AUDIT PACK VERIFY ==="

FILES=(
  "scripts/audit-tv-phase4a-cms-foundation.sh"
  "supabase/tv/phase4a-audit/00_cms_schema_contract_audit.sql"
  "supabase/tv/phase4a-audit/01_cms_data_shape_audit.sql"
  "admin/tv/PHASE4A_CMS_FOUNDATION.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

bash -n scripts/audit-tv-phase4a-cms-foundation.sh \
  && pass "Audit shell syntax OK" \
  || fail "Audit shell syntax ERROR"

if grep -R -Eqi \
  'insert[[:space:]]+into|update[[:space:]]+public\.|delete[[:space:]]+from|drop[[:space:]]+|alter[[:space:]]+table|create[[:space:]]+policy' \
  supabase/tv/phase4a-audit/*.sql
then
  fail "Phase 4A SQL audit harus READ ONLY"
else
  pass "Phase 4A SQL audit READ ONLY"
fi

if [[ -d admin ]]; then
  pass "Existing admin tree tersedia"
else
  warn "admin directory belum tersedia di working tree"
fi

if [[ -d tv-player ]]; then
  pass "Locked tv-player tree tersedia"
else
  fail "tv-player tree hilang"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] \
  && echo "RESULT: CLEAN" \
  && exit 0

echo "RESULT: FAIL"
exit 1
