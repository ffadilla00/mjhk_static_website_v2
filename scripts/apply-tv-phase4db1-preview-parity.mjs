#!/usr/bin/env node
import fs from "node:fs";

const indexPath = "tv-player/index.html";
const previewPath = "tv-player/preview.html";
const themeHtmlPath = "admin/tv-theme-layout.html";
const themeCssPath = "admin/tv-theme-layout.css";

const indexHtml = fs.readFileSync(indexPath, "utf8");

const playerScriptPattern =
  /<script\s+type=["']module["']\s+src=["']assets\/js\/player\.js["']><\/script>/;

if (!playerScriptPattern.test(indexHtml)) {
  throw new Error("tv-player/index.html player.js script anchor not found");
}

const previewHtml = indexHtml
  .replace(
    /<title>[^<]*<\/title>/,
    "<title>MJHK TV Player Preview</title>"
  )
  .replace(
    playerScriptPattern,
    '<script type="module" src="assets/js/preview-renderer.js"></script>'
  );

fs.writeFileSync(previewPath, previewHtml);
console.log("[PASS] generated tv-player/preview.html from canonical index.html");

let themeHtml = fs.readFileSync(themeHtmlPath, "utf8");

const parityScript =
  '<script src="tv-theme-layout-parity.js"></script>';

if (!themeHtml.includes(parityScript)) {
  const themeScript =
    '<script src="tv-theme-layout.js"></script>';

  if (!themeHtml.includes(themeScript)) {
    throw new Error("Theme page JS anchor not found");
  }

  themeHtml = themeHtml.replace(
    themeScript,
    `${themeScript}\n  ${parityScript}`
  );

  fs.writeFileSync(themeHtmlPath, themeHtml);
  console.log("[PASS] Theme page parity script wired");
} else {
  console.log("[SKIP] Theme page parity script already wired");
}

let css = fs.readFileSync(themeCssPath, "utf8");
const cssMarker = "/* Phase 4D-B1 Preview Parity Recovery */";

if (!css.includes(cssMarker)) {
  const addition = fs.readFileSync(
    "scripts/phase4db1-preview-parity/tv-theme-layout-parity.css",
    "utf8"
  );
  css += `\n${addition}\n`;
  fs.writeFileSync(themeCssPath, css);
  console.log("[PASS] Theme preview iframe CSS appended");
} else {
  console.log("[SKIP] Theme preview iframe CSS already present");
}
