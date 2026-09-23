import fs from "node:fs";

const files = [
  "admin/tv.html",
  "admin/tv-content.html",
  "admin/tv-running-text.html",
];

const oldButton =
  '<button type="button" class="menu-link disabled" disabled>Dedicated Screens <small>Phase 4D</small></button>';

const newLink =
  '<a class="menu-link" href="tv-dedicated-screens.html">Dedicated Screens</a>';

for (const file of files) {
  if (!fs.existsSync(file)) {
    throw new Error(`File tidak ditemukan: ${file}`);
  }

  let src = fs.readFileSync(file, "utf8");

  if (src.includes(newLink)) {
    console.log(`[PASS] ${file} sudah memiliki Dedicated Screens link.`);
    continue;
  }

  if (!src.includes(oldButton)) {
    throw new Error(
      `Anchor Dedicated Screens expected tidak ditemukan di ${file}. ` +
      `Tidak ada perubahan dilakukan pada file ini.`
    );
  }

  src = src.replace(oldButton, newLink);
  fs.writeFileSync(file, src, "utf8");
  console.log(`[PASS] Dedicated Screens diaktifkan di ${file}.`);
}
