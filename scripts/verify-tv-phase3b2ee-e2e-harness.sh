#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2E-E FINAL E2E HARNESS VERIFY ==="

FILES=(
  "supabase/tv/phase3b2e-e2e/00_preflight.sql"
  "supabase/tv/phase3b2e-e2e/01_seed_e2e_revision.sql"
  "supabase/tv/phase3b2e-e2e/02_verify_after_player.sql"
  "supabase/tv/phase3b2e-e2e/03_verify_e2e_payload.sql"
  "supabase/tv/phase3b2e-e2e/99_restore_previous_desired.sql"
  "supabase/tv/phase3b2e-e2e/100_verify_after_restore_sync.sql"
  "tv-player/MJHK_TV_Phase3B2E_E_Final_E2E.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

SEED="supabase/tv/phase3b2e-e2e/01_seed_e2e_revision.sql"
ROLLBACK="supabase/tv/phase3b2e-e2e/99_restore_previous_desired.sql"

grep -Fq "MJHK TEMP SIMULATOR" "$SEED" \
  && pass "Seeder dibatasi ke TEMP SIMULATOR" \
  || fail "Simulator safety guard hilang"

grep -Fq "desired_revision_id <> v_device.applied_revision_id" "$SEED" \
  && pass "Baseline desired/applied sync guard tersedia" \
  || fail "Baseline sync guard hilang"

grep -Fq "'draft'" "$SEED" \
  && pass "E2E revision tetap draft" \
  || fail "Draft-only seed tidak ditemukan"

if grep -Eqi \
  "published_at[[:space:]]*=|status[[:space:]]*=[[:space:]]*'published'|status[[:space:]]*,[[:space:]]*'published'" \
  "$SEED"
then
  fail "Seeder tidak boleh publish revision"
else
  pass "Seeder tidak mempublish revision"
fi

if grep -Eqi \
  'update[[:space:]]+public\.tv_devices[\s\S]*applied_revision_id[[:space:]]*=' \
  "$SEED"
then
  fail "Seeder tidak boleh memalsukan applied_revision_id"
else
  pass "Seeder tidak menulis applied_revision_id"
fi

grep -Fq "previous_desired_revision_id" "$SEED" \
  && pass "Rollback metadata disimpan" \
  || fail "Rollback metadata hilang"

grep -Fq "phase3b2e_e_final_e2e" "$ROLLBACK" \
  && pass "Rollback hanya menerima E2E harness revision" \
  || fail "Rollback harness guard hilang"

if grep -Eqi 'applied_revision_id[[:space:]]*=' "$ROLLBACK"; then
  fail "Rollback tidak boleh memalsukan applied_revision_id"
else
  pass "Rollback hanya mengubah desired revision"
fi

if [[ -f scripts/verify-tv-phase3b2ed-revision-ack.sh ]]; then
  if bash scripts/verify-tv-phase3b2ed-revision-ack.sh \
    >/tmp/mjhk-3b2ed-e2e-reg.log 2>&1
  then
    pass "3B.2E-D regression CLEAN"
  else
    fail "3B.2E-D regression FAIL"
    cat /tmp/mjhk-3b2ed-e2e-reg.log
  fi
else
  warn "3B.2E-D verifier tidak ditemukan"
fi

[[ -f tv-player/assets/js/engine.js ]] \
  && pass "Locked engine tetap tersedia" \
  || fail "Locked engine hilang"

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
