#!/usr/bin/env bash
set -u
PASS=0; WARN=0; FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }
echo "=== MJHK TV PHASE 4D-A2 DEDICATED MEDIA UPLOAD REVISION VERIFY ==="
for f in admin/tv-dedicated-screens.html admin/tv-dedicated-screens.css admin/tv-dedicated-screens.js scripts/apply-tv-phase4da2-dedicated-media-upload.mjs supabase/tv/phase4d-dedicated-screens/10_verify_dedicated_media_acceptance.sql; do [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"; done
node --check admin/tv-dedicated-screens.js >/dev/null 2>&1 && pass "tv-dedicated-screens.js syntax OK" || fail "tv-dedicated-screens.js syntax ERROR"
node --check scripts/apply-tv-phase4da2-dedicated-media-upload.mjs >/dev/null 2>&1 && pass "apply script syntax OK" || fail "apply script syntax ERROR"
grep -Fq 'id="dedicatedImageInput"' admin/tv-dedicated-screens.html && pass "Dedicated image input tersedia" || fail "Dedicated image input hilang"
grep -Fq 'id="dedicatedUploadZone"' admin/tv-dedicated-screens.html && pass "Upload zone tersedia" || fail "Upload zone hilang"
if grep -Fq 'id="contentSelect"' admin/tv-dedicated-screens.html; then fail "Legacy dropdown masih ada"; else pass "Legacy dropdown sudah dihapus"; fi
grep -Fq 'DEDICATED_SOURCE_TYPE="dedicated_screen"' admin/tv-dedicated-screens.js && pass "dedicated_screen contract tersedia" || fail "dedicated_screen contract hilang"
grep -Fq 'DEDICATED_BUCKET="tv-content"' admin/tv-dedicated-screens.js && pass "Private tv-content bucket dipakai" || fail "Bucket contract hilang"
grep -Fq 'createSignedUrl' admin/tv-dedicated-screens.js && pass "Signed URL preview tersedia" || fail "Signed URL preview hilang"
grep -Fq 'upsert(payload,{onConflict:"source_type,source_id"})' admin/tv-dedicated-screens.js && pass "Unique dedicated upsert tersedia" || fail "Dedicated upsert contract hilang"
grep -Fq 'content_id:contentRow.id' admin/tv-dedicated-screens.js && pass "State content mapping tersedia" || fail "State content mapping hilang"
if grep -qiE 'createClient[[:space:]]*\(|SUPABASE_URL|SUPABASE_ANON_KEY|service_role|sb_secret_' admin/tv-dedicated-screens.js; then fail "Unsafe standalone Supabase wiring"; else pass "Existing safe Supabase client tetap dipakai"; fi
if grep -qiE 'tv_config_revisions|desired_revision_id|applied_revision_id' admin/tv-dedicated-screens.js; then fail "Revision mutation terdeteksi"; else pass "Bebas revision mutation"; fi
grep -Fq '#saveSourceBtn.btn.primary' admin/tv-dedicated-screens.css && pass "Primary save style tersedia" || fail "Primary save style hilang"
echo; echo "=== SUMMARY ==="; echo "PASS: $PASS"; echo "WARN: $WARN"; echo "FAIL: $FAIL"; [[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0; echo "RESULT: FAIL"; exit 1
