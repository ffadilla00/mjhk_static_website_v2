#!/usr/bin/env bash
set -u

echo "=== MJHK TV 4D-B1 UI RECOVERY AUDIT ==="

echo
echo "--- 1. HTML HEAD / CSS / SCRIPT WIRING ---"
for f in \
  admin/tv-dedicated-screens.html \
  admin/tv-running-text.html \
  admin/tv-content.html \
  admin/tv-theme-layout.html
do
  echo
  echo "### $f"
  grep -nE '<link |<script |<body|class="(layout|admin-shell|sidebar|main|content|top)' "$f" 2>/dev/null | head -40
done

echo
echo "--- 2. SIDEBAR / MENU MARKUP ---"
for f in \
  admin/tv-dedicated-screens.html \
  admin/tv-theme-layout.html
do
  echo
  echo "### $f"
  sed -n '1,45p' "$f" 2>/dev/null
done

echo
echo "--- 3. SUPABASE BOOTSTRAP CONTRACT ---"
grep -nE \
'window\.mjhkSupabase|mjhkSupabase|createClient|supabase-client|DOMContentLoaded|loadProfiles|loadStates|loadContents' \
admin/supabase-client.js \
admin/tv-dedicated-screens.js \
admin/tv-running-text.js \
admin/tv-content.js \
admin/tv-theme-layout.js 2>/dev/null | head -120

echo
echo "--- 4. PAGE-SPECIFIC CSS SHELL SELECTORS ---"
for f in \
  admin/tv-dedicated-screens.css \
  admin/tv-running-text.css \
  admin/tv-content.css \
  admin/tv-theme-layout.css \
  admin/admin.css
do
  echo
  echo "### $f"
  grep -nE \
  '(^|[,{[:space:]])\.(layout|sidebar|main|content|top|menu|menu-link|menu-group-title|admin-shell|editor-grid|settings-panel|preview-card)' \
  "$f" 2>/dev/null | head -60
done

echo
echo "--- 5. THEME PAGE TOP JS ---"
sed -n '1,45p' admin/tv-theme-layout.js 2>/dev/null

echo
echo "--- 6. DEDICATED PAGE TOP JS ---"
sed -n '1,55p' admin/tv-dedicated-screens.js 2>/dev/null

echo
echo "=== END AUDIT ==="
