#!/usr/bin/env bash
set -u

BASE="supabase/tv/phase2a"
PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 2A PACK VERIFY ==="

files=(
  "$BASE/00_phase2a_preflight.sql"
  "$BASE/01_phase2a_final_migration.sql"
  "$BASE/02_phase2a_verify.sql"
  "$BASE/99_phase2a_safe_rollback.sql"
  "$BASE/MJHK_TV_Admin_UI_FINAL.md"
  "$BASE/MJHK_TV_State_Machine_FINAL.md"
  "$BASE/EXECUTION_CHECKLIST.md"
)
for f in "${files[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

M="$BASE/01_phase2a_final_migration.sql"
tables=(
  tv_schema_meta tv_system_settings tv_display_profiles tv_prayer_rules
  tv_audio_rules tv_state_definitions tv_content tv_state_assets
  tv_playlist_items tv_running_text tv_config_revisions tv_publication_state
  tv_devices tv_playlist_item_devices tv_running_text_devices tv_device_commands
)
for t in "${tables[@]}"; do
  grep -Fq "create table if not exists public.$t" "$M" \
    && pass "DDL memiliki $t" || fail "DDL tidak memiliki $t"
done

grep -Fq "public.is_mjhk_admin()" "$M" \
  && pass "RLS memakai is_mjhk_admin()" || fail "Admin gate tidak ditemukan"

grep -Fq "'tv-content'" "$M" && grep -Fq "'tv-monitor'" "$M" \
  && pass "Private TV storage buckets didefinisikan" || fail "Bucket definition tidak lengkap"

if grep -Eqi 'SUPABASE_SERVICE_ROLE|service_role_key|service-role key' "$M"; then
  fail "DDL mengandung service-role credential/reference"
else
  pass "Tidak ada service-role credential pada DDL"
fi

if grep -Eqi 'alter table public\.(kajian|media|keuangan|profile_pages)|drop table.*(kajian|media|keuangan|profile_pages)' "$M"; then
  fail "DDL menyentuh core table existing"
else
  pass "DDL additive-only terhadap core MJHK"
fi

grep -Fq "ramadan_mode" "$M" && grep -Fq "imsak_offset_minutes" "$M" && grep -Fq "isyraq_duration_minutes" "$M" \
  && pass "Ramadan/Imsak/Isyraq tersedia" || fail "Ramadan requirement tidak lengkap"

grep -Fq "JUMAT_ADHAN_KHUTBAH" "$M" && grep -Fq "SALAT_JUMAT" "$M" \
  && pass "Friday state model tersedia" || fail "Friday state model tidak lengkap"

grep -Fq "desired_revision_id" "$M" && grep -Fq "applied_revision_id" "$M" \
  && pass "Atomic revision telemetry tersedia" || fail "Revision telemetry tidak lengkap"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
