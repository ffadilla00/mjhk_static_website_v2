#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 3B.2D-A.1 REPRESENTATIVE SEEDER VERIFY ==="

FILES=(
  "supabase/tv/phase3b2d-test/00_preflight.sql"
  "supabase/tv/phase3b2d-test/01_seed_representative_snapshot.sql"
  "supabase/tv/phase3b2d-test/02_verify_seed.sql"
  "supabase/tv/phase3b2d-test/99_restore_empty_snapshot.sql"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

SEED="supabase/tv/phase3b2d-test/01_seed_representative_snapshot.sql"
RESTORE="supabase/tv/phase3b2d-test/99_restore_empty_snapshot.sql"

grep -Fq "MJHK TEMP SIMULATOR" "$SEED"   && pass "Seeder scoped ke temp simulator"   || fail "Temp-simulator scope tidak ditemukan"

grep -Fq "if v_status <> 'draft'" "$SEED"   && pass "Seeder menolak non-draft revision"   || fail "Draft-only guard tidak ditemukan"

grep -Fq "'playlist_items', jsonb_build_array(" "$SEED"   && pass "Representative playlist_items tersedia"   || fail "playlist_items seed tidak ditemukan"

grep -Fq "'running_text', jsonb_build_array(" "$SEED"   && pass "Representative running_text tersedia"   || fail "running_text seed tidak ditemukan"

grep -Fq "'type', 'image'" "$SEED"   && grep -Fq "'type', 'text'" "$SEED"   && grep -Fq "'type', 'image_text'" "$SEED"   && pass "Tiga representative slideshow shape tersedia"   || fail "Representative slideshow shapes tidak lengkap"

grep -Fq "'state_scope'" "$SEED"   && pass "Running-text state scope tersedia"   || fail "Running-text state scope tidak ditemukan"

if grep -Eqi 'tv_admin_publish_config|status[[:space:]]*=[[:space:]]*.published|update[[:space:]]+public\.tv_devices[[:space:]]+set[[:space:]]+desired_revision' "$SEED"; then
  fail "Seeder tidak boleh publish atau repoint devices"
else
  pass "Seeder tidak publish/repoint devices"
fi

if grep -Eqi 'revision.*ack|tv_device_ack_revision' "$SEED"; then
  fail "Seeder tidak boleh ACK revision"
else
  pass "Seeder tidak melakukan revision ACK"
fi

grep -Fq "playlist_items', '[]'::jsonb" "$RESTORE"   && grep -Fq "running_text', '[]'::jsonb" "$RESTORE"   && pass "Optional restore mengembalikan empty arrays"   || fail "Restore empty snapshot tidak lengkap"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
