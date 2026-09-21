#!/usr/bin/env node
import fs from "node:fs";

const FILES = [
  "admin/tv.html",
  "admin/tv-content.html",
];

const ACTIVE_LINK =
  '<a class="menu-link" href="tv-running-text.html">Running Text</a>';

function patchFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }

  let html = fs.readFileSync(file, "utf8");

  // Already active: idempotent no-op.
  if (html.includes('href="tv-running-text.html"')) {
    console.log(`[INFO] Running Text link sudah aktif di ${file}.`);
    return;
  }

  // Strategy A: replace any disabled button/menu item containing Running Text.
  const disabledPatterns = [
    /<button\b[^>]*class="[^"]*\bmenu-link\b[^"]*\bdisabled\b[^"]*"[^>]*>\s*Running Text[\s\S]*?<\/button>/i,
    /<button\b[^>]*disabled[^>]*>\s*Running Text[\s\S]*?<\/button>/i,
    /<div\b[^>]*class="[^"]*\bmenu-link\b[^"]*\bdisabled\b[^"]*"[^>]*>\s*Running Text[\s\S]*?<\/div>/i,
  ];

  for (const pattern of disabledPatterns) {
    if (pattern.test(html)) {
      html = html.replace(pattern, ACTIVE_LINK);
      fs.writeFileSync(file, html, "utf8");
      console.log(`[PASS] Running Text disabled item diganti di ${file}.`);
      return;
    }
  }

  // Strategy B: insert after Slideshow menu link.
  const slideshowLinkPatterns = [
    /(<a\b[^>]*class="[^"]*\bmenu-link\b[^"]*"[^>]*href="tv-content\.html"[^>]*>\s*Slideshow\s*<\/a>)/i,
    /(<a\b[^>]*href="tv-content\.html"[^>]*class="[^"]*\bmenu-link\b[^"]*"[^>]*>\s*Slideshow\s*<\/a>)/i,
  ];

  for (const pattern of slideshowLinkPatterns) {
    if (pattern.test(html)) {
      html = html.replace(pattern, `$1\n      ${ACTIVE_LINK}`);
      fs.writeFileSync(file, html, "utf8");
      console.log(`[PASS] Running Text link disisipkan setelah Slideshow di ${file}.`);
      return;
    }
  }

  // Strategy C: generic tv-content.html link fallback, preserving surrounding markup.
  const genericAnchor =
    /(<a\b[^>]*href="tv-content\.html"[^>]*>[\s\S]*?<\/a>)/i;

  if (genericAnchor.test(html)) {
    html = html.replace(genericAnchor, `$1\n      ${ACTIVE_LINK}`);
    fs.writeFileSync(file, html, "utf8");
    console.log(`[PASS] Running Text link disisipkan via fallback anchor di ${file}.`);
    return;
  }

  throw new Error(
    `Tidak menemukan anchor Slideshow/Running Text yang aman di ${file}.`
  );
}

for (const file of FILES) {
  patchFile(file);
}
