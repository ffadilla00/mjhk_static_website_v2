import fs from "node:fs";

const sourcePage = "admin/tv-running-text.html";
const targetPage = "admin/tv-dedicated-screens.html";

if (!fs.existsSync(sourcePage)) throw new Error(`Source template tidak ditemukan: ${sourcePage}`);
if (!fs.existsSync(targetPage)) throw new Error(`Target Dedicated Screens tidak ditemukan: ${targetPage}`);

const source = fs.readFileSync(sourcePage, "utf8");
const target = fs.readFileSync(targetPage, "utf8");

const styleHrefMatch = source.match(/<link\s+rel="stylesheet"\s+href="([^"]*tv-admin\.css)"/i);
if (!styleHrefMatch) throw new Error("tv-admin.css reference tidak ditemukan pada template source.");

const scriptMatch = target.match(/<script\s+type="module"\s+src="tv-dedicated-screens\.js"><\/script>/i);
if (!scriptMatch) throw new Error("Dedicated Screens script anchor tidak ditemukan.");

const contentStart = target.indexOf('<section class="info-card">');
const contentEnd = target.indexOf('<dialog id="editorDialog"');
if (contentStart < 0 || contentEnd < 0 || contentEnd <= contentStart) {
  throw new Error("Dedicated Screens content/editor anchors tidak ditemukan.");
}

const dedicatedContent = target.slice(contentStart, contentEnd).trim();
const dialogStart = target.indexOf('<dialog id="editorDialog"');
const scriptStart = target.indexOf('<script type="module" src="tv-dedicated-screens.js"></script>');
if (dialogStart < 0 || scriptStart < 0) throw new Error("Dialog/script anchors tidak ditemukan.");
const dedicatedDialog = target.slice(dialogStart, scriptStart).trim();

const menuMatch = source.match(/<aside class="sidebar">[\s\S]*?<\/aside>/i);
if (!menuMatch) throw new Error("Sidebar template existing tidak ditemukan.");

let sidebar = menuMatch[0];
sidebar = sidebar.replace(/class="menu-link active" href="tv-running-text\.html"/i, 'class="menu-link" href="tv-running-text.html"');
sidebar = sidebar.replace(
  /<a class="menu-link" href="tv-dedicated-screens\.html">Dedicated Screens<\/a>/i,
  '<a class="menu-link active" href="tv-dedicated-screens.html">Dedicated Screens</a>'
);
if (!sidebar.includes('href="tv-dedicated-screens.html"')) {
  sidebar = sidebar.replace(
    /<button type="button" class="menu-link disabled" disabled>Dedicated Screens <small>Phase 4D<\/small><\/button>/i,
    '<a class="menu-link active" href="tv-dedicated-screens.html">Dedicated Screens</a>'
  );
}
if (!sidebar.includes('class="menu-link active" href="tv-dedicated-screens.html"')) {
  throw new Error("Dedicated Screens active menu tidak berhasil dibangun.");
}

const rebuilt = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Dedicated Screens — MJHK TV CMS</title>
  <link rel="stylesheet" href="tv-admin.css">
  <link rel="stylesheet" href="tv-dedicated-screens.css">
</head>
<body>
  <div class="admin-shell">
${sidebar}
    <main class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">MJHK TV CMS · PHASE 4D-A2</p>
          <h1>Dedicated Screens</h1>
          <p id="sessionLabel" class="muted">Memuat sesi admin...</p>
        </div>
        <div class="top-actions">
          <button type="button" class="btn light" id="refreshBtn">Refresh</button>
        </div>
      </header>

      <div class="dedicated-page">
${dedicatedContent}
      </div>

${dedicatedDialog}
    </main>
  </div>

  <script type="module" src="tv-dedicated-screens.js"></script>
</body>
</html>
`;

fs.writeFileSync(targetPage, rebuilt, "utf8");
console.log("[PASS] Dedicated Screens aligned ke existing TV CMS shell.");
console.log("[PASS] Dedicated Screens active menu terpasang.");
console.log("[PASS] Existing CRUD/dialog/script dipertahankan.");
