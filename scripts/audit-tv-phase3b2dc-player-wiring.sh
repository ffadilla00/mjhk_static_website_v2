#!/usr/bin/env bash
set -u
echo "=== MJHK TV PHASE 3B.2D-C PLAYER WIRING AUDIT ==="
for f in tv-player/index.html tv-player/assets/js/ui.js tv-player/assets/js/player.js tv-player/assets/js/visual-config.js tv-player/assets/css/player.css tv-player/assets/css/full-bleed-polish.css; do
  [[ -f "$f" ]] && echo "[FOUND] $f" || echo "[MISS]  $f"
done
echo; echo "--- INDEX SURFACES ---"
[[ -f tv-player/index.html ]] && grep -nEi 'id=|class=.*(stage|slide|content|ticker|running|prayer|header|footer|main)' tv-player/index.html | head -n 160 || true
echo; echo "--- UI.JS HOOKS ---"
[[ -f tv-player/assets/js/ui.js ]] && grep -nEi 'export|function|render|stage|slide|content|running|ticker|state|querySelector|getElementById' tv-player/assets/js/ui.js | head -n 240 || true
echo; echo "--- PLAYER.JS HOOKS ---"
[[ -f tv-player/assets/js/player.js ]] && grep -nEi 'import|ui|render|state|NORMAL|querySelector|getElementById|running|slide|content' tv-player/assets/js/player.js | head -n 240 || true
echo; echo "--- CSS HOOKS ---"
for f in tv-player/assets/css/player.css tv-player/assets/css/full-bleed-polish.css; do [[ -f "$f" ]] && { echo "### $f"; grep -nEi 'stage|slide|content|running|ticker|fullscreen|prayer|header|footer|main' "$f" | head -n 200; }; done
echo "=== END AUDIT ==="
