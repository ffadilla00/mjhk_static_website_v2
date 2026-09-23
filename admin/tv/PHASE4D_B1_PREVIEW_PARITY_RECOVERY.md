# Phase 4D-B1 Preview Parity Architecture

Audit confirmed the production player starts revision/runtime operations before
its existing production/simulator mode decision. Therefore `?mode=production`
must not be embedded directly in the Theme CMS.

Recovery strategy:

1. Keep `tv-player/index.html` and `player.js` production path unchanged.
2. Generate `tv-player/preview.html` from canonical `index.html`.
3. Replace only the module entry with `preview-renderer.js`.
4. Reuse the same player CSS and DOM.
5. Apply draft theme/layout through `applyVisualConfig()`.
6. Exchange draft data through same-origin `postMessage()`.
7. Do not initialize revision/device/network operations.

This gives visual parity while preserving locked runtime behavior.
