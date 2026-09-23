# Phase 4D-B1 Preview Parity Hotfix v2

Root causes confirmed from browser console:

- Theme source JS retained a call path to the removed mock `#tvPreview`.
- `applyVisualConfig()` calls `setPrayerPanelPosition()`, which expects the
  canonical player's `prayerPositionSelect` reference.
- A small iframe viewport changes responsive player proportions.

Fix:

- bridge legacy `updatePreview()` into postMessage refresh;
- include all refs required by the real `ui.js` visual application path;
- render preview with a logical 1920x1080 iframe and scale the frame into the CMS card.
