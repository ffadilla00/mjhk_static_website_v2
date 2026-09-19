#!/usr/bin/env node
import fs from "node:fs";

const STARTUP =
  "tv-player/assets/js/revision-sync-startup.js";
const PLAYER =
  "tv-player/assets/js/player.js";

for (const file of [STARTUP, PLAYER]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
}

let startup =
  fs.readFileSync(STARTUP, "utf8");

if (!startup.includes("let startupPromise")) {
  throw new Error(
    "Expected mutable startupPromise in revision-sync-startup.js"
  );
}

const publishAnchor =
  "publishSafeSyncStatus(result, ackResult);";

const returnBundle = [
  publishAnchor,
  "",
  "  return Object.freeze({",
  "    result,",
  "    ack_result: ackResult,",
  "  });",
].join("\n");

if (!startup.includes("ack_result: ackResult")) {
  const count =
    startup.split(publishAnchor).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected one publishSafeSyncStatus anchor, found ${count}.`
    );
  }

  startup = startup.replace(
    publishAnchor,
    returnBundle
  );
}

const manualExportMarker =
  "export function runRevisionSyncNow";

if (!startup.includes(manualExportMarker)) {
  startup += `

let runtimeCommandSyncPromise = null;

export function runRevisionSyncNow({
  presentationBridge,
} = {}) {
  if (runtimeCommandSyncPromise) {
    return runtimeCommandSyncPromise;
  }

  // Startup sync has already settled before command polling begins.
  // Reset only the startup memoization so sync_now can execute the exact
  // same locked pipeline again.
  startupPromise = null;

  runtimeCommandSyncPromise =
    startRevisionStartupSync({
      presentationBridge,
    }).finally(() => {
      runtimeCommandSyncPromise = null;
    });

  return runtimeCommandSyncPromise;
}
`;
}

fs.writeFileSync(
  STARTUP,
  startup,
  "utf8"
);

let player =
  fs.readFileSync(PLAYER, "utf8");

const dispatcherImport =
  'import { createRuntimeCommandDispatcher } from "./runtime-command-dispatcher.js";';
const coordinatorImport =
  'import { attachRuntimeCommandCoordinator } from "./runtime-command-coordinator.js";';

const commandPollerImport =
  'import { createRuntimeCommandPoller } from "./runtime-command-poller.js";';

if (!player.includes(commandPollerImport)) {
  throw new Error(
    "Phase 3C-C command poller import tidak ditemukan."
  );
}

if (!player.includes(dispatcherImport)) {
  player = player.replace(
    commandPollerImport,
    [
      commandPollerImport,
      dispatcherImport,
      coordinatorImport,
    ].join("\n")
  );
}

const pollerBlock = [
  'const runtimeCommandPoller =',
  '  createRuntimeCommandPoller();',
].join("\n");

if (!player.includes(pollerBlock)) {
  throw new Error(
    "Phase 3C-C poller block tidak ditemukan."
  );
}

const dispatcherBlock = [
  '',
  'const runtimeCommandDispatcher =',
  '  createRuntimeCommandDispatcher({',
  '    presentationBridge,',
  '  });',
  '',
  'const runtimeCommandCoordinator =',
  '  attachRuntimeCommandCoordinator({',
  '    poller: runtimeCommandPoller,',
  '    dispatcher: runtimeCommandDispatcher,',
  '  });',
].join("\n");

if (!player.includes(
  "const runtimeCommandDispatcher ="
)) {
  player = player.replace(
    pollerBlock,
    pollerBlock + dispatcherBlock
  );
}

const pagehideNeedle =
  "  runtimeCommandPoller.stop();";

const pagehideReplacement = [
  pagehideNeedle,
  "  runtimeCommandCoordinator.stop();",
].join("\n");

if (!player.includes(
  "runtimeCommandCoordinator.stop();"
)) {
  const count =
    player.split(pagehideNeedle).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected one poller pagehide hook, found ${count}.`
    );
  }

  player = player.replace(
    pagehideNeedle,
    pagehideReplacement
  );
}

fs.writeFileSync(
  PLAYER,
  player,
  "utf8"
);

console.log(
  "[PASS] Phase 3C-D sync_now dispatcher + command ACK wiring applied"
);
console.log(
  "[INFO] sync_now reuses the existing locked revision startup pipeline."
);
