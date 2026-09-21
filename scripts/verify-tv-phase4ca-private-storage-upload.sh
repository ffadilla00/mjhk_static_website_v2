#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4C-A PRIVATE STORAGE UPLOAD VERIFY ==="

J="admin/tv-content.js"

[[ -f "$J" ]] \
  && pass "tv-content.js tersedia" \
  || fail "tv-content.js tidak ditemukan"

node --check "$J" >/dev/null 2>&1 \
  && pass "tv-content.js syntax OK" \
  || fail "tv-content.js syntax ERROR"

grep -Fq \
  'const STORAGE_BUCKET = "tv-content";' \
  "$J" \
  && pass "Private bucket tv-content dikunci" \
  || fail "Bucket tv-content tidak ditemukan"

grep -Fq \
  '.from(STORAGE_BUCKET)' \
  "$J" \
  && grep -Fq \
  '.upload(' \
  "$J" \
  && pass "Real Storage upload tersedia" \
  || fail "Storage upload wiring hilang"

grep -Fq \
  '.createSignedUrl(' \
  "$J" \
  && pass "Private media preview memakai signed URL" \
  || fail "Signed URL preview hilang"

if grep -Fq \
  '.getPublicUrl(' \
  "$J"
then
  fail "Private bucket tidak boleh memakai getPublicUrl"
else
  pass "Tidak memakai public URL untuk private bucket"
fi

grep -Fq \
  'storage_bucket:' \
  "$J" \
  && grep -Fq \
  'storage_path:' \
  "$J" \
  && pass "tv_content menyimpan bucket/path" \
  || fail "Storage bucket/path persistence hilang"

grep -Fq \
  'storage_url: null' \
  "$J" \
  && pass "storage_url tidak dipalsukan untuk private bucket" \
  || fail "Private storage_url boundary hilang"

grep -Fq \
  'MAX_IMAGE_BYTES = 10 * 1024 * 1024' \
  "$J" \
  && pass "CMS image size guard 10MB tersedia" \
  || fail "Image size guard hilang"

grep -Fq \
  '"image/jpeg"' "$J" \
  && grep -Fq \
  '"image/png"' "$J" \
  && grep -Fq \
  '"image/webp"' "$J" \
  && pass "Image MIME allowlist sesuai bucket" \
  || fail "Image MIME allowlist tidak lengkap"

grep -Fq \
  'removeStoredObject(' \
  "$J" \
  && pass "Storage cleanup path tersedia" \
  || fail "Storage cleanup path hilang"

if grep -Eqi \
  'service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE' \
  "$J"
then
  fail "Browser CMS tidak boleh memakai service role"
else
  pass "Browser CMS bebas service role"
fi

if grep -Eqi \
  'tv_admin_publish_config|desired_revision_id|applied_revision_id|\.rpc\s*\(' \
  "$J"
then
  fail "4C-A masih tidak boleh publish revision"
else
  pass "4C-A tetap bebas publish/revision mutation"
fi

if [[ -f scripts/verify-tv-phase4ca-media-upload-ux.sh ]]; then
  if bash scripts/verify-tv-phase4ca-media-upload-ux.sh \
    >/tmp/mjhk-4ca-storage-ux.log 2>&1
  then
    pass "Media Upload UX regression CLEAN"
  else
    fail "Media Upload UX regression FAIL"
    cat /tmp/mjhk-4ca-storage-ux.log
  fi
fi

if [[ -f scripts/verify-tv-phase4b-profile-menu-hotfix.sh ]]; then
  if bash scripts/verify-tv-phase4b-profile-menu-hotfix.sh \
    >/tmp/mjhk-4ca-storage-4b.log 2>&1
  then
    pass "Locked Phase 4B regression CLEAN"
  else
    fail "Locked Phase 4B regression FAIL"
    cat /tmp/mjhk-4ca-storage-4b.log
  fi
fi

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
