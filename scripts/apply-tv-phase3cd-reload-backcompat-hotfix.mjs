#!/usr/bin/env node
import fs from "node:fs";

const FILE =
  "tv-player/assets/js/runtime-command-dispatcher-core.js";

if (!fs.existsSync(FILE)) {
  throw new Error(`Missing ${FILE}`);
}

let source =
  fs.readFileSync(FILE, "utf8");

const oldBlock = `    if (typeof prepareReloadPlayer !== "function") {
      throw new Error("command_dispatcher_reload_player_required");
    }

    if (typeof ackCommand !== "function") {`;

const newBlock = `    if (typeof ackCommand !== "function") {`;

if (source.includes(oldBlock)) {
  source = source.replace(
    oldBlock,
    newBlock
  );
}

const oldAssign =
  `    this.#prepareReloadPlayer = prepareReloadPlayer;`;

const newAssign = `    this.#prepareReloadPlayer =
      typeof prepareReloadPlayer === "function"
        ? prepareReloadPlayer
        : async () => ({
            ok: false,
            reason:
              "reload_player_capability_unavailable",
          });`;

if (source.includes(oldAssign)) {
  source = source.replace(
    oldAssign,
    newAssign
  );
} else if (
  !source.includes(
    'reason:\n              "reload_player_capability_unavailable"'
  )
) {
  throw new Error(
    "prepareReloadPlayer assignment anchor tidak ditemukan."
  );
}

fs.writeFileSync(
  FILE,
  source,
  "utf8"
);

console.log(
  "[PASS] reload_player backward-compatibility hotfix applied"
);
console.log(
  "[INFO] sync_now-only callers no longer require reload dependency."
);
