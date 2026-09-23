#!/usr/bin/env bash
set -u

echo "=== MJHK TV 4D-B1 PREVIEW PARITY AUDIT ==="

echo
echo "--- 1. PLAYER HTML / CSS / SCRIPT ORDER ---"
grep -nE \
'<link |<script |id="(tvStage|tvHeader|prayerPanel|contentPanel|normalContent|runningTextBar|mosqueLogo|mosqueLogoFallback)|class="(tv-|prayer-|running-)' \
tv-player/index.html 2>/dev/null | head -140

echo
echo "--- 2. PLAYER BOOTSTRAP + VISUAL CONFIG ---"
grep -nE \
'VISUAL_CONFIG|applyVisualConfig|setPrayerPanelPosition|querySelector|playerMode|production|simulator|preview|bootstrap|start|init' \
tv-player/assets/js/player.js \
tv-player/assets/js/ui.js \
tv-player/assets/js/visual-config.js 2>/dev/null | head -180

echo
echo "--- 3. PLAYER RUNTIME SIDE EFFECTS ---"
grep -RniE \
'heartbeat|command|poll|revision|desired_revision|applied_revision|active_revision|device_code|device_token|fetch\(|rpc\(|setInterval|setTimeout' \
tv-player/assets/js/player.js \
tv-player/assets/js/revision-sync-startup.js \
tv-player/assets/js/revision-sync-startup-dependencies.js \
tv-player/assets/js/presentation-player-bridge.js \
tv-player/assets/js 2>/dev/null | head -180

echo
echo "--- 4. PLAYER CSS STRUCTURE / LAYOUT ---"
grep -nE \
'(^|[,{[:space:]])\.(tv-shell|tv-header|tv-body|tv-prayers|tv-stage|tv-footer|mosque-logo|prayer-row|running-text|running-label)|#(tvStage|tvHeader|prayerPanel|contentPanel|normalContent|runningTextBar)' \
tv-player/assets/css/player.css \
tv-player/assets/css/full-bleed-polish.css \
tv-player/assets/css/presentation-player-bridge.css 2>/dev/null | head -220

echo
echo "--- 5. THEME CMS CURRENT PREVIEW IMPLEMENTATION ---"
grep -nE \
'tvPreview|preview-|postMessage|iframe|applyVisualConfig|theme_|prayerPanelSide|headerShow|runningSpeed|slideDuration' \
admin/tv-theme-layout.html \
admin/tv-theme-layout.js \
admin/tv-theme-layout.css 2>/dev/null | head -180

echo
echo "--- 6. CURRENT PLAYER MODE CONTRACT ---"
grep -RniE \
'mode=|URLSearchParams|searchParams|get\("mode"\)|dataset\.playerMode|productionMode|simulator' \
tv-player 2>/dev/null | head -120

echo
echo "--- 7. PLAYER ASSET DEPENDENCY LIST ---"
printf "JS files:\n"
grep -nE '<script ' tv-player/index.html 2>/dev/null | head -60
printf "\nCSS files:\n"
grep -nE '<link .*stylesheet' tv-player/index.html 2>/dev/null | head -60

echo
echo "=== END AUDIT ==="
