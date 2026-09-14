const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "assets/css/profile-nav-mobile.css");
if (!fs.existsSync(file)) {
  throw new Error("assets/css/profile-nav-mobile.css tidak ditemukan.");
}

const backup = `${file}.phase9c5-desktop.bak`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
  console.log("[BACKUP] assets/css/profile-nav-mobile.css.phase9c5-desktop.bak");
}

let css = fs.readFileSync(file, "utf8");

const markerStart = "/* Phase 9C.5 desktop navbar polish START */";
const markerEnd = "/* Phase 9C.5 desktop navbar polish END */";

const block = `
${markerStart}
@media (min-width: 901px) {
  .nav-inner {
    height: 92px;
  }

  .brand {
    gap: 14px;
  }

  .brand img {
    width: 62px;
    height: 62px;
  }

  .brand strong {
    font-size: 18px;
    line-height: 1.2;
  }

  .brand span {
    font-size: 13px;
    line-height: 1.25;
  }

  .nav-links {
    gap: 30px;
  }

  .nav-links > a,
  .nav-dropdown-toggle {
    font-size: 16px;
    line-height: 1.2;
  }

  .nav-dropdown-menu a {
    font-size: 15px;
    line-height: 1.35;
  }
}
${markerEnd}
`;

const start = css.indexOf(markerStart);
const end = css.indexOf(markerEnd);

if (start >= 0 && end >= 0) {
  css = css.slice(0, start).trimEnd() + "\n\n" + block.trim() + "\n";
  console.log("[PATCH] Existing desktop navbar polish diperbarui.");
} else {
  if (!css.endsWith("\n")) css += "\n";
  css += "\n" + block.trim() + "\n";
  console.log("[PATCH] Desktop navbar sizing ditambahkan.");
}

fs.writeFileSync(file, css, "utf8");

const gitignore = path.join(process.cwd(), ".gitignore");
if (fs.existsSync(gitignore)) {
  let gi = fs.readFileSync(gitignore, "utf8");
  const rule = "*.phase9c5-desktop.bak";
  if (!gi.split(/\r?\n/).some(line => line.trim() === rule)) {
    if (!gi.endsWith("\n")) gi += "\n";
    gi += rule + "\n";
    fs.writeFileSync(gitignore, gi, "utf8");
    console.log("[PATCH] .gitignore: *.phase9c5-desktop.bak");
  }
}

console.log("\n[OK] Desktop navbar polish selesai.");
console.log("NEXT:");
console.log("  bash scripts/verify-phase9c5-desktop-navbar.sh");
