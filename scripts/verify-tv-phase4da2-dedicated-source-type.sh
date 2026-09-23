#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 DEDICATED SOURCE_TYPE MIGRATION VERIFY ==="

FILES=(
  "supabase/tv/phase4d-dedicated-screens/06_preflight_dedicated_screen_source_type.sql"
  "supabase/tv/phase4d-dedicated-screens/07_add_dedicated_screen_source_type.sql"
  "supabase/tv/phase4d-dedicated-screens/08_verify_dedicated_screen_source_type.sql"
  "supabase/tv/phase4d-dedicated-screens/09_acceptance_dedicated_screen_source_type.sql"
  "supabase/tv/phase4d-dedicated-screens/99_safe_rollback_dedicated_screen_source_type.sql"
  "admin/tv/PHASE4D_A2_DEDICATED_SOURCE_TYPE.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

MIG="supabase/tv/phase4d-dedicated-screens/07_add_dedicated_screen_source_type.sql"
RB="supabase/tv/phase4d-dedicated-screens/99_safe_rollback_dedicated_screen_source_type.sql"

grep -Fq "'dedicated_screen'::text" "$MIG" \
  && pass "Migration menambahkan dedicated_screen" \
  || fail "dedicated_screen tidak ditemukan"

for token in manual agenda finance media profile system; do
  grep -Fq "'${token}'::text" "$MIG" \
    && pass "Existing source_type ${token} dipertahankan" \
    || fail "Existing source_type ${token} hilang"
done

if grep -qiE 'add column|drop column|create table|drop table|tv_state_assets[[:space:]]+set|update[[:space:]]+public\.tv_content' "$MIG"; then
  fail "Migration menyentuh struktur/data di luar source_type constraint"
else
  pass "Migration hanya mengubah source_type constraint"
fi

grep -Fq "where source_type = 'dedicated_screen'" "$RB" \
  && pass "Rollback guard dedicated_screen rows tersedia" \
  || fail "Rollback guard tidak ditemukan"

grep -Fq "Rollback aborted:" "$RB" \
  && pass "Rollback bersifat fail-safe" \
  || fail "Rollback fail-safe message hilang"

if grep -qiE 'service_role|sb_secret_|SUPABASE_SERVICE_ROLE' \
  supabase/tv/phase4d-dedicated-screens/0*_dedicated_screen_source_type.sql; then
  fail "SQL pack memuat secret"
else
  pass "SQL pack bebas secret"
fi

if [[ -f scripts/verify-tv-phase4da1-source-alignment.sh ]]; then
  if bash scripts/verify-tv-phase4da1-source-alignment.sh >/tmp/mjhk-4da2-source-regression.log 2>&1; then
    pass "Locked Phase 4D-A1 regression CLEAN"
  else
    fail "Locked Phase 4D-A1 regression FAIL"
    cat /tmp/mjhk-4da2-source-regression.log
  fi
fi

if [[ -f scripts/verify-tv-phase4cb-running-text-editor.sh ]]; then
  if bash scripts/verify-tv-phase4cb-running-text-editor.sh >/tmp/mjhk-4cb-regression.log 2>&1; then
    pass "Locked Phase 4C-B regression CLEAN"
  else
    fail "Locked Phase 4C-B regression FAIL"
    cat /tmp/mjhk-4cb-regression.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
