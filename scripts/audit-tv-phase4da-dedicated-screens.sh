#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 4D-A DEDICATED SCREENS ARCHITECTURE / SCHEMA AUDIT ==="
echo

echo "--- LOCKED PLAYER STATE DEFINITIONS ---"
grep -RniE \
  'NORMAL|PRE_ADHAN|ADHAN|IQAMAH_COUNTDOWN|IQAMAH|SALAT|PRAYER_PROHIBITION|SYURUQ|ISYRAQ|IMSAK|FRIDAY_PRE_ADHAN|FRIDAY_KHUTBAH|FRIDAY_SALAT' \
  tv-player/assets/js \
  --include='*.js' \
  2>/dev/null | sed -n '1,500p'

echo
echo "--- DEDICATED OVERLAY / UI HOOKS ---"
grep -RniE \
  'stateOverlay|dedicated|overlay|renderState|countdown|beep|audio|adhan|iqamah|khutbah|syuruq|isyraq|imsak|prohibition' \
  tv-player/assets/js tv-player \
  --include='*.js' --include='*.css' --include='*.html' --include='*.md' \
  2>/dev/null | sed -n '1,500p'

echo
echo "--- VISUAL CONFIG / THEME REFERENCES ---"
grep -RniE \
  'visual-config|header|running|prayer panel|prayer-panel|logo|brand|color|background|fullscreen|left|right' \
  tv-player/assets/js tv-player \
  --include='*.js' --include='*.css' --include='*.md' \
  2>/dev/null | sed -n '1,420p'

echo
echo "--- EXISTING CMS DEDICATED SCREEN REFERENCES ---"
grep -RniE \
  'Dedicated Screens|Phase 4D|dedicated screen|PRE_ADHAN|FRIDAY_PRE_ADHAN|IQAMAH_COUNTDOWN' \
  admin scripts supabase \
  --include='*.html' --include='*.js' --include='*.mjs' --include='*.sql' --include='*.md' \
  2>/dev/null | sed -n '1,420p'

echo
echo "--- EXISTING DATABASE / REVISION SNAPSHOT REFERENCES ---"
grep -RniE \
  'tv_config_revisions|snapshot|dedicated|screen|adhan|iqamah|syuruq|isyraq|imsak|khutbah|prayer_prohibition|visual' \
  supabase \
  --include='*.sql' --include='*.md' \
  2>/dev/null | sed -n '1,500p'

echo
echo "--- AUDIO / BEEP / MEDIA SUPPORT REFERENCES ---"
grep -RniE \
  'audio|beep|mp3|ogg|m4a|audio/mpeg|audio/ogg|audio/mp4|media/' \
  admin tv-player supabase workers \
  --include='*.js' --include='*.mjs' --include='*.sql' --include='*.md' \
  2>/dev/null | sed -n '1,420p'

echo
echo "=== END AUDIT ==="
