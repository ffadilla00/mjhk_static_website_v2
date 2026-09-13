#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const HTML_FILES = [
  "index.html","admin/index.html","admin/login.html","admin/profile.html",
  "profile/sejarah.html","profile/visi-misi.html","profile/struktur-dkm.html","profile/program-fasilitas.html"
];
const ADMIN_FILES = ["admin/index.html","admin/login.html","admin/profile.html"];
function die(msg){ console.error(`[FAIL] ${msg}`); process.exit(2); }
function backup(file){ const bak=file+".phase9c1.bak"; if(!fs.existsSync(bak)) fs.copyFileSync(file,bak); }
for(const rel of HTML_FILES){
  const file=path.join(root,rel); if(!fs.existsSync(file)) die(`File tidak ditemukan: ${rel}`);
  let src=fs.readFileSync(file,"utf8"), before=src;
  src=src.replaceAll("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2","https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0");
  src=src.replaceAll("https://cdn.jsdelivr.net/npm/marked/marked.min.js","https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js");
  if(src!==before){ backup(file); fs.writeFileSync(file,src,"utf8"); console.log(`[PATCH] Dependency pinning: ${rel}`); }
  else console.log(`[INFO] Tidak ada floating dependency target di ${rel}`);
}
for(const rel of ADMIN_FILES){
  const file=path.join(root,rel); let src=fs.readFileSync(file,"utf8");
  if(/name=["']robots["']/i.test(src)){ console.log(`[SKIP] robots meta sudah ada: ${rel}`); continue; }
  const meta='  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet">\n';
  if(/<head[^>]*>/i.test(src)){
    backup(file); src=src.replace(/(<head[^>]*>\s*)/i,`$1${meta}`); fs.writeFileSync(file,src,"utf8"); console.log(`[PATCH] Admin noindex: ${rel}`);
  } else console.warn(`[WARN] <head> tidak ditemukan pada ${rel}`);
}
fs.writeFileSync(path.join(root,"robots.txt"),`User-agent: *\nAllow: /\nDisallow: /admin/\n\n# Sitemap ditambahkan setelah domain production final.\n`,"utf8");
console.log("[PATCH] robots.txt dibuat.");
console.log("\nNEXT:\n  bash scripts/audit-phase9c-origins.sh\n  bash scripts/verify-phase9c1.sh");
