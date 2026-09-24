#!/usr/bin/env node
import fs from "node:fs";

const htmlPath = "admin/tv-prayer-settings.html";
const cssPath = "admin/tv-prayer-settings.css";
const scriptPath = "admin/tv-beep-audio.js";

for (const file of [htmlPath, cssPath, scriptPath]) {
  if (!fs.existsSync(file)) {
    throw new Error(`${file} missing`);
  }
}

let html = fs.readFileSync(htmlPath, "utf8");

if (!html.includes('src="tv-beep-audio.js"')) {
  const anchor = '<script src="tv-prayer-settings.js"></script>';

  if (!html.includes(anchor)) {
    throw new Error("Prayer Settings script anchor not found");
  }

  html = html.replace(
    anchor,
    `${anchor}\n  <script src="tv-beep-audio.js"></script>`
  );

  fs.writeFileSync(htmlPath, html);
  console.log("[PASS] Custom Beep Audio JS wired");
} else {
  console.log("[SKIP] Custom Beep Audio JS already wired");
}

const cssMarker = "/* Phase 4D-C3 Custom Beep Audio */";
let css = fs.readFileSync(cssPath, "utf8");

if (!css.includes(cssMarker)) {
  const addition = fs.readFileSync(
    "scripts/phase4dc3/tv-prayer-settings-beep-audio.css",
    "utf8"
  );

  css += `\n${addition.trim()}\n`;
  fs.writeFileSync(cssPath, css);

  console.log("[PASS] Custom Beep Audio CSS appended");
} else {
  console.log("[SKIP] Custom Beep Audio CSS already present");
}
