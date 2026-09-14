const fs = require("fs");
const path = require("path");

const root = process.cwd();
const index = path.join(root, "index.html");
const gitignore = path.join(root, ".gitignore");

if (!fs.existsSync(index)) throw new Error("index.html tidak ditemukan.");

const backup = `${index}.phase9c5.bak`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(index, backup);
  console.log("[BACKUP] index.html.phase9c5.bak");
}

let html = fs.readFileSync(index, "utf8");
const css = "assets/css/profile-nav-mobile.css";
const js = "assets/js/profile-nav-mobile.js";

if (!html.includes(css)) {
  html = html.replace("</head>", `  <link rel="stylesheet" href="${css}">\n</head>`);
  console.log("[PATCH] CSS mobile Profile nav ditambahkan ke index.html");
} else {
  console.log("[SKIP] CSS mobile Profile nav sudah ada");
}

if (!html.includes(js)) {
  html = html.replace("</body>", `<script src="${js}"></script>\n</body>`);
  console.log("[PATCH] JS mobile Profile nav ditambahkan ke index.html");
} else {
  console.log("[SKIP] JS mobile Profile nav sudah ada");
}

fs.writeFileSync(index, html, "utf8");

if (fs.existsSync(gitignore)) {
  let gi = fs.readFileSync(gitignore, "utf8");
  if (!gi.split(/\r?\n/).includes("*.phase9c5.bak")) {
    if (!gi.endsWith("\n")) gi += "\n";
    gi += "*.phase9c5.bak\n";
    fs.writeFileSync(gitignore, gi, "utf8");
    console.log("[PATCH] .gitignore");
  }
}

console.log("\n[OK] Phase 9C.5 Final terpasang.");
