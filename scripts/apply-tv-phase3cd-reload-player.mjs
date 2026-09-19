#!/usr/bin/env node
import fs from "node:fs";

const CORE =
  "tv-player/assets/js/runtime-command-dispatcher-core.js";
const ADAPTER =
  "tv-player/assets/js/runtime-command-dispatcher.js";

for (const file of [CORE, ADAPTER]) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. Phase 3C-D sync_now harus sudah terpasang.`
    );
  }
}

const coreSource =
  fs.readFileSync(
    "scripts/patch-payloads/phase3cd-reload-core.js",
    "utf8"
  );

const adapterSource =
  fs.readFileSync(
    "scripts/patch-payloads/phase3cd-reload-adapter.js",
    "utf8"
  );

fs.writeFileSync(
  CORE,
  coreSource,
  "utf8"
);

fs.writeFileSync(
  ADAPTER,
  adapterSource,
  "utf8"
);

console.log(
  "[PASS] Phase 3C-D reload_player dispatcher extension applied"
);
console.log(
  "[INFO] ACK resolves before reload scheduling executes."
);
