#!/usr/bin/env bash
set -u

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

HTML="admin/tv-prayer-settings.html"
CSS="admin/tv-prayer-settings.css"
JS="admin/tv-prayer-settings.js"

echo "=== MJHK TV PHASE 4D-C1 PRAYER SETTINGS VERIFY ==="

for f in "$HTML" "$CSS" "$JS"; do
  [[ -f "$f" ]] && pass "$f exists" || fail "$f missing"
done

grep -Fq '<link rel="stylesheet" href="tv-admin.css">' "$HTML" \
  && pass "canonical tv-admin.css wired" \
  || fail "canonical tv-admin.css missing"

grep -Fq '<div class="brand">' "$HTML" \
  && pass "canonical TV CMS brand present" \
  || fail "canonical brand missing"

grep -Fq '<main class="content">' "$HTML" \
  && pass "canonical content shell present" \
  || fail "canonical content shell missing"

grep -Fq '<header class="topbar">' "$HTML" \
  && pass "canonical topbar present" \
  || fail "canonical topbar missing"

grep -Fq 'src="../assets/js/supabase-client.js"' "$HTML" \
  && pass "canonical Supabase bootstrap wired" \
  || fail "Supabase bootstrap path wrong"

grep -Fq 'const db = window.mjhkSupabase;' "$JS" \
  && pass "Supabase client contract aligned" \
  || fail "Supabase client contract missing"

grep -Fq 'async function requireAdminSession()' "$JS" \
  && pass "admin session guard present" \
  || fail "admin session guard missing"

grep -Fq 'from("tv_system_settings")' "$JS" \
  && pass "system settings source present" \
  || fail "system settings source missing"

grep -Fq 'from("tv_prayer_rules")' "$JS" \
  && pass "prayer rules source present" \
  || fail "prayer rules source missing"

if grep -Fq 'from("tv_audio_rules")' "$JS" || grep -Fq 'audio_url' "$JS"; then
  fail "4D-C1 must not mutate audio rules"
else
  pass "audio rules boundary preserved"
fi

if grep -E \
  'device_heartbeat_interval_seconds|device_screenshot_interval_seconds|device_command_poll_seconds|device_offline_after_seconds' \
  "$JS" "$HTML" >/dev/null 2>&1; then
  fail "operational device settings must stay out of Prayer Settings"
else
  pass "device operational boundary preserved"
fi

if grep -E \
  'tv_config_revisions|tv_publication_state|desired_revision_id|active_revision_id|publish_revision|publication_state|\.rpc\([^)]*publish' \
  "$JS" >/dev/null 2>&1; then
  fail "4D-C1 must not mutate revision/publication"
else
  pass "revision/publication boundary preserved"
fi

grep -Fq 'min="-3" max="3"' "$HTML" \
  && pass "Hijri constraint mirrored" \
  || fail "Hijri constraint mismatch"

grep -Fq 'min="-30" max="30"' "$HTML" \
  && pass "Syuruq adjustment constraint mirrored" \
  || fail "Syuruq adjustment constraint mismatch"

grep -Fq 'min="0" max="60"' "$HTML" \
  && pass "0-60 constraints present" \
  || fail "0-60 constraints missing"

# Per-prayer rule controls are rendered dynamically in JS.
grep -Fq 'max="300"' "$JS" \
  && grep -Fq 'iqamah_pause_seconds' "$JS" \
  && grep -Fq '300,' "$JS" \
  && pass "Iqamah pause seconds constraint mirrored" \
  || fail "Iqamah pause seconds constraint mismatch"

grep -Fq 'row.prayer_code === "jumat"' "$JS" \
  && pass "Friday nullable contract handled" \
  || fail "Friday nullable contract missing"

grep -Fq 'JSON.parse' "$JS" \
  && pass "prayer calculation JSON validated" \
  || fail "prayer calculation JSON validation missing"

node --check "$JS" >/dev/null 2>&1 \
  && pass "Prayer Settings JS syntax clean" \
  || fail "Prayer Settings JS syntax error"

for f in \
  admin/tv.html \
  admin/tv-content.html \
  admin/tv-running-text.html \
  admin/tv-dedicated-screens.html \
  admin/tv-theme-layout.html
do
  grep -Fq 'href="tv-prayer-settings.html"' "$f" \
    && pass "$f Prayer Settings menu wired" \
    || fail "$f Prayer Settings menu missing"
done

echo "=== RESULT: PASS=$PASS FAIL=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
