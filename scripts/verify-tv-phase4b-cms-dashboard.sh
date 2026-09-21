#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4B CMS SHELL + DASHBOARD VERIFY ==="

FILES=(
  "admin/tv.html"
  "admin/tv-admin.css"
  "admin/tv-admin.js"
  "scripts/apply-tv-phase4b-cms-shell.mjs"
  "supabase/tv/phase4b-dashboard/01_verify_dashboard_contract.sql"
  "admin/tv/PHASE4B_CMS_DASHBOARD.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] \
    && pass "$f tersedia" \
    || fail "$f tidak ditemukan"
done

node --check admin/tv-admin.js >/dev/null 2>&1 \
  && pass "tv-admin.js syntax OK" \
  || fail "tv-admin.js syntax ERROR"

node --check scripts/apply-tv-phase4b-cms-shell.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq \
  'const db = window.mjhkSupabase;' \
  admin/tv-admin.js \
  && pass "CMS memakai Supabase client existing" \
  || fail "Existing Supabase client wiring hilang"

grep -Fq \
  'db.auth.getSession()' \
  admin/tv-admin.js \
  && pass "CMS memakai existing session auth" \
  || fail "Session auth guard hilang"

grep -Fq \
  'href="tv.html"' \
  admin/index.html \
  && pass "Sidebar admin memiliki link MJHK TV" \
  || fail "Link MJHK TV belum terpasang"

if grep -Eqi \
  'service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE|device_token_hash|pairing_code_hash' \
  admin/tv-admin.js admin/tv.html
then
  fail "CMS tidak boleh memuat secret/hash fields"
else
  pass "CMS bebas secret/hash field access"
fi

if grep -Eqi \
  '\.(insert|update|upsert|delete)\s*\(|\.rpc\s*\(' \
  admin/tv-admin.js
then
  fail "Phase 4B dashboard harus read-only"
else
  pass "Phase 4B dashboard read-only"
fi

if grep -Eqi \
  'innerHTML\s*=|insertAdjacentHTML|document\.write' \
  admin/tv-admin.js
then
  fail "Unsafe HTML injection API ditemukan"
else
  pass "Dashboard rendering memakai safe DOM APIs"
fi

if grep -Eqi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|createClient[[:space:]]*\(' \
  admin/tv-admin.js
then
  fail "TV CMS membuat direct privileged Supabase client"
else
  pass "TV CMS tidak membuat privileged Supabase client"
fi

if [[ -f scripts/verify-tv-phase3ce-supervisor-wiring-hotfix.sh ]]; then
  if bash scripts/verify-tv-phase3ce-supervisor-wiring-hotfix.sh \
    >/tmp/mjhk-4b-3c-reg.log 2>&1
  then
    pass "Locked Phase 3C regression CLEAN"
  else
    fail "Locked Phase 3C regression FAIL"
    cat /tmp/mjhk-4b-3c-reg.log
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
