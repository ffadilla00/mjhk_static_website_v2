#!/usr/bin/env node
import fs from "node:fs";

const pages = [
  "admin/tv.html",
  "admin/tv-content.html",
  "admin/tv-running-text.html",
  "admin/tv-dedicated-screens.html",
  "admin/tv-theme-layout.html",
];

const prayerDisabledPattern =
  /<button\s+type=["']button["']\s+class=["']menu-link disabled["']\s+disabled>\s*Prayer Settings\s*<small>Phase 4D<\/small>\s*<\/button>/m;

const prayerLink =
  '<a class="menu-link" href="tv-prayer-settings.html">Prayer Settings</a>';

for (const file of pages) {
  let html = fs.readFileSync(file, "utf8");

  if (html.includes('href="tv-prayer-settings.html"')) {
    console.log(`[SKIP] Prayer Settings already wired: ${file}`);
    continue;
  }

  if (!prayerDisabledPattern.test(html)) {
    throw new Error(`Prayer Settings disabled anchor not found: ${file}`);
  }

  html = html.replace(prayerDisabledPattern, prayerLink);
  fs.writeFileSync(file, html);

  console.log(`[PASS] Prayer Settings menu wired: ${file}`);
}
