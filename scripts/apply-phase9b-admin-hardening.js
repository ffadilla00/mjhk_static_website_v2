#!/usr/bin/env node
"use strict";

/*
  MJHK Phase 9B
  Admin DOM/XSS hardening patcher.

  This patcher intentionally edits the CURRENT local admin/admin.js instead of
  replacing it with an older snapshot. That preserves Phase 6/7 finance + agenda code.
*/

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "admin", "admin.js");
const backup = file + ".phase9b.bak";

function die(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(2);
}

if (!fs.existsSync(file)) {
  die(`Tidak menemukan ${file}`);
}

let src = fs.readFileSync(file, "utf8");
const original = src;

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
  console.log(`[BACKUP] ${path.relative(root, backup)}`);
} else {
  console.log(`[INFO] Backup sudah ada: ${path.relative(root, backup)}`);
}

const helper = `
function escHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function setMetaLines(target,lines){
  target.replaceChildren();
  lines.filter(Boolean).forEach((line,index)=>{
    if(index)target.appendChild(document.createElement("br"));
    target.appendChild(document.createTextNode(String(line)));
  });
}
`;

if (!src.includes("function escHTML(value)")) {
  const letMatch = src.match(/^let\s+[^\n]+;\s*$/m);
  if (!letMatch) {
    die("Anchor deklarasi `let ...;` tidak ditemukan. Tidak ada perubahan diterapkan.");
  }
  src = src.replace(letMatch[0], letMatch[0] + "\n" + helper);
  console.log("[PATCH] Helper escHTML() + setMetaLines() ditambahkan.");
} else {
  console.log("[SKIP] Helper escHTML() sudah ada.");
}

/*
  Escape DB/user-controlled text when interpolated into HTML template literals.
  IDs/numeric calculations/date formatters are intentionally not changed.
*/
const textFields = [
  "judul",
  "tema",
  "materi",
  "penceramah",
  "narasumber",
  "waktu",
  "lokasi",
  "jenis",
  "jenis_agenda",
  "kategori",
  "kategori_utama",
  "youtube_url",
  "status",
  "uraian",
  "catatan",
  "keterangan",
  "label",
  "nama"
];

let escapedCount = 0;

for (const field of textFields) {
  /*
    Matches e.g.
      ${x.judul}
      ${x.judul||""}
      ${row.uraian ?? ""}
    Does not match if already wrapped in escHTML().
  */
  const rx = new RegExp(
    String.raw`\$\{([A-Za-z_$][\w$]*)\.${field}\s*(?:(?:\|\||\?\?)\s*(?:""|'')\s*)?\}`,
    "g"
  );

  src = src.replace(rx, (full, obj, offset, whole) => {
    const prefix = whole.slice(Math.max(0, offset - 20), offset);
    if (/escHTML\(\s*$/.test(prefix)) return full;
    escapedCount++;
    return `\${escHTML(${obj}.${field})}`;
  });
}

console.log(`[PATCH] ${escapedCount} interpolasi field teks diamankan dengan escHTML().`);

/*
  File preview metadata: remove innerHTML entirely because file.name/storage filename
  can be attacker-controlled text.
*/
const localMetaOld =
  '$(meta).innerHTML=`Sumber: File lokal<br>Nama file: ${file.name}<br>Ukuran: ${(file.size/(1024*1024)).toFixed(2)} MB`';

const localMetaNew =
  'setMetaLines($(meta),["Sumber: File lokal",`Nama file: ${file.name}`,`Ukuran: ${(file.size/(1024*1024)).toFixed(2)} MB`])';

if (src.includes(localMetaOld)) {
  src = src.replaceAll(localMetaOld, localMetaNew);
  console.log("[PATCH] Preview file lokal dipindah dari innerHTML ke text node.");
} else if (src.includes('Sumber: File lokal') && src.includes("setMetaLines($(meta)")) {
  console.log("[SKIP] Preview file lokal sudah hardened.");
} else {
  console.log("[WARN] Pola preview file lokal tidak ditemukan. Review manual bila fungsi berubah.");
}

const storedMetaOld =
  '$(meta).innerHTML=`Sumber: Supabase Storage${name?`<br>Nama file: ${name}`:""}`';

const storedMetaNew =
  'setMetaLines($(meta),["Sumber: Supabase Storage",...(name?[`Nama file: ${name}`]:[])])';

if (src.includes(storedMetaOld)) {
  src = src.replaceAll(storedMetaOld, storedMetaNew);
  console.log("[PATCH] Preview Supabase Storage dipindah dari innerHTML ke text node.");
} else if (src.includes('Sumber: Supabase Storage') && src.includes("setMetaLines($(meta)")) {
  console.log("[SKIP] Preview Supabase Storage sudah hardened.");
} else {
  console.log("[WARN] Pola preview Supabase Storage tidak ditemukan. Review manual bila fungsi berubah.");
}

/*
  Ensure no accidental string mangling happened before writing.
*/
if (src === original) {
  console.log("[INFO] Tidak ada perubahan baru. File kemungkinan sudah hardened.");
} else {
  fs.writeFileSync(file, src, "utf8");
  console.log(`[OK] Updated ${path.relative(root, file)}`);
}

console.log("");
console.log("NEXT:");
console.log("  node --check admin/admin.js");
console.log("  bash scripts/verify-phase9b.sh");
