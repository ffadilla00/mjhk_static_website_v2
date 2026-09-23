#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

FILE="admin/tv-content.js"

echo "=== MJHK TV PHASE 4D-A2 SLIDESHOW BOUNDARY HOTFIX VERIFY ==="

[[ -f "$FILE" ]] && pass "$FILE tersedia" || fail "$FILE tidak ditemukan"
[[ -f scripts/apply-tv-phase4da2-slideshow-boundary-hotfix.mjs ]] \
  && pass "apply script tersedia" || fail "apply script tidak ditemukan"

node --check "$FILE" >/dev/null 2>&1 \
  && pass "tv-content.js syntax OK" || fail "tv-content.js syntax ERROR"

node --check scripts/apply-tv-phase4da2-slideshow-boundary-hotfix.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" || fail "apply script syntax ERROR"

grep -Fq 'PHASE4D-A2 SLIDESHOW BOUNDARY HOTFIX' "$FILE" \
  && pass "Boundary marker tersedia" || fail "Boundary marker hilang"

grep -Fq '.or("source_type.is.null,source_type.eq.manual")' "$FILE" \
  && pass "Slideshow ownership query tersedia" || fail "Slideshow ownership query hilang"

COUNT=$(grep -Fc '.or("source_type.is.null,source_type.eq.manual")' "$FILE" || true)
[[ "$COUNT" -ge 3 ]] \
  && pass "Read/update/delete semuanya memiliki ownership guard" \
  || fail "Ownership guard belum lengkap (count=$COUNT)"

grep -Fq 'row.source_type == null || row.source_type === "manual"' "$FILE" \
  && pass "Render defense-in-depth tersedia" || fail "Render defense hilang"

if grep -qE 'source_type[[:space:]]*=[[:space:]]*["'"'"']dedicated_screen' "$FILE"; then
  fail "Slideshow mencoba membuat dedicated_screen"
else
  pass "Slideshow tidak membuat dedicated_screen"
fi

if grep -qiE 'tv_config_revisions|desired_revision_id|applied_revision_id|publish_config' "$FILE"; then
  fail "Hotfix tidak boleh menyentuh revision workflow"
else
  pass "Hotfix bebas revision mutation"
fi

if grep -qiE 'service_role|sb_secret_|SUPABASE_SERVICE_ROLE|createClient[[:space:]]*\(' "$FILE"; then
  fail "Unsafe Supabase secret/client ditemukan"
else
  pass "Existing safe Supabase client tetap dipakai"
fi

if [[ -f scripts/verify-tv-phase4ca-slideshow-crud.sh ]]; then
  if bash scripts/verify-tv-phase4ca-slideshow-crud.sh >/tmp/mjhk-4da2-slideshow-boundary-regression.log 2>&1; then
    pass "Locked Slideshow CRUD regression CLEAN"
  else
    fail "Locked Slideshow CRUD regression FAIL"
    cat /tmp/mjhk-4da2-slideshow-boundary-regression.log
  fi
fi

if [[ -f scripts/verify-tv-phase4da2-dedicated-media-upload-recovery-v2.sh ]]; then
  if bash scripts/verify-tv-phase4da2-dedicated-media-upload-recovery-v2.sh >/tmp/mjhk-4da2-dedicated-regression.log 2>&1; then
    pass "Dedicated Media regression CLEAN"
  else
    fail "Dedicated Media regression FAIL"
    cat /tmp/mjhk-4da2-dedicated-regression.log
  fi
fi

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
