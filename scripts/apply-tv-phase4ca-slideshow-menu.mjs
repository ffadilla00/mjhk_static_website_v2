#!/usr/bin/env node
import fs from "node:fs";

const TV = "admin/tv.html";

if (!fs.existsSync(TV)) {
  throw new Error(`Missing ${TV}`);
}

let html =
  fs.readFileSync(TV, "utf8");

const oldButton =
  /<button type="button" class="menu-link disabled" disabled>\s*Slideshow\s*<small>Phase 4C<\/small><\/button>/i;

const newLink =
  '<a class="menu-link" href="tv-content.html">Slideshow</a>';

if (html.includes('href="tv-content.html"')) {
  console.log(
    "[INFO] Slideshow link sudah aktif."
  );
} else if (oldButton.test(html)) {
  html = html.replace(
    oldButton,
    newLink
  );

  fs.writeFileSync(
    TV,
    html,
    "utf8"
  );

  console.log(
    "[PASS] Slideshow menu diaktifkan."
  );
} else {
  throw new Error(
    "Anchor menu Slideshow Phase 4C tidak ditemukan."
  );
}
