#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const SITE = "https://www.mj-harapankita.or.id";
const SITE_NAME = "Masjid Jami' Harapan Kita";
const DEFAULT_DESCRIPTION = "Website resmi Masjid Jami' Harapan Kita: informasi kegiatan, kajian, dakwah, media, profile masjid, dan laporan keuangan.";
const OG_IMAGE = `${SITE}/assets/images/hero-masjid.jpg`;

const pages = [
  ["index.html", "/"],
  ["profile/sejarah.html", "/profile/sejarah.html"],
  ["profile/visi-misi.html", "/profile/visi-misi.html"],
  ["profile/struktur-dkm.html", "/profile/struktur-dkm.html"],
  ["profile/program-fasilitas.html", "/profile/program-fasilitas.html"],
];

function backup(file) {
  const bak = file + ".phase9c3.bak";
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
}

function getTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : SITE_NAME;
}

function getDescription(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
            html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  return m ? m[1].trim() : DEFAULT_DESCRIPTION;
}

function escapeAttr(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function removeExistingSeo(html) {
  return html
    .replace(/\s*<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, "\n");
}

for (const [rel, route] of pages) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error(`[FAIL] Missing ${rel}`);
    process.exit(2);
  }

  let html = fs.readFileSync(file, "utf8");
  const title = getTitle(html);
  const description = getDescription(html);
  const url = `${SITE}${route}`;

  backup(file);
  html = removeExistingSeo(html);

  if (!/name=["']description["']/i.test(html)) {
    html = html.replace(
      /(<head[^>]*>\s*)/i,
      `$1  <meta name="description" content="${escapeAttr(description)}">\n`
    );
  }

  const seo = [
    `  <link rel="canonical" href="${url}">`,
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">`,
    `  <meta property="og:title" content="${escapeAttr(title)}">`,
    `  <meta property="og:description" content="${escapeAttr(description)}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="${OG_IMAGE}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeAttr(title)}">`,
    `  <meta name="twitter:description" content="${escapeAttr(description)}">`,
    `  <meta name="twitter:image" content="${OG_IMAGE}">`,
  ].join("\n") + "\n";

  html = html.replace(/(<head[^>]*>\s*)/i, `$1${seo}`);
  fs.writeFileSync(file, html, "utf8");
  console.log(`[PATCH] SEO/canonical: ${rel} -> ${url}`);
}

const today = new Date().toISOString().slice(0, 10);
const urls = pages.map(([, route]) => `${SITE}${route}`);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap, "utf8");

const robots = `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE}/sitemap.xml
`;

fs.writeFileSync(path.join(root, "robots.txt"), robots, "utf8");

console.log("[PATCH] sitemap.xml dibuat");
console.log("[PATCH] robots.txt diperbarui dengan Sitemap");
console.log("[OK] Phase 9C.3 metadata selesai");
