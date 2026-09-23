#!/usr/bin/env node
import fs from "node:fs";

const replacements = {
  "admin/tv-theme-layout.html": fs.readFileSync(
    "scripts/phase4db1-recovery/tv-theme-layout.html",
    "utf8"
  ),
  "admin/tv-theme-layout.css": fs.readFileSync(
    "scripts/phase4db1-recovery/tv-theme-layout.css",
    "utf8"
  ),
  "admin/tv-theme-layout.js": fs.readFileSync(
    "scripts/phase4db1-recovery/tv-theme-layout.js",
    "utf8"
  ),
};

for (const [target, content] of Object.entries(replacements)) {
  fs.writeFileSync(target, content);
  console.log(`[PASS] recovered ${target}`);
}
