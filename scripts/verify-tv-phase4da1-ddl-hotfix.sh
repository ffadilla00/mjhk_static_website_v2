#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A1 SOURCE ALIGNMENT HOTFIX v2 VERIFY ==="

FILES=(
  "supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql"
  "supabase/tv/phase4d-dedicated-screens/03_verify_dedicated_screen_source_alignment.sql"
  "supabase/tv/phase4d-dedicated-screens/04_acceptance_dedicated_screen_source_alignment.sql"
  "supabase/tv/phase4d-dedicated-screens/99_safe_rollback_source_alignment.sql"
  "tv-player/MJHK_TV_Phase4D_A1_STATE_MAPPING.md"
  "admin/tv/PHASE4D_A1_SOURCE_ALIGNMENT.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

if grep -Fq 'tv_state_definitions' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql
then
  fail "Migration masih memakai tv_state_definitions"
else
  pass "Migration bebas asumsi tv_state_definitions"
fi

grep -Fq "'imsak'" \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql \
  && pass "Source allowlist menambahkan imsak" \
  || fail "imsak source code hilang"

grep -Fq 'beep_imsak_count smallint' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql \
  && pass "beep_imsak_count mengikuti smallint contract" \
  || fail "beep_imsak_count type mismatch"

grep -Fq 'syuruq_wait_minutes' \
  tv-player/MJHK_TV_Phase4D_A1_STATE_MAPPING.md \
  && grep -Fq 'beep_isyraq_count' \
  tv-player/MJHK_TV_Phase4D_A1_STATE_MAPPING.md \
  && pass "Daily SYURUQ→ISYRAQ beep contract tersedia" \
  || fail "SYURUQ→ISYRAQ contract hilang"

grep -Fq 'Ramadan OFF' \
  tv-player/MJHK_TV_Phase4D_A1_STATE_MAPPING.md \
  && pass "IMSAK Ramadan-only contract tersedia" \
  || fail "IMSAK Ramadan-only contract hilang"

if grep -RqiE \
  'tv_admin_publish_config|desired_revision_id[[:space:]]*=|applied_revision_id[[:space:]]*=' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql
then
  fail "A1 tidak boleh publish/assign revision"
else
  pass "A1 bebas publish/revision mutation"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
