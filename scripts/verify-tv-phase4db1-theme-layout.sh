#!/usr/bin/env bash
set -u

PASS=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-B1 VERIFY ==="

for f in \
  admin/tv-theme-layout.html \
  admin/tv-theme-layout.css \
  admin/tv-theme-layout.js \
  tv-player/assets/img/mjhk-logo.png
do
  [[ -f "$f" ]] && pass "$f exists" || fail "$f missing"
done

grep -Fq 'from("tv_display_profiles")' admin/tv-theme-layout.js \
  && pass "CMS reads existing tv_display_profiles" \
  || fail "tv_display_profiles read missing"

grep -Fq '.update(payload)' admin/tv-theme-layout.js \
  && pass "CMS update path present" \
  || fail "CMS update path missing"

grep -Fq '...currentTheme' admin/tv-theme-layout.js \
  && pass "theme JSON merge preserves unknown keys" \
  || fail "theme JSON merge guard missing"

grep -Fq 'DEFAULT_MJHK_LOGO_URL' tv-player/assets/js/visual-config.js \
  && pass "static logo constant present" \
  || fail "static logo constant missing"

grep -Fq 'logoUrl: DEFAULT_MJHK_LOGO_URL' tv-player/assets/js/visual-config.js \
  && pass "static logo wired" \
  || fail "static logo not wired"

# Guard actual revision/publication DATA-LAYER references only.
# Do not match user-facing prose such as "belum dipublish ke TV".
if grep -En \
  'tv_config_revisions|tv_publication_state|desired_revision_id|active_revision_id|desired_revision|active_revision|publish_revision|publication_state|\.rpc\([^)]*publish' \
  admin/tv-theme-layout.js >/dev/null 2>&1; then
  fail "4D-B1 must not mutate revision/publication"
else
  pass "no revision/publication mutation"
fi

node --check admin/tv-theme-layout.js >/dev/null 2>&1 \
  && pass "tv-theme-layout.js syntax clean" \
  || fail "tv-theme-layout.js syntax error"

node --check tv-player/assets/js/visual-config.js >/dev/null 2>&1 \
  && pass "visual-config.js syntax clean" \
  || fail "visual-config.js syntax error"

for f in admin/tv.html admin/tv-content.html admin/tv-running-text.html admin/tv-dedicated-screens.html; do
  grep -Fq 'href="tv-theme-layout.html"' "$f" \
    && pass "$f menu wired" \
    || fail "$f menu not wired"
done

echo "=== RESULT: PASS=$PASS FAIL=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
