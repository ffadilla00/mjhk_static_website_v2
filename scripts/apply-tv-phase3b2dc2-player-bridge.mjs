#!/usr/bin/env node
import fs from "node:fs";

const INDEX = "tv-player/index.html";
const PLAYER = "tv-player/assets/js/player.js";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function backup(path, content) {
  const bak = `${path}.phase3b2dc2.bak`;
  if (!fs.existsSync(bak)) {
    fs.writeFileSync(bak, content, "utf8");
  }
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

let index = read(INDEX);
let player = read(PLAYER);

backup(INDEX, index);
backup(PLAYER, player);

const cssTag =
  '  <link rel="stylesheet" href="assets/css/presentation-player-bridge.css">';

if (!index.includes("presentation-player-bridge.css")) {
  if (!index.includes("</head>")) {
    throw new Error("index.html missing </head> anchor");
  }
  index = index.replace("</head>", `${cssTag}\n</head>`);
}

const importLine =
  'import { createPresentationPlayerBridge } from "./presentation-player-bridge.js";';

if (!player.includes(importLine)) {
  const refsAnchor = "const refs = {";
  if (count(player, refsAnchor) !== 1) {
    throw new Error(`Expected exactly one "${refsAnchor}" anchor`);
  }
  player = player.replace(
    refsAnchor,
    `${importLine}\n\n${refsAnchor}`
  );
}

const engineAnchor = "const engine = new TVStateEngine();";
const bridgeInit = [
  engineAnchor,
  "",
  "const presentationBridge = createPresentationPlayerBridge();",
  "void presentationBridge.initialize();",
].join("\n");

if (!player.includes("const presentationBridge = createPresentationPlayerBridge();")) {
  if (count(player, engineAnchor) !== 1) {
    throw new Error(`Expected exactly one "${engineAnchor}" anchor`);
  }
  player = player.replace(engineAnchor, bridgeInit);
}

const renderAnchor = "renderState(event.detail, refs);";
const stateForward =
  "presentationBridge.setPresentationState(event.detail.state);";

if (!player.includes(stateForward)) {
  if (count(player, renderAnchor) !== 1) {
    throw new Error(`Expected exactly one "${renderAnchor}" anchor`);
  }
  player = player.replace(
    renderAnchor,
    `${renderAnchor}\n  ${stateForward}`
  );
}

fs.writeFileSync(INDEX, index, "utf8");
fs.writeFileSync(PLAYER, player, "utf8");

console.log("[PASS] Phase 3B.2D-C2 bridge applied");
console.log("[INFO] Backups use *.phase3b2dc2.bak");
