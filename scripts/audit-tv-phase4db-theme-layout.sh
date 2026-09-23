#!/usr/bin/env bash
set -u
echo "=== MJHK TV PHASE 4D-B THEME & LAYOUT LOCAL AUDIT ==="
echo
echo "--- PLAYER VISUAL/THEME/LAYOUT REFERENCES ---"
grep -RniE 'visual_config|visualConfig|theme|layout|prayer.*side|panel.*side|header.*color|running.*color|prayer.*color|background|brand|logo|fullscreen|dataset\.playerMode' tv-player/assets/js tv-player/assets/css 2>/dev/null | head -260 || true
echo
echo "--- CMS THEME/LAYOUT MENU REFERENCES ---"
grep -RniE 'Theme & Layout|Theme &amp; Layout|Prayer Settings|Dedicated Screens' admin/tv.html admin/tv-content.html admin/tv-running-text.html admin/tv-dedicated-screens.html 2>/dev/null || true
echo
echo "--- POSSIBLE CONFIG TABLE REFERENCES IN REPO ---"
grep -RniE 'tv_visual|visual_config|tv_system_settings|theme|layout|prayer_panel|panel_side|header_color|running_text_color|prayer_color' admin tv-player supabase/tv 2>/dev/null | head -320 || true
echo
echo "--- SNAPSHOT BUILD/PUBLISH REFERENCES ---"
grep -RniE 'visual_config|prayer_settings|theme|layout|snapshot' admin tv-player supabase/tv 2>/dev/null | head -260 || true
echo
echo "=== END LOCAL AUDIT ==="
