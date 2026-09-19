#!/usr/bin/env node
import fs from "node:fs";

const PLAYER =
  "tv-player/assets/js/player.js";

if (!fs.existsSync(PLAYER)) {
  throw new Error(
    `Missing ${PLAYER}`
  );
}

let player =
  fs.readFileSync(
    PLAYER,
    "utf8"
  );

const supervisorImport =
  'import { createRuntimeOperationsSupervisor } from "./runtime-operations-supervisor.js";';

const coordinatorImport =
  'import { attachRuntimeCommandCoordinator } from "./runtime-command-coordinator.js";';

if (!player.includes(coordinatorImport)) {
  throw new Error(
    "Phase 3C-D coordinator import tidak ditemukan."
  );
}

if (!player.includes(supervisorImport)) {
  player = player.replace(
    coordinatorImport,
    `${coordinatorImport}\n${supervisorImport}`
  );
}

const coordinatorBlock = [
  'const runtimeCommandCoordinator =',
  '  attachRuntimeCommandCoordinator({',
  '    poller: runtimeCommandPoller,',
  '    dispatcher: runtimeCommandDispatcher,',
  '  });',
].join("\n");

if (!player.includes(coordinatorBlock)) {
  throw new Error(
    "Phase 3C-D coordinator block tidak ditemukan."
  );
}

const supervisorBlock = [
  '',
  'const runtimeOperationsSupervisor =',
  '  createRuntimeOperationsSupervisor({',
  '    heartbeat: runtimeHeartbeat,',
  '    commandPoller: runtimeCommandPoller,',
  '    commandCoordinator: runtimeCommandCoordinator,',
  '  });',
].join("\n");

if (!player.includes(
  "const runtimeOperationsSupervisor ="
)) {
  player = player.replace(
    coordinatorBlock,
    coordinatorBlock +
      supervisorBlock
  );
}

const oldStartup = [
  'void revisionStartupPromise.finally(() => {',
  '  runtimeHeartbeat.start({ immediate: true });',
  '  runtimeCommandPoller.start({ immediate: true });',
  '});',
].join("\n");

const newStartup = [
  'void revisionStartupPromise.finally(() => {',
  '  runtimeOperationsSupervisor.start();',
  '});',
].join("\n");

if (!player.includes(newStartup)) {
  const count =
    player.split(oldStartup).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected one direct runtime startup block, found ${count}.`
    );
  }

  player = player.replace(
    oldStartup,
    newStartup
  );
}

const oldPagehide = [
  'window.addEventListener("pagehide", () => {',
  '  runtimeHeartbeat.stop();',
  '  runtimeCommandPoller.stop();',
  '  runtimeCommandCoordinator.stop();',
  '});',
].join("\n");

const newPagehide = [
  'window.addEventListener("pagehide", () => {',
  '  runtimeOperationsSupervisor.stop();',
  '  runtimeCommandCoordinator.stop();',
  '});',
].join("\n");

if (!player.includes(newPagehide)) {
  const count =
    player.split(oldPagehide).length - 1;

  if (count !== 1) {
    throw new Error(
      `Expected one Phase 3C-D pagehide block, found ${count}.`
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
  "[PASS] Phase 3C-E runtime recovery supervisor wiring applied"
);
