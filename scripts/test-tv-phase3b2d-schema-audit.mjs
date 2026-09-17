#!/usr/bin/env node

import {
  inspectSnapshotShape,
  summarizeTypedContract,
} from "../tv-player/assets/js/snapshot-shape-inspector.js";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    pass += 1;
  } else {
    console.log(`[FAIL] ${name}`);
    fail += 1;
  }
}

const sample = {
  schema_version: 1,
  generated_at: "hidden",
  playlist_items: [
    {
      id: "hidden",
      type: "hidden",
      duration_seconds: 15,
      fullscreen: false,
      payload: {
        url: "hidden",
      },
    },
    {
      id: "hidden-2",
      type: "hidden-2",
      duration_seconds: 10,
      fullscreen: true,
      payload: {
        url: "hidden-2",
      },
    },
  ],
  running_text: {
    enabled: true,
    text: "hidden",
    speed: 1,
  },
};

const inspected = inspectSnapshotShape(sample);
ok("snapshot root valid", inspected.ok === true);

const summary = summarizeTypedContract(sample);
ok("playlist detected as array", summary.playlist_items.type === "array");
ok("playlist length detected", summary.playlist_items.length === 2);
ok("running_text detected", summary.running_text.present === true);

const output = JSON.stringify(summary);
ok("actual string values not exposed", !output.includes("hidden"));
ok("field names retained", output.includes("duration_seconds"));
ok("field types retained", output.includes("boolean"));

console.log();
console.log("=== SUMMARY ===");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);

if (fail === 0) {
  console.log("RESULT: CLEAN");
  process.exit(0);
}

console.log("RESULT: FAIL");
process.exit(1);
