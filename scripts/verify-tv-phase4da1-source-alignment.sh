#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A1 AUDITED SOURCE ALIGNMENT v3 VERIFY ==="

FILES=(
  "supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql"
  "supabase/tv/phase4d-dedicated-screens/03_verify_dedicated_screen_source_alignment.sql"
  "supabase/tv/phase4d-dedicated-screens/04_acceptance_dedicated_screen_source_alignment.sql"
  "supabase/tv/phase4d-dedicated-screens/99_safe_rollback_source_alignment.sql"
  "admin/tv/PHASE4D_A1_SOURCE_ALIGNMENT.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

grep -Fq "'IMSAK'" \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql \
  && pass "IMSAK definition/source tersedia" \
  || fail "IMSAK migration hilang"

grep -Fq 'resume_policy' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql \
  && pass "Migration memakai audited resume_policy column" \
  || fail "Audited resume_policy column hilang"

if grep -Fq 'resume_behavior' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql
then
  fail "Legacy invalid resume_behavior masih ada"
else
  pass "Migration bebas invalid resume_behavior"
fi

if grep -Fq 'tv_state_assets_state_code_check' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql
then
  fail "Migration tidak boleh mengubah nonexistent state_assets CHECK"
else
  pass "Migration tidak mengubah tv_state_assets CHECK"
fi

grep -Fq 'beep_imsak_count smallint' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql \
  && pass "beep_imsak_count memakai smallint" \
  || fail "beep_imsak_count type mismatch"

if grep -RqiE \
  'create or replace function[[:space:]]+public\.tv_admin_publish_config|desired_revision_id[[:space:]]*=' \
  supabase/tv/phase4d-dedicated-screens/02_align_dedicated_screen_sources.sql
then
  fail "A1 tidak boleh memodifikasi publish/device revision"
else
  pass "A1 bebas publish/device revision mutation"
fi

if [[ -f scripts/verify-tv-phase4cb-running-text-editor.sh ]]; then
  if bash scripts/verify-tv-phase4cb-running-text-editor.sh >/tmp/mjhk-a1-v3-4cb.log 2>&1; then
    pass "Locked Phase 4C-B regression CLEAN"
  else
    fail "Phase 4C-B regression FAIL"
    cat /tmp/mjhk-a1-v3-4cb.log
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
