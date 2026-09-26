import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "worker-tv-mjhk/src/index.js");

if (!fs.existsSync(FILE)) {
  console.error("[FAIL] worker-tv-mjhk/src/index.js tidak ditemukan");
  process.exit(1);
}

const backup = FILE + ".before-phase4eb-cors-multidevice";
if (!fs.existsSync(backup)) {
  fs.copyFileSync(FILE, backup);
  console.log("[BACKUP] worker-tv-mjhk/src/index.js.before-phase4eb-cors-multidevice");
}

let src = fs.readFileSync(FILE, "utf8");

const requiredOrigins = [
  "http://127.0.0.1:5501",
  "http://127.0.0.1:5502",
  "http://127.0.0.1:5503",
  "http://localhost:5501",
  "http://localhost:5502",
  "http://localhost:5503",
  "https://www.mj-harapankita.or.id",
  "https://mj-harapankita.or.id",
];

const marker = "const CORS_ALLOWED_ORIGINS = new Set([";
const start = src.indexOf(marker);

if (start === -1) {
  console.error("[FAIL] CORS_ALLOWED_ORIGINS Set tidak ditemukan");
  process.exit(1);
}

const bodyStart = start + marker.length;
const end = src.indexOf("]);", bodyStart);

if (end === -1) {
  console.error("[FAIL] Penutup CORS_ALLOWED_ORIGINS tidak ditemukan");
  process.exit(1);
}

const before = src.slice(0, bodyStart);
const currentBody = src.slice(bodyStart, end);
const after = src.slice(end);

const existing = new Set(
  [...currentBody.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
);

for (const origin of requiredOrigins) {
  existing.add(origin);
}

const finalOrigins = [
  ...requiredOrigins,
  ...[...existing].filter((x) => !requiredOrigins.includes(x)),
];

const newBody =
  "\n" +
  finalOrigins.map((origin) => `  "${origin}",`).join("\n") +
  "\n";

src = before + newBody + after;

fs.writeFileSync(FILE, src, "utf8");

console.log("[PASS] CORS allowlist diperbarui.");
for (const origin of requiredOrigins) {
  console.log(`[ALLOW] ${origin}`);
}
console.log("[BOUNDARY] Tidak mengubah CORS methods.");
console.log("[BOUNDARY] Tidak mengubah CORS headers.");
console.log("[BOUNDARY] Tidak mengubah preflight logic.");
console.log("[BOUNDARY] Tidak menggunakan wildcard origin.");
