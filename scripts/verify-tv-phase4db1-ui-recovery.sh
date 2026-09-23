#!/usr/bin/env bash
set -u

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

HTML="admin/tv-theme-layout.html"
CSS="admin/tv-theme-layout.css"
JS="admin/tv-theme-layout.js"

echo "=== MJHK TV PHASE 4D-B1 UI RECOVERY VERIFY ==="

grep -Fq '<link rel="stylesheet" href="tv-admin.css">' "$HTML" \
  && pass "canonical tv-admin.css wired" \
  || fail "tv-admin.css missing"

if grep -Fq 'href="admin.css"' "$HTML"; then
  fail "legacy admin.css must not be loaded"
else
  pass "legacy admin.css removed"
fi

grep -Fq '<div class="brand">' "$HTML" \
  && pass "canonical TV CMS brand markup present" \
  || fail "brand markup missing"

grep -Fq '<main class="content">' "$HTML" \
  && pass "canonical content shell present" \
  || fail "content shell missing"

grep -Fq '<header class="topbar">' "$HTML" \
  && pass "canonical topbar present" \
  || fail "topbar missing"

grep -Fq 'class="menu-section-title"' "$HTML" \
  && pass "canonical menu section markup present" \
  || fail "menu section markup missing"

grep -Fq 'src="../assets/js/supabase-client.js"' "$HTML" \
  && pass "canonical Supabase bootstrap path wired" \
  || fail "Supabase bootstrap path wrong"

grep -Fq '@supabase/supabase-js@2.116.0' "$HTML" \
  && pass "Supabase CDN version aligned" \
  || fail "Supabase CDN version mismatch"

grep -Fq 'const db = window.mjhkSupabase;' "$JS" \
  && pass "db client contract aligned" \
  || fail "db client contract missing"

grep -Fq 'mjhk_supabase_client_unavailable' "$JS" \
  && pass "Supabase client guard present" \
  || fail "Supabase client guard missing"

grep -Fq 'async function requireAdminSession()' "$JS" \
  && pass "admin session guard present" \
  || fail "admin session guard missing"

grep -Fq 'location.href = "login.html"' "$JS" \
  && pass "unauthenticated redirect present" \
  || fail "login redirect missing"

grep -Fq 'from("tv_display_profiles")' "$JS" \
  && pass "display profile source preserved" \
  || fail "display profile source missing"

grep -Fq '...currentTheme' "$JS" \
  && pass "theme JSON unknown-key preservation retained" \
  || fail "theme JSON merge guard missing"

if grep -En \
  'tv_config_revisions|tv_publication_state|desired_revision_id|active_revision_id|publish_revision|publication_state|\.rpc\([^)]*publish' \
  "$JS" >/dev/null 2>&1; then
  fail "recovery must not mutate revision/publication"
else
  pass "no revision/publication mutation"
fi

node --check "$JS" >/dev/null 2>&1 \
  && pass "theme JS syntax clean" \
  || fail "theme JS syntax error"

if grep -En '(^|[,{[:space:]])\.(layout|main|top)([,{[:space:]:.]|$)' "$CSS" >/dev/null 2>&1; then
  fail "page CSS must not redefine legacy CMS shell"
else
  pass "page CSS does not redefine global shell"
fi

echo "=== RESULT: PASS=$PASS FAIL=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
