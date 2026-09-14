const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "assets/css/profile-nav-mobile.css");
if (!fs.existsSync(file)) {
  throw new Error("assets/css/profile-nav-mobile.css tidak ditemukan.");
}

const backup = `${file}.phase9c5-polish.bak`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
  console.log("[BACKUP] assets/css/profile-nav-mobile.css.phase9c5-polish.bak");
}

let css = fs.readFileSync(file, "utf8");

const markerStart = "/* Phase 9C.5 navbar size polish START */";
const markerEnd = "/* Phase 9C.5 navbar size polish END */";

const block = `
${markerStart}
@media (max-width: 900px) {
  /* Sedikit memperbesar identitas masjid di header mobile */
  .nav-inner {
    height: 86px;
  }

  .brand {
    gap: 13px;
  }

  .brand img {
    width: 56px;
    height: 56px;
  }

  .brand strong {
    font-size: 16px;
    line-height: 1.2;
  }

  .brand span {
    font-size: 13px;
  }

  /* Karena tinggi header naik dari 78px ke 86px */
  .nav-links {
    top: 86px;
  }

  /* Menu utama sedikit lebih mudah dibaca/tap */
  #navLinks > a,
  #navLinks .nav-dropdown-toggle {
    font-size: 16px;
    line-height: 1.25;
    padding: 12px 14px;
  }

  #navLinks .nav-dropdown-menu a {
    font-size: 15px;
    line-height: 1.35;
    padding: 11px 12px;
  }

  .menu-btn {
    font-size: 20px;
    padding: 11px 14px;
  }
}

@media (max-width: 380px) {
  /* Hindari header terlalu penuh di layar yang sangat sempit */
  .brand img {
    width: 52px;
    height: 52px;
  }

  .brand strong {
    font-size: 15px;
  }

  .nav-inner {
    gap: 10px;
  }
}
${markerEnd}
`;

const start = css.indexOf(markerStart);
const end = css.indexOf(markerEnd);

if (start >= 0 && end >= 0) {
  css =
    css.slice(0, start).trimEnd() +
    "\n\n" +
    block.trim() +
    "\n";
  console.log("[PATCH] Existing navbar size polish diperbarui.");
} else {
  if (!css.endsWith("\n")) css += "\n";
  css += "\n" + block.trim() + "\n";
  console.log("[PATCH] Navbar mobile logo/font sizing ditambahkan.");
}

fs.writeFileSync(file, css, "utf8");

const gitignore = path.join(process.cwd(), ".gitignore");
if (fs.existsSync(gitignore)) {
  let gi = fs.readFileSync(gitignore, "utf8");
  const rule = "*.phase9c5-polish.bak";
  if (!gi.split(/\r?\n/).some(line => line.trim() === rule)) {
    if (!gi.endsWith("\n")) gi += "\n";
    gi += rule + "\n";
    fs.writeFileSync(gitignore, gi, "utf8");
    console.log("[PATCH] .gitignore: *.phase9c5-polish.bak");
  }
}

console.log("\n[OK] Mobile navbar size polish selesai.");
console.log("NEXT:");
console.log("  bash scripts/verify-phase9c5-navbar-polish.sh");
