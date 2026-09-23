import fs from "node:fs";

const cssFile = "admin/tv-dedicated-screens.css";

if (!fs.existsSync(cssFile)) {
  throw new Error(`File tidak ditemukan: ${cssFile}`);
}

let css = fs.readFileSync(cssFile, "utf8");

const markerStart = "/* PHASE4D-A2 DESKTOP SHELL HOTFIX START */";
const markerEnd = "/* PHASE4D-A2 DESKTOP SHELL HOTFIX END */";

if (css.includes(markerStart)) {
  console.log("[PASS] Desktop shell hotfix sudah terpasang.");
  process.exit(0);
}

const patch = `
${markerStart}

/*
  Existing tv-admin.css does not own the custom .admin-shell wrapper.
  Without this rule the wrapper collapses to the sidebar width (250px),
  causing main.content to flow below the sidebar.
*/
@media (min-width: 821px) {
  .admin-shell {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    width: 100%;
    min-height: 100vh;
    align-items: start;
  }

  .admin-shell > .sidebar {
    grid-column: 1;
    grid-row: 1;
    width: 250px;
    min-width: 250px;
    height: 100vh;
    position: sticky;
    top: 0;
  }

  .admin-shell > main.content {
    grid-column: 2;
    grid-row: 1;
    width: auto;
    min-width: 0;
    min-height: 100vh;
  }
}

${markerEnd}
`;

fs.writeFileSync(cssFile, `${css.trimEnd()}\n\n${patch.trim()}\n`, "utf8");
console.log("[PASS] Dedicated Screens desktop shell layout hotfix terpasang.");
