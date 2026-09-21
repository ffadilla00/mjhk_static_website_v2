#!/usr/bin/env node
import fs from "node:fs";

const FILE = "admin/tv.html";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}`);
}

let html = fs.readFileSync(FILE, "utf8");

const exact =
  '      <a class="menu-link" href="profile.html">Profile Masjid</a>\n';

if (html.includes(exact)) {
  html = html.replace(exact, "");
} else {
  html = html.replace(
    /\s*<a[^>]+href=["']profile\.html["'][^>]*>\s*Profile Masjid\s*<\/a>\s*/i,
    "\n"
  );
}

if (/href=["']profile\.html["']/i.test(html)) {
  throw new Error(
    "Profile Masjid masih ditemukan di sidebar TV CMS."
  );
}

fs.writeFileSync(FILE, html, "utf8");

console.log(
  "[PASS] Profile Masjid dipisahkan dari sidebar MJHK TV CMS."
);
console.log(
  "[INFO] Modul Profile Masjid pada Admin utama tidak disentuh."
);
