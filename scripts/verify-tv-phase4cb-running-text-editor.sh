#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4C-B RUNNING TEXT EDITOR VERIFY ==="

FILES=(
  "admin/tv-running-text.html"
  "admin/tv-running-text.css"
  "admin/tv-running-text.js"
  "scripts/apply-tv-phase4cb-running-text-menu.mjs"
  "supabase/tv/phase4c-running-text/00_add_running_text_state_scope.sql"
  "supabase/tv/phase4c-running-text/01_verify_running_text.sql"
  "supabase/tv/phase4c-running-text/02_running_text_acceptance.sql"
  "supabase/tv/phase4c-running-text/99_safe_rollback_state_scope.sql"
  "admin/tv/PHASE4C_B_RUNNING_TEXT.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check admin/tv-running-text.js >/dev/null 2>&1 \
  && pass "tv-running-text.js syntax OK" \
  || fail "tv-running-text.js syntax ERROR"

node --check scripts/apply-tv-phase4cb-running-text-menu.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq 'href="tv-running-text.html"' admin/tv.html \
  && pass "Running Text menu aktif di Dashboard TV" \
  || fail "Running Text menu belum aktif di tv.html"

grep -Fq 'href="tv-running-text.html"' admin/tv-content.html \
  && pass "Running Text menu aktif di Slideshow sidebar" \
  || fail "Running Text menu belum aktif di tv-content.html"

grep -Fq 'db.auth.getSession()' admin/tv-running-text.js \
  && pass "Editor memakai existing admin session" \
  || fail "Session guard hilang"

grep -Fq '.from("tv_running_text")' admin/tv-running-text.js \
  && pass "Editor memakai dedicated tv_running_text" \
  || fail "tv_running_text wiring hilang"

grep -Fq '.insert(payload)' admin/tv-running-text.js \
  && grep -Fq '.update(payload)' admin/tv-running-text.js \
  && grep -Fq '.delete()' admin/tv-running-text.js \
  && pass "CRUD path lengkap" \
  || fail "CRUD path tidak lengkap"

grep -Fq 'state_scope: stateScope' admin/tv-running-text.js \
  && pass "state_scope write path tersedia" \
  || fail "state_scope write path hilang"

grep -Fq 'priority < 0' admin/tv-running-text.js \
  && grep -Fq 'priority > 100' admin/tv-running-text.js \
  && pass "Priority guard 0-100 tersedia" \
  || fail "Priority guard tidak lengkap"

grep -Fq 'Pilih minimal satu hari tayang.' admin/tv-running-text.js \
  && pass "Weekday non-empty guard tersedia" \
  || fail "Weekday guard hilang"

grep -Fq 'Pilih minimal satu State Scope.' admin/tv-running-text.js \
  && pass "State Scope non-empty guard tersedia" \
  || fail "State Scope guard hilang"

if grep -Eqi 'innerHTML\s*=|insertAdjacentHTML|document\.write' admin/tv-running-text.js; then
  fail "Unsafe HTML rendering ditemukan"
else
  pass "Safe DOM rendering"
fi

if grep -Eqi 'service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE|device_token_hash|pairing_code_hash' admin/tv-running-text.js admin/tv-running-text.html; then
  fail "Secret/hash reference ditemukan"
else
  pass "Editor bebas secret/hash"
fi

if grep -Eqi 'tv_admin_publish_config|desired_revision_id|applied_revision_id|\.rpc\s*\(' admin/tv-running-text.js; then
  fail "4C-B belum boleh publish/assign revision"
else
  pass "4C-B bebas publish/revision mutation"
fi

if [[ -f scripts/verify-tv-phase4ca-private-storage-upload.sh ]]; then
  if bash scripts/verify-tv-phase4ca-private-storage-upload.sh >/tmp/mjhk-4cb-4ca.log 2>&1; then
    pass "Locked Phase 4C-A regression CLEAN"
  else
    fail "Phase 4C-A regression FAIL"
    cat /tmp/mjhk-4cb-4ca.log
  fi
fi

if [[ -f scripts/verify-tv-phase4b-profile-menu-hotfix.sh ]]; then
  if bash scripts/verify-tv-phase4b-profile-menu-hotfix.sh >/tmp/mjhk-4cb-4b.log 2>&1; then
    pass "Locked Phase 4B regression CLEAN"
  else
    fail "Phase 4B regression FAIL"
    cat /tmp/mjhk-4cb-4b.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
