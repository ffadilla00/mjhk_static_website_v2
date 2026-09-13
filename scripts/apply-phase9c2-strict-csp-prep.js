#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const loginFile = path.join(root, "admin", "login.html");
const backup = loginFile + ".phase9c2.bak";

function die(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(2);
}

if (!fs.existsSync(loginFile)) die("admin/login.html tidak ditemukan.");

let html = fs.readFileSync(loginFile, "utf8");

if (!fs.existsSync(backup)) {
  fs.copyFileSync(loginFile, backup);
  console.log("[BACKUP] admin/login.html.phase9c2.bak");
}

let styleIndex = 0;
html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, body) => {
  styleIndex++;
  const filename = styleIndex === 1 ? "login-inline.css" : `login-inline-${styleIndex}.css`;
  fs.writeFileSync(path.join(root, "admin", filename), body.trim() + "\n", "utf8");
  console.log(`[PATCH] Inline style -> admin/${filename}`);
  return `<link rel="stylesheet" href="${filename}">`;
});

let scriptIndex = 0;
html = html.replace(
  /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi,
  (full, attrs, body) => {
    scriptIndex++;
    const filename = scriptIndex === 1 ? "login-inline.js" : `login-inline-${scriptIndex}.js`;
    fs.writeFileSync(path.join(root, "admin", filename), body.trim() + "\n", "utf8");
    console.log(`[PATCH] Inline script -> admin/${filename}`);
    const cleanAttrs = String(attrs || "").trim();
    return cleanAttrs
      ? `<script ${cleanAttrs} src="${filename}"></script>`
      : `<script src="${filename}"></script>`;
  }
);

fs.writeFileSync(loginFile, html, "utf8");

if (styleIndex === 0) console.log("[INFO] Tidak ada inline <style>; kemungkinan sudah di-externalize.");
if (scriptIndex === 0) console.log("[INFO] Tidak ada inline <script>; kemungkinan sudah di-externalize.");

console.log("");
console.log("[OK] Strict CSP source preparation selesai.");
console.log("NEXT:");
console.log("  bash scripts/audit-phase9c2-csp.sh");
console.log("  bash scripts/verify-phase9c2.sh");
