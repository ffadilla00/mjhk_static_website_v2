#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4C-A MEDIA UPLOAD UX HOTFIX VERIFY ==="

for f in admin/tv-content.html admin/tv-content.css admin/tv-content.js; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

node --check admin/tv-content.js >/dev/null 2>&1 \
  && pass "tv-content.js syntax OK" \
  || fail "tv-content.js syntax ERROR"

node --check scripts/apply-tv-phase4ca-media-upload-ux.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq 'id="imageFileInput"' admin/tv-content.html \
  && pass "File input gambar tersedia" \
  || fail "File input gambar hilang"

grep -Fq 'class="upload-icon"' admin/tv-content.html \
  && pass "Upload icon tersedia" \
  || fail "Upload icon hilang"

grep -Fq 'drag &amp; drop' admin/tv-content.html \
  && pass "Drag/drop UX tersedia" \
  || fail "Drag/drop UX hilang"

grep -Fq 'accept="image/jpeg,image/png,image/webp"' admin/tv-content.html \
  && pass "Allowed image MIME terpasang" \
  || fail "Allowed image MIME hilang"

grep -Fq 'pendingImageFile' admin/tv-content.js \
  && pass "Pending file state tersedia" \
  || fail "Pending file state hilang"

if grep -Fq 'MAX_IMAGE_BYTES = 10 * 1024 * 1024' admin/tv-content.js \
   || grep -Fq '10 * 1024 * 1024' admin/tv-content.js
then
  pass "Client-side size guard 10MB tersedia"
else
  fail "Size guard hilang"
fi

if grep -Eqi \
  'type="url"[^>]+id="imageUrlInput"|id="imageUrlInput"[^>]+type="url"' \
  admin/tv-content.html
then
  fail "URL HTTPS masih menjadi primary visible input"
else
  pass "URL HTTPS tidak lagi menjadi primary visible input"
fi

# Phase-aware storage invariant:
# - Before private storage wiring: save guard must block pseudo-upload.
# - After private storage wiring: the old guard MUST NOT be required;
#   real Storage upload + signed preview become the acceptance contract.
if grep -Fq 'const STORAGE_BUCKET = "tv-content";' admin/tv-content.js \
   && grep -Fq '.upload(' admin/tv-content.js \
   && grep -Fq '.createSignedUrl(' admin/tv-content.js
then
  pass "Real private Storage wiring aktif; readiness guard lama tidak lagi diperlukan"

  if grep -Fq 'upload Storage belum diaktifkan' admin/tv-content.js
  then
    warn "Legacy readiness guard masih tersisa meski Storage sudah aktif"
  else
    pass "Legacy readiness guard sudah dilepas setelah Storage aktif"
  fi
else
  grep -Fq 'upload Storage belum diaktifkan' admin/tv-content.js \
    && pass "Pre-Storage readiness guard tersedia" \
    || fail "Belum ada real Storage wiring dan readiness guard juga hilang"
fi

if [[ -f scripts/verify-tv-phase4ca-slideshow-crud.sh ]]; then
  if bash scripts/verify-tv-phase4ca-slideshow-crud.sh \
    >/tmp/mjhk-4ca-media-reg.log 2>&1
  then
    pass "Phase 4C-A base regression CLEAN"
  else
    fail "Phase 4C-A base regression FAIL"
    cat /tmp/mjhk-4ca-media-reg.log
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
