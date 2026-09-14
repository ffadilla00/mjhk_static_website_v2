const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ADMIN_JS = path.join(ROOT, "admin", "admin.js");
const ADMIN_CSS = path.join(ROOT, "admin", "admin.css");
const GITIGNORE = path.join(ROOT, ".gitignore");

function need(file) {
  if (!fs.existsSync(file)) throw new Error(`File tidak ditemukan: ${file}`);
}

function backupOnce(file) {
  const backup = `${file}.finance-typography-v2-1.bak`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(file, backup);
    console.log(`[BACKUP] ${path.relative(ROOT, backup)}`);
  }
}

need(ADMIN_JS);
need(ADMIN_CSS);
backupOnce(ADMIN_JS);
backupOnce(ADMIN_CSS);

let js = fs.readFileSync(ADMIN_JS, "utf8");

if (!js.includes("function fitPosterRowLabels")) {
  throw new Error(
    "Finance Typography v2.0 belum terdeteksi di admin.js. " +
    "Pasang v2.0 terlebih dahulu sebelum v2.1."
  );
}

if (js.includes("const MIN_SIZE=13;")) {
  js = js.replace("const MIN_SIZE=13;", "const MIN_SIZE=12.5;");
  console.log("[PATCH] Adaptive minimum font: 13px -> 12.5px");
} else if (js.includes("const MIN_SIZE=12.5;")) {
  console.log("[SKIP] Adaptive minimum font sudah 12.5px");
} else {
  throw new Error("Konstanta MIN_SIZE Finance Typography v2.0 tidak ditemukan.");
}

fs.writeFileSync(ADMIN_JS, js, "utf8");

let css = fs.readFileSync(ADMIN_CSS, "utf8");

if (!css.includes("/* Finance Typography v2.0 START */")) {
  throw new Error(
    "Finance Typography v2.0 belum terdeteksi di admin.css. " +
    "Pasang v2.0 terlebih dahulu sebelum v2.1."
  );
}

const startMarker = "/* Finance Typography v2.1 START */";
const endMarker = "/* Finance Typography v2.1 END */";

const block = `/* Finance Typography v2.1 START */
/* Minor readability polish:
   income gets slightly more room because its labels are typically longer. */

.poster-columns{
  grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);
}

.poster-row{
  gap:8px;
}

.poster-row strong{
  margin-left:0;
}
/* Finance Typography v2.1 END */`;

const start = css.indexOf(startMarker);
const endPos = css.indexOf(endMarker);

if (start >= 0 && endPos >= start) {
  const end = endPos + endMarker.length;
  css = css.slice(0, start).trimEnd() + "\n\n" + block + "\n";
  console.log("[PATCH] Existing Finance Typography v2.1 CSS diperbarui.");
} else {
  if (!css.endsWith("\n")) css += "\n";
  css += "\n" + block + "\n";
  console.log("[PATCH] Income/expense width polish dipasang.");
}

fs.writeFileSync(ADMIN_CSS, css, "utf8");

if (fs.existsSync(GITIGNORE)) {
  let gi = fs.readFileSync(GITIGNORE, "utf8");
  const rule = "*.finance-typography-v2-1.bak";
  if (!gi.split(/\r?\n/).some(line => line.trim() === rule)) {
    if (!gi.endsWith("\n")) gi += "\n";
    gi += rule + "\n";
    fs.writeFileSync(GITIGNORE, gi, "utf8");
    console.log("[PATCH] .gitignore: *.finance-typography-v2-1.bak");
  }
}

console.log("\n[OK] Finance Typography v2.1 minor polish terpasang.");
console.log("NEXT:");
console.log("  node --check admin/admin.js");
console.log("  bash scripts/verify-finance-typography-v2-1.sh");
