#!/usr/bin/env node

import {
  RuntimeHeartbeat,
  sanitizeTelemetry,
} from "../tv-player/assets/js/runtime-heartbeat-core.js";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  console.log(
    `[${condition ? "PASS" : "FAIL"}] ${name}`
  );
  condition ? pass++ : fail++;
}

const REV =
  "53b55497-f01e-4809-a7be-828a8bf0c9a9";

{
  const telemetry =
    sanitizeTelemetry({
      app_version: "test",
      device_model: "Browser",
      screen_width: 1920,
      screen_height: 1080,
      current_state: "NORMAL",
      current_content_id: "demo-text-01",
      current_slide_index: 1,
      total_slides: 3,
      remaining_seconds: 12,
      is_muted: false,
      deviceToken: "must-not-pass",
      random_secret: "must-not-pass",
    });

  ok(
    "allowed telemetry preserved",
    telemetry.app_version === "test" &&
    telemetry.screen_width === 1920 &&
    telemetry.current_state === "NORMAL"
  );

  ok(
    "non-UUID content id omitted",
    !("current_content_id" in telemetry)
  );

  ok(
    "unknown keys omitted",
    !("deviceToken" in telemetry) &&
    !("random_secret" in telemetry)
  );

  ok(
    "telemetry immutable",
    Object.isFrozen(telemetry)
  );
}

{
  let calls = 0;
  let lastPath = null;
  let lastInit = null;

  const gatewayClient = {
    async request(path, init) {
      calls++;
      lastPath = path;
      lastInit = init;

      return {
        data: {
          server_time: "2026-09-19T00:00:00Z",
          desired_revision_id: REV,
          applied_revision_id: REV,
          pending_commands: 1,
        },
      };
    },
  };

  const sessionStore = {
    load() {
      return {
        deviceCode: "SIM",
        deviceToken: "x".repeat(64),
      };
    },
  };

  let release;
  const telemetryProvider = async () => {
    await new Promise((resolve) => {
      release = resolve;
    });

    return {
      current_state: "NORMAL",
      screen_width: 1920,
      screen_height: 1080,
    };
  };

  const heartbeat =
    new RuntimeHeartbeat({
      gatewayClient,
      sessionStore,
      telemetryProvider,
      heartbeatPath: "/v1/device/heartbeat",
      intervalMs: 15000,
    });

  const a = heartbeat.beatNow();
  const b = heartbeat.beatNow();

  while (!release) {
    await new Promise((resolve) =>
      setTimeout(resolve, 0)
    );
  }

  ok(
    "single-flight shares promise",
    a === b
  );

  release();

  const result = await a;

  ok(
    "heartbeat sent",
    result.status === "sent"
  );

  ok(
    "heartbeat route used",
    lastPath ===
      "/v1/device/heartbeat"
  );

  ok(
    "device auth requested",
    lastInit.auth === true
  );

  ok(
    "pending command count captured",
    result.pending_commands === 1
  );

  ok(
    "only one network call occurred",
    calls === 1
  );
}

{
  const heartbeat =
    new RuntimeHeartbeat({
      gatewayClient: {
        async request() {
          throw new Error(
            "network unavailable"
          );
        },
      },
      sessionStore: {
        load() {
          return {
            deviceCode: "SIM",
            deviceToken: "x".repeat(64),
          };
        },
      },
      telemetryProvider: () => ({
        current_state: "NORMAL",
      }),
      heartbeatPath: "/v1/device/heartbeat",
      intervalMs: 15000,
    });

  const result =
    await heartbeat.beatNow();

  ok(
    "network failure contained",
    result.status === "failed"
  );

  ok(
    "failure does not throw",
    heartbeat.meta()
      .consecutive_failures === 1
  );
}

{
  const heartbeat =
    new RuntimeHeartbeat({
      gatewayClient: {
        async request() {
          throw new Error(
            "must not call"
          );
        },
      },
      sessionStore: {
        load() {
          return null;
        },
      },
      telemetryProvider: () => ({
        current_state: "NORMAL",
      }),
      heartbeatPath: "/v1/device/heartbeat",
      intervalMs: 15000,
    });

  const result =
    await heartbeat.beatNow();

  ok(
    "no session safely skipped",
    result.status === "skipped" &&
    result.reason ===
      "no_device_session"
  );
}

console.log();
console.log("=== SUMMARY ===");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(
  `RESULT: ${fail ? "FAIL" : "CLEAN"}`
);

process.exit(fail ? 1 : 0);
