import fs from "node:fs";

const htmlFile = "admin/tv-dedicated-screens.html";
const cssFile = "admin/tv-dedicated-screens.css";

if (!fs.existsSync(htmlFile)) throw new Error(`File tidak ditemukan: ${htmlFile}`);

let html = fs.readFileSync(htmlFile, "utf8");

html = html.replace(/<body>\s*<div class="admin-shell">\s*/i, "<body>\n  ");

const dialogAnchor = '<dialog id="editorDialog"';
const dialogIndex = html.indexOf(dialogAnchor);
if (dialogIndex < 0) throw new Error("editorDialog anchor tidak ditemukan.");

let before = html.slice(0, dialogIndex);
const after = html.slice(dialogIndex);

before = before.replace(
  /(\s*<\/div>\s*)<\/main>\s*<\/div>\s*<\/div>\s*$/i,
  `$1      </div>\n    </main>\n\n`
);

if (before.includes('class="admin-shell"')) {
  throw new Error("admin-shell masih tersisa.");
}

const dedicatedOpen = before.indexOf('<div class="dedicated-page">');
const mainClose = before.lastIndexOf('</main>');
if (dedicatedOpen < 0 || mainClose < 0) {
  throw new Error("dedicated-page/main anchor tidak ditemukan.");
}

const segment = before.slice(dedicatedOpen, mainClose);
const opens = (segment.match(/<div\b/gi) || []).length;
const closes = (segment.match(/<\/div>/gi) || []).length;

if (closes < opens) {
  before = before.slice(0, mainClose) + "      </div>\n    " + before.slice(mainClose);
}

html = before + after;

if (fs.existsSync(cssFile)) {
  let css = fs.readFileSync(cssFile, "utf8");
  css = css.replace(
    /\/\* PHASE4D-A2 DESKTOP SHELL HOTFIX START \*\/[\s\S]*?\/\* PHASE4D-A2 DESKTOP SHELL HOTFIX END \*\/\s*/g,
    ""
  );
  fs.writeFileSync(cssFile, css.trimEnd() + "\n", "utf8");
}

fs.writeFileSync(htmlFile, html, "utf8");

console.log("[PASS] admin-shell dihapus.");
console.log("[PASS] dedicated-page ditutup di dalam main.content.");
console.log("[PASS] Legacy desktop shell CSS override dibersihkan.");
