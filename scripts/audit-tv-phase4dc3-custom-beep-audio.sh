#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 4D-C3 CUSTOM BEEP AUDIO AUDIT ==="
echo

echo "## 1. Runtime beep/audio implementation"
grep -RniE 'AudioContext|webkitAudioContext|createOscillator|oscillator|GainNode|createGain|playBeep|beep[A-Za-z_]*|new Audio|HTMLAudioElement|audio\.play|\.play\(\)' tv-player | head -220
echo

echo "## 2. Beep counts and prayer-state usage"
grep -RniE 'beep_adhan_count|beep_iqamah_count|beep_forbidden_count|beep_isyraq_count|beep_imsak_count|ADHAN|IQAMAH|FORBIDDEN_PRAYER|ISYRAQ|IMSAK' tv-player/assets/js | head -260
echo

echo "## 3. Visual/revision/snapshot contracts"
grep -RniE 'tv_system_settings|system_settings|display_profiles|audio_rules|snapshot|config_revision|revision' supabase/tv tv-player/assets/js | head -260
echo

echo "## 4. Storage usage in existing CMS"
grep -RniE '\.storage|from\(["'"'"']tv-content["'"'"']\)|storage_bucket|storage_path|createSignedUrl|download\(' admin tv-player assets supabase/tv | head -260
echo

echo "## 5. Existing audio MIME / validation references"
grep -RniE 'audio/|mp3|mpeg|wav|ogg|aac|m4a|webm|MIME|content-type|accept=.*audio' admin tv-player supabase scripts | head -220
echo

echo "## 6. Existing relevant schema/migrations"
grep -RniE 'tv_audio_rules|audio_url|storage_bucket|storage_path|beep_.*count' supabase/tv | head -260
echo

echo "## 7. Player script/module topology"
grep -RniE '^import |^export ' tv-player/assets/js/player.js tv-player/assets/js/ui.js tv-player/assets/js/*audio*.js tv-player/assets/js/*beep*.js 2>/dev/null | head -220
echo

echo "## 8. Canonical CMS template anchors"
for f in admin/tv-theme-layout.html admin/tv-prayer-settings.html admin/tv-dedicated-screens.html
do
  echo "--- $f"
  grep -nE 'tv-admin\.css|class="sidebar"|class="brand"|menu-section-title|class="content"|class="topbar"|top-actions|supabase-js|supabase-client\.js|requireAdminSession|btn-save|btn-cancel' "$f" 2>/dev/null | head -100
done
echo

echo "=== END AUDIT ==="
