#!/usr/bin/env node
import fs from "node:fs";

const PLAYER = "tv-player/assets/js/player.js";

if (!fs.existsSync(PLAYER)) {
  throw new Error(`Missing ${PLAYER}`);
}

let player = fs.readFileSync(PLAYER, "utf8");

const startupImport =
  'import { startRevisionStartupSync } from "./revision-sync-startup.js";';

if (!player.includes(startupImport)) {
  const bridgeImport =
    'import { createPresentationPlayerBridge } from "./presentation-player-bridge.js";';

  if (!player.includes(bridgeImport)) {
    throw new Error(
      "Phase 3B.2D-C2 bridge import tidak ditemukan. Pastikan C2 sudah diterapkan."
    );
  }

  player = player.replace(
    bridgeImport,
    `${bridgeImport}\n${startupImport}`
  );
}

const oldInit =
  "void presentationBridge.initialize();";

const newInit =
  "void startRevisionStartupSync({ presentationBridge });";

if (!player.includes(newInit)) {
  const count =
    player.split(oldInit).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected exactly one "${oldInit}" anchor, found ${count}.`
    );
  }

  player = player.replace(
    oldInit,
    newInit
  );
}

fs.writeFileSync(
  PLAYER,
  player,
  "utf8"
);

console.log("[PASS] Phase 3B.2E-C startup sync applied");
console.log("[INFO] No .bak file created; Git history is the rollback source.");
