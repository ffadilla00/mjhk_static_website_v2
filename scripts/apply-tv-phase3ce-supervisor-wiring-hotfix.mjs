#!/usr/bin/env node
import fs from "node:fs";

const PLAYER =
  "tv-player/assets/js/player.js";
const SUPERVISOR =
  "tv-player/assets/js/runtime-operations-supervisor.js";
const PAYLOAD =
  "scripts/patch-payloads/phase3ce-transport-supervisor.js";

for (const file of [
  PLAYER,
  SUPERVISOR,
  PAYLOAD,
]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
}

// Always install the known-good v4 supervisor payload.
fs.writeFileSync(
  SUPERVISOR,
  fs.readFileSync(PAYLOAD, "utf8"),
  "utf8"
);

let player =
  fs.readFileSync(PLAYER, "utf8");

const supervisorImport =
  'import { createRuntimeOperationsSupervisor } from "./runtime-operations-supervisor.js";';

const coordinatorImport =
  'import { attachRuntimeCommandCoordinator } from "./runtime-command-coordinator.js";';

if (!player.includes(supervisorImport)) {
  if (!player.includes(coordinatorImport)) {
    throw new Error(
      "runtime-command-coordinator import tidak ditemukan."
    );
  }

  player = player.replace(
    coordinatorImport,
    `${coordinatorImport}\n${supervisorImport}`
  );
}

const supervisorBlock = [
  'const runtimeOperationsSupervisor =',
  '  createRuntimeOperationsSupervisor({',
  '    heartbeat: runtimeHeartbeat,',
  '    commandPoller: runtimeCommandPoller,',
  '    commandCoordinator: runtimeCommandCoordinator,',
  '  });',
].join("\n");

if (!player.includes(supervisorBlock)) {
  const coordinatorBlock = [
    'const runtimeCommandCoordinator =',
    '  attachRuntimeCommandCoordinator({',
    '    poller: runtimeCommandPoller,',
    '    dispatcher: runtimeCommandDispatcher,',
    '  });',
  ].join("\n");

  if (!player.includes(coordinatorBlock)) {
    throw new Error(
      "runtimeCommandCoordinator block tidak ditemukan."
    );
  }

  player = player.replace(
    coordinatorBlock,
    `${coordinatorBlock}\n\n${supervisorBlock}`
  );
}

// Normalize startup ownership regardless of whether current file is 3C-D,
// 3C-E v2, or partially patched.
const finallyPattern =
  /void revisionStartupPromise\.finally\(\(\) => \{[\s\S]*?\n\}\);/;

const matches =
  player.match(new RegExp(finallyPattern.source, "g")) ?? [];

if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one revisionStartupPromise.finally block, found ${matches.length}.`
  );
}

player = player.replace(
  finallyPattern,
  [
    'void revisionStartupPromise.finally(() => {',
    '  runtimeOperationsSupervisor.start();',
    '});',
  ].join("\n")
);

// Normalize pagehide cleanup ownership.
const pagehidePattern =
  /window\.addEventListener\("pagehide", \(\) => \{[\s\S]*?\n\}\);/;

const pagehideMatches =
  player.match(new RegExp(pagehidePattern.source, "g")) ?? [];

if (pagehideMatches.length !== 1) {
  throw new Error(
    `Expected exactly one pagehide block, found ${pagehideMatches.length}.`
  );
}

player = player.replace(
  pagehidePattern,
  [
    'window.addEventListener("pagehide", () => {',
    '  runtimeOperationsSupervisor.stop();',
    '  runtimeCommandCoordinator.stop();',
    '});',
  ].join("\n")
);

fs.writeFileSync(
  PLAYER,
  player,
  "utf8"
);

console.log(
  "[PASS] Phase 3C-E v4 supervisor wiring normalized"
);
console.log(
  "[INFO] player.js now delegates heartbeat + command polling ownership to runtimeOperationsSupervisor."
);
