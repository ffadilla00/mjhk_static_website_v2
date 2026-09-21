#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4C-A SLIDESHOW CONTENT CRUD VERIFY ==="

FILES=(
  "admin/tv-content.html"
  "admin/tv-content.css"
  "admin/tv-content.js"
  "scripts/apply-tv-phase4ca-slideshow-menu.mjs"
  "supabase/tv/phase4c-content/01_verify_slideshow_content.sql"
  "supabase/tv/phase4c-content/02_audit_content_checks.sql"
  "admin/tv/PHASE4C_A_SLIDESHOW_CRUD.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

node --check admin/tv-content.js \
  >/dev/null 2>&1 \
  && pass "tv-content.js syntax OK" \
  || fail "tv-content.js syntax ERROR"

node --check scripts/apply-tv-phase4ca-slideshow-menu.mjs \
  >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq \
  'href="tv-content.html"' \
  admin/tv.html \
  && pass "Slideshow menu aktif" \
  || fail "Slideshow menu belum aktif"

grep -Fq \
  'db.auth.getSession()' \
  admin/tv-content.js \
  && pass "Content editor memakai existing admin session" \
  || fail "Admin session guard hilang"

grep -Fq \
  '.from("tv_content")' \
  admin/tv-content.js \
  && pass "Content editor memakai tv_content" \
  || fail "tv_content wiring hilang"

grep -Fq \
  '.insert(payload)' \
  admin/tv-content.js \
  && grep -Fq \
  '.update(payload)' \
  admin/tv-content.js \
  && grep -Fq \
  '.delete()' \
  admin/tv-content.js \
  && pass "CRUD write path tersedia" \
  || fail "CRUD write path tidak lengkap"

grep -Fq \
  'status: "draft"' \
  admin/tv-content.js \
  && pass "4C-A write path dikunci ke draft" \
  || fail "Draft-only guard hilang"

if grep -Eqi \
  '\.rpc\s*\(|tv_admin_publish_config|desired_revision_id|applied_revision_id' \
  admin/tv-content.js
then
  fail "4C-A tidak boleh publish/assign revision"
else
  pass "4C-A bebas publish/revision mutation"
fi

if grep -Eqi \
  'service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE|device_token_hash|pairing_code_hash' \
  admin/tv-content.js admin/tv-content.html
then
  fail "Secret/hash reference ditemukan"
else
  pass "Content editor bebas secret/hash"
fi

if grep -Eqi \
  'innerHTML\s*=|insertAdjacentHTML|document\.write' \
  admin/tv-content.js
then
  fail "Unsafe HTML injection API ditemukan"
else
  pass "Content editor memakai safe DOM rendering"
fi

grep -Fq \
  '["image", "text", "image_text"]' \
  admin/tv-content.js \
  && pass "Content type allowlist sesuai locked runtime adapter" \
  || fail "Content type allowlist tidak ditemukan"

grep -Fq \
  'duration < 3' \
  admin/tv-content.js \
  && grep -Fq \
  'duration > 300' \
  admin/tv-content.js \
  && pass "Duration guard 3–300 detik tersedia" \
  || fail "Duration guard tidak lengkap"

grep -Fq \
  'url.protocol === "https:"' \
  admin/tv-content.js \
  && pass "Image URL HTTPS guard tersedia" \
  || fail "HTTPS media guard hilang"

if [[ -f scripts/verify-tv-phase4b-profile-menu-hotfix.sh ]]; then
  if bash scripts/verify-tv-phase4b-profile-menu-hotfix.sh \
    >/tmp/mjhk-4ca-4b-reg.log 2>&1
  then
    pass "Locked Phase 4B regression CLEAN"
  else
    fail "Locked Phase 4B regression FAIL"
    cat /tmp/mjhk-4ca-4b-reg.log
  fi
fi

if [[ -f scripts/verify-tv-phase3ce-supervisor-wiring-hotfix.sh ]]; then
  if bash scripts/verify-tv-phase3ce-supervisor-wiring-hotfix.sh \
    >/tmp/mjhk-4ca-3c-reg.log 2>&1
  then
    pass "Locked Phase 3C regression CLEAN"
  else
    fail "Locked Phase 3C regression FAIL"
    cat /tmp/mjhk-4ca-3c-reg.log
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
