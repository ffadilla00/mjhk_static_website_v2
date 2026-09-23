#!/usr/bin/env bash
set -u
PASS=0; WARN=0; FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 DEDICATED MEDIA UPLOAD RECOVERY V2 VERIFY ==="

for f in \
  admin/tv-dedicated-screens.html \
  admin/tv-dedicated-screens.css \
  admin/tv-dedicated-screens.js \
  scripts/apply-tv-phase4da2-dedicated-media-upload-recovery-v2.mjs \
  supabase/tv/phase4d-dedicated-screens/11_verify_dedicated_media_runtime.sql
do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check admin/tv-dedicated-screens.js >/dev/null 2>&1 \
  && pass "tv-dedicated-screens.js syntax OK" || fail "tv-dedicated-screens.js syntax ERROR"

node --check scripts/apply-tv-phase4da2-dedicated-media-upload-recovery-v2.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" || fail "apply script syntax ERROR"

grep -Fq 'id="dedicatedImageInput"' admin/tv-dedicated-screens.html \
  && pass "Dedicated image input tersedia" || fail "Dedicated image input hilang"

grep -Fq 'id="dedicatedUploadZone"' admin/tv-dedicated-screens.html \
  && pass "Dedicated upload zone tersedia" || fail "Dedicated upload zone hilang"

if grep -Fq '<select id="editContentId">' admin/tv-dedicated-screens.html; then
  fail "Legacy Content Library dropdown masih aktif"
else
  pass "Legacy Content Library dropdown sudah hilang"
fi

grep -Fq 'id="editContentId" type="hidden"' admin/tv-dedicated-screens.html \
  && pass "Existing content_id state dipertahankan via hidden input" \
  || fail "Hidden content_id state hilang"

grep -Fq 'const DEDICATED_SOURCE_TYPE = "dedicated_screen"' admin/tv-dedicated-screens.js \
  && pass "dedicated_screen source contract tersedia" || fail "dedicated_screen contract hilang"

grep -Fq 'const DEDICATED_BUCKET = "tv-content"' admin/tv-dedicated-screens.js \
  && pass "Private tv-content bucket contract tersedia" || fail "Bucket contract hilang"

grep -Fq 'createSignedUrl' admin/tv-dedicated-screens.js \
  && pass "Private preview memakai signed URL" || fail "Signed URL preview hilang"

grep -Fq 'upsert(payload, { onConflict: "source_type,source_id" })' admin/tv-dedicated-screens.js \
  && pass "Dedicated content upsert contract tersedia" || fail "Upsert contract hilang"

grep -Fq 'payload.content_id = await persistDedicatedMedia' admin/tv-dedicated-screens.js \
  && pass "saveEditor wired ke dedicated media persistence" || fail "saveEditor media wiring hilang"

grep -Fq 'void hydrateDedicatedMedia(asset.content_id)' admin/tv-dedicated-screens.js \
  && pass "openEditor wired ke dedicated media hydration" || fail "openEditor hydration wiring hilang"

grep -Fq '#saveBtn.btn.primary' admin/tv-dedicated-screens.css \
  && pass "Primary green Save style tersedia" || fail "Primary Save style hilang"

if grep -qiE 'createClient[[:space:]]*\(|SUPABASE_URL|SUPABASE_ANON_KEY|service_role|sb_secret_' admin/tv-dedicated-screens.js; then
  fail "Unsafe Supabase client/secret ditemukan"
else
  pass "Existing safe Supabase client tetap dipakai"
fi

if grep -qiE 'tv_config_revisions|desired_revision_id|applied_revision_id|publish_config' admin/tv-dedicated-screens.js; then
  fail "Revision mutation tidak boleh ada di 4D-A2"
else
  pass "4D-A2 bebas revision mutation"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"; exit 1
