#!/usr/bin/env node
import fs from "node:fs";

const themeJsPath = "admin/tv-theme-layout.js";
const parityJsPath = "admin/tv-theme-layout-parity.js";
const themeCssPath = "admin/tv-theme-layout.css";
const previewRendererPath = "tv-player/assets/js/preview-renderer.js";

if (!fs.existsSync(themeJsPath)) throw new Error(`${themeJsPath} missing`);
if (!fs.existsSync(parityJsPath)) throw new Error(`${parityJsPath} missing`);
if (!fs.existsSync(themeCssPath)) throw new Error(`${themeCssPath} missing`);
if (!fs.existsSync(previewRendererPath)) throw new Error(`${previewRendererPath} missing`);

// 1) Replace parity bridge with fixed logical 1920x1080 scaler.
fs.copyFileSync(
  "scripts/phase4db1-preview-hotfix-v2/tv-theme-layout-parity.js",
  parityJsPath
);
console.log("[PASS] parity bridge replaced");

// 2) Make legacy updatePreview() delegate safely to iframe bridge.
// This removes #tvPreview/null.dataset errors while preserving existing call sites.
let themeJs = fs.readFileSync(themeJsPath, "utf8");

const updatePreviewPattern =
  /function updatePreview\(\)\s*\{[\s\S]*?\n\}\n\nasync function saveProfile\(\)/;

if (!updatePreviewPattern.test(themeJs)) {
  throw new Error("updatePreview() anchor not found in tv-theme-layout.js");
}

themeJs = themeJs.replace(
  updatePreviewPattern,
  `function updatePreview() {
  if (typeof window.mjhkThemePreviewRefresh === "function") {
    window.mjhkThemePreviewRefresh();
  }
}

async function saveProfile()`
);

fs.writeFileSync(themeJsPath, themeJs);
console.log("[PASS] legacy mock updatePreview delegated to iframe bridge");

// 3) Add prayerPositionSelect ref required by ui.js:setPrayerPanelPosition().
let renderer = fs.readFileSync(previewRendererPath, "utf8");

if (!renderer.includes('prayerPositionSelect: $("#prayerPositionSelect")')) {
  const anchor = 'prayerRows: $("#prayerRows"),';
  if (!renderer.includes(anchor)) {
    throw new Error("preview-renderer refs anchor not found");
  }
  renderer = renderer.replace(
    anchor,
    `${anchor}\n  prayerPositionSelect: $("#prayerPositionSelect"),`
  );
  fs.writeFileSync(previewRendererPath, renderer);
  console.log("[PASS] prayerPositionSelect ref added to preview renderer");
} else {
  console.log("[SKIP] prayerPositionSelect ref already present");
}

// 4) Append dimension/scaling CSS once.
let css = fs.readFileSync(themeCssPath, "utf8");
const marker = "/* Phase 4D-B1 Preview Parity Hotfix v2 */";

if (!css.includes(marker)) {
  const addition = fs.readFileSync(
    "scripts/phase4db1-preview-hotfix-v2/tv-theme-layout-parity-v2.css",
    "utf8"
  );
  css += `\n${addition}\n`;
  fs.writeFileSync(themeCssPath, css);
  console.log("[PASS] 1920x1080 scaled preview CSS appended");
} else {
  console.log("[SKIP] preview v2 CSS already present");
}
