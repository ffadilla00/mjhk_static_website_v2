#!/usr/bin/env node
import fs from "node:fs";

const PLAYER = "tv-player/assets/js/player.js";

if (!fs.existsSync(PLAYER)) {
  throw new Error(`Missing ${PLAYER}`);
}

let player =
  fs.readFileSync(PLAYER, "utf8");

const commandImport =
  'import { createRuntimeCommandPoller } from "./runtime-command-poller.js";';

if (!player.includes(commandImport)) {
  const heartbeatImport =
    'import { createRuntimeHeartbeat } from "./runtime-heartbeat.js";';

  if (!player.includes(heartbeatImport)) {
    throw new Error(
      "Phase 3C-B heartbeat import tidak ditemukan."
    );
  }

  player = player.replace(
    heartbeatImport,
    `${heartbeatImport}\n${commandImport}`
  );
}

const heartbeatBlock = [
  'const runtimeHeartbeat =',
  '  createRuntimeHeartbeat({ presentationBridge });',
].join("\n");

if (!player.includes(heartbeatBlock)) {
  throw new Error(
    "Phase 3C-B heartbeat block tidak ditemukan."
  );
}

const commandBlock = [
  '',
  'const runtimeCommandPoller =',
  '  createRuntimeCommandPoller();',
].join("\n");

if (!player.includes("const runtimeCommandPoller =")) {
  player = player.replace(
    heartbeatBlock,
    heartbeatBlock + commandBlock
  );
}

const oldFinally = [
  'void revisionStartupPromise.finally(() => {',
  '  runtimeHeartbeat.start({ immediate: true });',
  '});',
].join("\n");

const newFinally = [
  'void revisionStartupPromise.finally(() => {',
  '  runtimeHeartbeat.start({ immediate: true });',
  '  runtimeCommandPoller.start({ immediate: true });',
  '});',
].join("\n");

if (!player.includes(newFinally)) {
  const count =
    player.split(oldFinally).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected exactly one Phase 3C-B startup hook, found ${count}.`
    );
  }

  player = player.replace(
    oldFinally,
    newFinally
  );
}

const oldPagehide = [
  'window.addEventListener("pagehide", () => {',
  '  runtimeHeartbeat.stop();',
  '});',
].join("\n");

const newPagehide = [
  'window.addEventListener("pagehide", () => {',
  '  runtimeHeartbeat.stop();',
  '  runtimeCommandPoller.stop();',
  '});',
].join("\n");

if (!player.includes(newPagehide)) {
  const count =
    player.split(oldPagehide).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected exactly one heartbeat pagehide hook, found ${count}.`
    );
  }

  player = player.replace(
    oldPagehide,
    newPagehide
  );
}

fs.writeFileSync(
  PLAYER,
  player,
  "utf8"
);

console.log(
  "[PASS] Phase 3C-C command polling wiring applied"
);
console.log(
  "[INFO] No command execution or ACK is wired in this phase."
);
