#!/usr/bin/env bash
set -euo pipefail

INDEX="tv-player/index.html"
CSS="tv-player/assets/css/full-bleed-polish.css"
MARKER='assets/css/full-bleed-polish.css'

echo "=== APPLY MJHK TV PHASE 3A.1 FULL-BLEED POLISH ==="

if [[ ! -f "$INDEX" ]]; then
  echo "[FAIL] $INDEX tidak ditemukan"
  exit 1
fi

if [[ ! -f "$CSS" ]]; then
  echo "[FAIL] $CSS tidak ditemukan"
  exit 1
fi

if grep -Fq "$MARKER" "$INDEX"; then
  echo "[PASS] full-bleed stylesheet sudah direferensikan"
  exit 0
fi

node - "$INDEX" <<'NODE'
const fs = require("fs");
const path = process.argv[2];
let text = fs.readFileSync(path, "utf8");

const needle = '<link rel="stylesheet" href="assets/css/player.css">';
const insert = needle + '\n  <link rel="stylesheet" href="assets/css/full-bleed-polish.css">';

if (!text.includes(needle)) {
  console.error("[FAIL] player.css link tidak ditemukan di index.html");
  process.exit(1);
}

text = text.replace(needle, insert);
fs.writeFileSync(path, text, "utf8");
console.log("[PASS] full-bleed stylesheet diinjeksi setelah player.css");
NODE

echo "RESULT: APPLIED"
