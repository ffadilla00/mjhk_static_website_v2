#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 SUPABASE CLIENT WIRING HOTFIX VERIFY ==="

FILES=(
  "admin/tv-dedicated-screens.html"
  "admin/tv-dedicated-screens.js"
  "admin/tv-running-text.html"
  "scripts/apply-tv-phase4da2-supabase-client-wiring.mjs"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check admin/tv-dedicated-screens.js >/dev/null 2>&1 \
  && pass "tv-dedicated-screens.js syntax OK" \
  || fail "tv-dedicated-screens.js syntax ERROR"

node --check scripts/apply-tv-phase4da2-supabase-client-wiring.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

grep -Fq 'const db = window.mjhkSupabase;' admin/tv-dedicated-screens.js \
  && pass "Existing global Supabase client dipakai" \
  || fail "window.mjhkSupabase wiring hilang"

if grep -qiE 'config\.js|SUPABASE_URL|SUPABASE_ANON_KEY|createClient[[:space:]]*\(' admin/tv-dedicated-screens.js; then
  fail "Standalone Supabase client wiring masih ada"
else
  pass "config.js/createClient dependency sudah hilang"
fi

if grep -qiE 'service_role|sb_secret_|SUPABASE_SERVICE_ROLE' admin/tv-dedicated-screens.js; then
  fail "Browser CMS membawa privileged secret"
else
  pass "Browser CMS bebas privileged secret"
fi

grep -Fq 'src="tv-dedicated-screens.js"' admin/tv-dedicated-screens.html \
  && pass "Dedicated Screens page script tetap wired" \
  || fail "Dedicated Screens page script hilang"

REF_COUNT="$(
  awk '
    /tv-running-text\.js/ { exit }
    /<script/ { count++ }
    END { print count+0 }
  ' admin/tv-running-text.html
)"

TARGET_COUNT="$(
  awk '
    /tv-dedicated-screens\.js/ { exit }
    /<script/ { count++ }
    END { print count+0 }
  ' admin/tv-dedicated-screens.html
)"

if [[ "$TARGET_COUNT" -ge "$REF_COUNT" && "$TARGET_COUNT" -gt 0 ]]; then
  pass "Existing CMS bootstrap dependency chain tersedia"
else
  fail "Bootstrap dependency chain belum sejajar (ref=$REF_COUNT target=$TARGET_COUNT)"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
