#!/usr/bin/env node

import {
  prepareCandidatePresentation,
} from "../tv-player/assets/js/revision-sync-startup-dependencies.js";

const REV =
  "63b55497-f01e-4809-a7be-828a8bf0c9aa";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  console.log(
    `[${condition ? "PASS" : "FAIL"}] ${name}`
  );
  condition ? pass++ : fail++;
}

const candidate = {
  schema_version: 1,
  kind: "candidate",
  revision_id: REV,
  revision_number: 5,
  status: "draft",
  config_available: true,
  snapshot: {
    playlist_items: [
      {
        id: "text-1",
        type: "text",
        title: "Text",
        duration_seconds: 15,
        fullscreen: false,
        always_show: true,
        starts_at: null,
        ends_at: null,
        payload: {
          heading: "Heading",
          body: "Body",
        },
      },
    ],
    running_text: [
      {
        id: "run-1",
        text: "Running",
        enabled: true,
        priority: 10,
        starts_at: null,
        ends_at: null,
        state_scope: ["NORMAL"],
      },
    ],
  },
};

const prepared =
  prepareCandidatePresentation(candidate);

ok(
  "candidate runtime keeps revision id",
  prepared.revision_id === REV
);

ok(
  "candidate runtime source is preflight",
  prepared.runtime.source ===
    "candidate-preflight"
);

ok(
  "typed presentation created",
  prepared.presentation.playlist_items.length === 1 &&
  prepared.presentation.running_text.length === 1
);

ok(
  "candidate runtime immutable",
  Object.isFrozen(prepared.runtime) &&
  Object.isFrozen(prepared.runtime.config)
);

ok(
  "typed presentation immutable",
  Object.isFrozen(prepared.presentation)
);

let wrongKindRejected = false;

try {
  prepareCandidatePresentation({
    ...candidate,
    kind: "lkg",
  });
} catch (error) {
  wrongKindRejected =
    error?.code ===
    "candidate_record_invalid";
}

ok(
  "non-candidate record rejected",
  wrongKindRejected
);

console.log();
console.log("=== SUMMARY ===");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(
  `RESULT: ${fail ? "FAIL" : "CLEAN"}`
);

process.exit(fail ? 1 : 0);
