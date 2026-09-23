import fs from "node:fs";

const file = "admin/tv-content.js";
if (!fs.existsSync(file)) {
  throw new Error(`File tidak ditemukan: ${file}`);
}

let src = fs.readFileSync(file, "utf8");

const REQUIRED = [
  'async function loadContents()',
  '.from("tv_content")',
  '.in("content_type", CONTENT_TYPES)',
  'async function confirmDelete()',
];

for (const anchor of REQUIRED) {
  if (!src.includes(anchor)) {
    throw new Error(`Preflight gagal: anchor ${anchor} tidak ditemukan.`);
  }
}

if (src.includes("PHASE4D-A2 SLIDESHOW BOUNDARY HOTFIX")) {
  console.log("[INFO] Hotfix sudah terpasang. Tidak ada perubahan.");
  process.exit(0);
}

// 1) Read boundary: Slideshow owns legacy NULL + explicit manual rows only.
const loadNeedle = `.in("content_type", CONTENT_TYPES)
        .order("updated_at", {`;

if (!src.includes(loadNeedle)) {
  throw new Error("Anchor query loadContents tidak ditemukan.");
}

src = src.replace(
  loadNeedle,
  `.in("content_type", CONTENT_TYPES)
        .or("source_type.is.null,source_type.eq.manual")
        .order("updated_at", {`
);

// 2) Defense in depth after fetch, so a future query regression still won't render
// dedicated screen rows.
const hydrateNeedle = `state.contents =
      await hydratePrivatePreviews(data ?? []);`;

if (!src.includes(hydrateNeedle)) {
  throw new Error("Anchor state.contents hydration tidak ditemukan.");
}

src = src.replace(
  hydrateNeedle,
  `const slideshowRows = (data ?? []).filter(
      (row) => row.source_type == null || row.source_type === "manual"
    );

    state.contents =
      await hydratePrivatePreviews(slideshowRows);`
);

// 3) Update boundary. Scope mutation to slideshow-owned rows only.
const updateNeedle = `.eq(
            "id",
            state.editing.id
          )
          .select(`;

if (!src.includes(updateNeedle)) {
  throw new Error("Anchor update tv_content tidak ditemukan.");
}

src = src.replace(
  updateNeedle,
  `.eq(
            "id",
            state.editing.id
          )
          .or("source_type.is.null,source_type.eq.manual")
          .select(`
);

// 4) Delete boundary. Scope deletion to slideshow-owned rows only.
const deleteNeedle = `.eq(
          "id",
          state.deleting.id
        );`;

if (!src.includes(deleteNeedle)) {
  throw new Error("Anchor delete tv_content tidak ditemukan.");
}

src = src.replace(
  deleteNeedle,
  `.eq(
          "id",
          state.deleting.id
        )
        .or("source_type.is.null,source_type.eq.manual");`
);

// 5) Marker + ownership contract near top.
const marker = `
// PHASE4D-A2 SLIDESHOW BOUNDARY HOTFIX
// Slideshow CMS owns only legacy source_type=NULL and source_type=manual.
// dedicated_screen is managed exclusively by Dedicated Screens CMS.
const SLIDESHOW_SOURCE_TYPES = Object.freeze([null, "manual"]);
`;

const insertAt = src.indexOf("\n", src.indexOf('"use strict"'));
if (src.startsWith('"use strict"') && insertAt !== -1) {
  src = src.slice(0, insertAt + 1) + marker + src.slice(insertAt + 1);
} else {
  src = marker + "\n" + src;
}

fs.writeFileSync(file, src, "utf8");

console.log("[PASS] Slideshow read boundary terpasang.");
console.log("[PASS] Dedicated Screen rows difilter sebelum hydrate/render.");
console.log("[PASS] Slideshow update/delete dibatasi ke NULL/manual.");
console.log("[PASS] Tidak ada schema/revision mutation.");
