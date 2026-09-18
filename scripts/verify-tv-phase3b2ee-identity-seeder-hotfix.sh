#!/usr/bin/env bash
set -u

PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV 3B.2E-E IDENTITY SEEDER HOTFIX VERIFY ==="

F="supabase/tv/phase3b2e-e2e/01_seed_e2e_revision.sql"

[[ -f "$F" ]] \
  && pass "E2E seeder tersedia" \
  || fail "E2E seeder tidak ditemukan"

grep -Fq \
  'returning id, revision_number' \
  "$F" \
  && pass "Database-generated revision number ditangkap" \
  || fail "RETURNING revision_number tidak ditemukan"

grep -Fq \
  'v_new_revision_number public.tv_config_revisions.revision_number%type' \
  "$F" \
  && pass "Revision-number variable mengikuti DB type" \
  || fail "Identity revision variable tidak ditemukan"

# Extract only the INSERT column block and ensure revision_number is not manually supplied.
INSERT_BLOCK="$(
  sed -n \
    '/insert into public\.tv_config_revisions (/,/)/p' \
    "$F" | head -n 10
)"

if printf '%s\n' "$INSERT_BLOCK" | grep -Eq 'revision_number'; then
  fail "Seeder masih mencoba insert revision_number manual"
else
  pass "Seeder tidak insert identity revision_number manual"
fi

grep -Fq \
  "'draft'," \
  "$F" \
  && pass "Revision tetap draft" \
  || fail "Draft status tidak ditemukan"

if grep -Eqi \
  'applied_revision_id[[:space:]]*=' \
  "$F"
then
  fail "Seeder tidak boleh menulis applied_revision_id"
else
  pass "Seeder tidak menulis applied_revision_id"
fi

grep -Fq \
  "where name = 'MJHK TEMP SIMULATOR'" \
  "$F" \
  && pass "Seeder tetap dibatasi ke TEMP SIMULATOR" \
  || fail "TEMP SIMULATOR safety guard hilang"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] \
  && echo "RESULT: CLEAN" \
  && exit 0

echo "RESULT: FAIL"
exit 1
