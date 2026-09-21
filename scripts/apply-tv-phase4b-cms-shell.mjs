#!/usr/bin/env node
import fs from "node:fs";

const INDEX = "admin/index.html";

if (!fs.existsSync(INDEX)) {
  throw new Error(`Missing ${INDEX}`);
}

let html = fs.readFileSync(INDEX, "utf8");

const tvLink =
  '<a href="tv.html" class="menu-link">MJHK TV</a>';

if (html.includes('href="tv.html"')) {
  console.log("[INFO] Link MJHK TV sudah tersedia.");
  process.exit(0);
}

const profileLink =
  '<a href="profile.html" class="menu-link">Profile Masjid</a>';

if (!html.includes(profileLink)) {
  throw new Error(
    "Anchor Profile Masjid pada admin/index.html tidak ditemukan."
  );
}

html = html.replace(
  profileLink,
  `${profileLink}\n${tvLink}`
);

fs.writeFileSync(INDEX, html, "utf8");

console.log("[PASS] Link MJHK TV ditambahkan ke sidebar admin.");
