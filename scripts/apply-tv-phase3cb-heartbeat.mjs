#!/usr/bin/env node
import fs from "node:fs";

const PLAYER = "tv-player/assets/js/player.js";

if (!fs.existsSync(PLAYER)) {
  throw new Error(`Missing ${PLAYER}`);
}

let player =
  fs.readFileSync(PLAYER, "utf8");

const heartbeatImport =
  'import { createRuntimeHeartbeat } from "./runtime-heartbeat.js";';

if (!player.includes(heartbeatImport)) {
  const startupImport =
    'import { startRevisionStartupSync } from "./revision-sync-startup.js";';

  if (!player.includes(startupImport)) {
    throw new Error(
      "Phase 3B startup import tidak ditemukan."
    );
  }

  player = player.replace(
    startupImport,
    `${startupImport}\n${heartbeatImport}`
  );
}

const oldStart =
  'void startRevisionStartupSync({ presentationBridge });';

const newStart = [
  'const revisionStartupPromise =',
  '  startRevisionStartupSync({ presentationBridge });',
  '',
  'const runtimeHeartbeat =',
  '  createRuntimeHeartbeat({ presentationBridge });',
  '',
  'void revisionStartupPromise.finally(() => {',
  '  runtimeHeartbeat.start({ immediate: true });',
  '});',
  '',
  'window.addEventListener("pagehide", () => {',
  '  runtimeHeartbeat.stop();',
  '});',
].join("\n");

if (!player.includes(newStart)) {
  const count =
    player.split(oldStart).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected exactly one startup anchor, found ${count}.`
    );
  }

  player = player.replace(
    oldStart,
    newStart
  );
}

fs.writeFileSync(
  PLAYER,
  player,
  "utf8"
);

console.log(
  "[PASS] Phase 3C-B heartbeat wiring applied"
);
console.log(
  "[INFO] Heartbeat starts after Phase 3B startup sync settles."
);
