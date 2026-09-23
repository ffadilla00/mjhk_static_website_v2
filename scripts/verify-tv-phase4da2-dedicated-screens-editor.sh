#!/usr/bin/env bash
set -u
PASS=0; WARN=0; FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 DEDICATED SCREENS CMS EDITOR VERIFY ==="

FILES=(
  "admin/tv-dedicated-screens.html"
  "admin/tv-dedicated-screens.css"
  "admin/tv-dedicated-screens.js"
  "scripts/apply-tv-phase4da2-dedicated-screens-menu.mjs"
  "supabase/tv/phase4d-dedicated-screens/05_verify_cms_source_contract.sql"
  "admin/tv/PHASE4D_A2_DEDICATED_SCREENS_EDITOR.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check admin/tv-dedicated-screens.js >/dev/null 2>&1 \
  && pass "tv-dedicated-screens.js syntax OK" \
  || fail "tv-dedicated-screens.js syntax ERROR"

node --check scripts/apply-tv-phase4da2-dedicated-screens-menu.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq 'PRE_ADHAN' admin/tv-dedicated-screens.js \
  && grep -Fq 'IQAMAH_COUNTDOWN' admin/tv-dedicated-screens.js \
  && grep -Fq 'FRIDAY_PRE_ADHAN' admin/tv-dedicated-screens.js \
  && pass "Locked state matrix tersedia" \
  || fail "Locked state matrix tidak lengkap"

grep -Fq 'IMSAK' admin/tv-dedicated-screens.js \
  && grep -Fq 'JUMAT_ADHAN_KHUTBAH' admin/tv-dedicated-screens.js \
  && pass "Editable state mapping tersedia" \
  || fail "Editable state mapping tidak lengkap"

grep -Fq '.from("tv_state_assets")' admin/tv-dedicated-screens.js \
  && pass "CMS memakai tv_state_assets source" \
  || fail "tv_state_assets source contract hilang"

if grep -qiE 'tv_config_revisions|desired_revision_id|applied_revision_id|tv_admin_publish_config' \
  admin/tv-dedicated-screens.js
then
  fail "4D-A2 tidak boleh publish/revision mutation"
else
  pass "4D-A2 bebas publish/revision mutation"
fi

if grep -qiE 'service_role|sb_secret_|SUPABASE_SERVICE_ROLE' admin/tv-dedicated-screens.js; then
  fail "Browser CMS tidak boleh membawa service role"
else
  pass "Browser CMS bebas service-role secret"
fi

if grep -qiE 'innerHTML[[:space:]]*=' admin/tv-dedicated-screens.js; then
  fail "Renderer harus memakai safe DOM APIs"
else
  pass "Dedicated Screen renderer memakai safe DOM APIs"
fi

if [[ -f scripts/verify-tv-phase4da1-source-alignment.sh ]]; then
  if bash scripts/verify-tv-phase4da1-source-alignment.sh >/tmp/mjhk-4da2-a1.log 2>&1; then
    pass "Locked Phase 4D-A1 regression CLEAN"
  else
    fail "Phase 4D-A1 regression FAIL"
    cat /tmp/mjhk-4da2-a1.log
  fi
fi

if [[ -f scripts/verify-tv-phase4cb-running-text-editor.sh ]]; then
  if bash scripts/verify-tv-phase4cb-running-text-editor.sh >/tmp/mjhk-4da2-4cb.log 2>&1; then
    pass "Locked Phase 4C-B regression CLEAN"
  else
    fail "Phase 4C-B regression FAIL"
    cat /tmp/mjhk-4da2-4cb.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"; exit 1
