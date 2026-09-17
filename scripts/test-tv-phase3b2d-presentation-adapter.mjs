#!/usr/bin/env node

import {
  adaptPresentationConfig,
  safePresentationMeta,
  PresentationAdapterError,
} from "../tv-player/assets/js/presentation-adapter.js";

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

const runtime = {
  revision_id: "53b55497-f01e-4809-a7be-828a8bf0c9a9",
  revision_number: 4,
  config: {
    playlist_items: [
      {
        id: "img-1",
        type: "image",
        title: "Image",
        duration_seconds: 15,
        fullscreen: false,
        always_show: true,
        starts_at: null,
        ends_at: null,
        payload: {
          image_url: "https://example.invalid/a.jpg",
          alt_text: "Alt",
        },
      },
      {
        id: "text-1",
        type: "text",
        title: "Text",
        duration_seconds: 12,
        fullscreen: false,
        always_show: true,
        starts_at: null,
        ends_at: null,
        payload: {
          heading: "Heading",
          body: "Body",
        },
      },
      {
        id: "mix-1",
        type: "image_text",
        title: "Mix",
        duration_seconds: 20,
        fullscreen: true,
        always_show: false,
        starts_at: "2026-09-17T00:00:00Z",
        ends_at: "2026-09-18T00:00:00Z",
        payload: {
          image_url: "https://example.invalid/b.jpg",
          heading: "Heading",
          body: "Body",
        },
      },
    ],
    running_text: [
      {
        id: "run-1",
        text: "Hello",
        enabled: true,
        priority: 10,
        starts_at: null,
        ends_at: null,
        state_scope: ["NORMAL"],
      },
      {
        id: "run-2",
        text: "Hello 2",
        enabled: true,
        priority: 20,
        starts_at: "2026-09-17T00:00:00Z",
        ends_at: "2026-09-18T00:00:00Z",
        state_scope: ["NORMAL", "PRE_ADHAN"],
      },
    ],
  },
};

const adapted = adaptPresentationConfig(runtime);
const meta = safePresentationMeta(adapted);

ok("3 playlist items diterima", meta.playlist_count === 3);
ok("2 running-text items diterima", meta.running_text_count === 2);
ok("image/text/image_text typed", meta.playlist_type_counts.image === 1 &&
  meta.playlist_type_counts.text === 1 &&
  meta.playlist_type_counts.image_text === 1);
ok("state scopes typed", meta.running_text_state_scopes.includes("NORMAL") &&
  meta.running_text_state_scopes.includes("PRE_ADHAN"));
ok("presentation config frozen", Object.isFrozen(adapted));
ok("nested playlist item frozen", Object.isFrozen(adapted.playlist_items[0]));

let unknownTypeRejected = false;
try {
  adaptPresentationConfig({
    revision_id: runtime.revision_id,
    revision_number: 5,
    config: {
      playlist_items: [{
        id: "bad",
        type: "video",
        title: "bad",
        duration_seconds: 10,
        fullscreen: false,
        always_show: true,
        starts_at: null,
        ends_at: null,
        payload: {},
      }],
      running_text: [],
    },
  });
} catch (error) {
  unknownTypeRejected = error instanceof PresentationAdapterError &&
    error.code === "playlist_type_unsupported";
}
ok("unknown playlist type ditolak", unknownTypeRejected);

let badStateRejected = false;
try {
  adaptPresentationConfig({
    revision_id: runtime.revision_id,
    revision_number: 5,
    config: {
      playlist_items: [],
      running_text: [{
        id: "bad-state",
        text: "x",
        enabled: true,
        priority: 1,
        starts_at: null,
        ends_at: null,
        state_scope: ["UNKNOWN_STATE"],
      }],
    },
  });
} catch (error) {
  badStateRejected = error instanceof PresentationAdapterError &&
    error.code === "state_scope_unsupported";
}
ok("unknown state scope ditolak", badStateRejected);

let httpRejected = false;
try {
  adaptPresentationConfig({
    revision_id: runtime.revision_id,
    revision_number: 5,
    config: {
      playlist_items: [{
        id: "bad-url",
        type: "image",
        title: "bad",
        duration_seconds: 10,
        fullscreen: false,
        always_show: true,
        starts_at: null,
        ends_at: null,
        payload: {
          image_url: "http://example.com/x.jpg",
          alt_text: "x",
        },
      }],
      running_text: [],
    },
  });
} catch (error) {
  httpRejected = error instanceof PresentationAdapterError &&
    error.code === "url_https_required";
}
ok("non-HTTPS media URL ditolak", httpRejected);

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
