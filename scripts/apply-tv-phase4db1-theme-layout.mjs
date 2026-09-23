#!/usr/bin/env node
import fs from "node:fs";

const files = [
  "admin/tv.html",
  "admin/tv-content.html",
  "admin/tv-running-text.html",
  "admin/tv-dedicated-screens.html",
];

const disabled = '<button type="button" class="menu-link disabled" disabled>Theme &amp; Layout <small>Phase 4D</small></button>';
const link = '<a class="menu-link" href="tv-theme-layout.html">Theme &amp; Layout</a>';

for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes(disabled)) {
    text = text.replace(disabled, link);
    fs.writeFileSync(file, text);
    console.log(`[PASS] menu activated: ${file}`);
  } else if (text.includes('href="tv-theme-layout.html"')) {
    console.log(`[SKIP] menu already active: ${file}`);
  } else {
    throw new Error(`Theme & Layout anchor not found in ${file}`);
  }
}

const vcPath = "tv-player/assets/js/visual-config.js";
let vc = fs.readFileSync(vcPath, "utf8");

if (!vc.includes("DEFAULT_MJHK_LOGO_URL")) {
  vc = `const DEFAULT_MJHK_LOGO_URL = new URL("../img/mjhk-logo.png", import.meta.url).href;\n\n${vc}`;
}

vc = vc.replace(
  /logoUrl:\s*null,/,
  "logoUrl: DEFAULT_MJHK_LOGO_URL,"
);

fs.writeFileSync(vcPath, vc);
console.log("[PASS] static MJHK logo wired into visual-config.js");
