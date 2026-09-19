#!/usr/bin/env node
import fs from "node:fs";

const FILE =
  "tv-player/assets/js/runtime-operations-supervisor.js";
const PAYLOAD =
  "scripts/patch-payloads/phase3ce-transport-supervisor.js";

for (const file of [FILE, PAYLOAD]) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}`
    );
  }
}

fs.writeFileSync(
  FILE,
  fs.readFileSync(PAYLOAD, "utf8"),
  "utf8"
);

console.log(
  "[PASS] Phase 3C-E transport-driven recovery hotfix applied"
);
console.log(
  "[INFO] Heartbeat success/failure is now the authoritative reachability probe."
);
