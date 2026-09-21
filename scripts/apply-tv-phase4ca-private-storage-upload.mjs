#!/usr/bin/env node
import fs from "node:fs";

const TARGET =
  "admin/tv-content.js";
const PAYLOAD =
  "scripts/patch-payloads/phase4ca-private-storage-upload.js";

for (const file of [TARGET, PAYLOAD]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
}

fs.writeFileSync(
  TARGET,
  fs.readFileSync(PAYLOAD, "utf8"),
  "utf8"
);

console.log(
  "[PASS] Private tv-content Storage upload wiring applied."
);
console.log(
  "[INFO] CMS uses authenticated admin RLS; bucket remains private."
);
