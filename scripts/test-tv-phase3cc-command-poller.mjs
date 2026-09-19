#!/usr/bin/env node

import {
  RuntimeCommandPoller,
  normalizeCommand,
  normalizeCommandBatch,
  commandTypes,
} from "../tv-player/assets/js/runtime-command-poller-core.js";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  console.log(
    `[${condition ? "PASS" : "FAIL"}] ${name}`
  );
  condition ? pass++ : fail++;
}

const CMD_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

{
  const types = commandTypes();

  ok(
    "expected command allowlist",
    types.includes("sync_now") &&
    types.includes("reload_player") &&
    types.includes("mute") &&
    types.includes("unmute") &&
    types.includes("restart_app") &&
    types.includes("refresh_screenshot")
  );

  ok(
    "command allowlist immutable",
    Object.isFrozen(types)
  );
}

{
  const parsed = normalizeCommand({
    id: CMD_ID,
    command_type: "sync_now",
    payload: {
      reason: "manual",
      unsafe: { nested: true },
      token: "x".repeat(1000),
    },
    created_at: "2026-09-19T00:00:00Z",
    expires_at: "2026-09-19T01:00:00Z",
    delivery_attempts: 1,
  });

  ok(
    "valid sync_now accepted",
    parsed.ok === true &&
    parsed.command.command_type === "sync_now"
  );

  ok(
    "nested payload dropped",
    !("unsafe" in parsed.command.payload)
  );

  ok(
    "oversized payload string dropped",
    !("token" in parsed.command.payload)
  );

  ok(
    "normalized command immutable",
    Object.isFrozen(parsed.command) &&
    Object.isFrozen(parsed.command.payload)
  );
}

{
  const parsed = normalizeCommand({
    id: CMD_ID,
    command_type: "shutdown_everything",
    payload: {},
  });

  ok(
    "unknown command rejected",
    parsed.ok === false &&
    parsed.rejected.reason === "command_type_not_allowed"
  );
}

{
  const batch =
    normalizeCommandBatch({
      server_time: "2026-09-19T00:00:00Z",
      lease_seconds: 60,
      commands: [
        {
          id: CMD_ID,
          command_type: "sync_now",
          payload: {},
          delivery_attempts: 1,
        },
      ],
    });

  ok(
    "lease contract captured",
    batch.lease_seconds === 60
  );

  ok(
    "batch normalized",
    batch.commands.length === 1 &&
    batch.rejected.length === 0
  );
}

{
  let calls = 0;
  let release;

  const poller =
    new RuntimeCommandPoller({
      gatewayClient: {
        async request() {
          calls++;

          await new Promise((resolve) => {
            release = resolve;
          });

          return {
            data: {
              server_time: "2026-09-19T00:00:00Z",
              lease_seconds: 60,
              commands: [],
            },
          };
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
      intervalMs: 5000,
      limit: 5,
    });

  const a = poller.pollNow();
  const b = poller.pollNow();

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
    "empty poll succeeds",
    result.status === "empty"
  );

  ok(
    "only one network call",
    calls === 1
  );
}

{
  let lastPath = null;
  let lastInit = null;

  const poller =
    new RuntimeCommandPoller({
      gatewayClient: {
        async request(path, init) {
          lastPath = path;
          lastInit = init;

          return {
            data: {
              server_time: "2026-09-19T00:00:00Z",
              lease_seconds: 60,
              commands: [
                {
                  id: CMD_ID,
                  command_type: "sync_now",
                  payload: {},
                  delivery_attempts: 1,
                },
              ],
            },
          };
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
      intervalMs: 5000,
      limit: 5,
    });

  const result =
    await poller.pollNow();

  ok(
    "commands route and limit used",
    lastPath === "/v1/device/commands?limit=5"
  );

  ok(
    "device auth requested",
    lastInit.auth === true &&
    lastInit.method === "GET"
  );

  ok(
    "non-empty batch received",
    result.status === "batch_received" &&
    result.commands.length === 1
  );

  ok(
    "poller enters lease-aware hold",
    poller.meta().held === true
  );

  const held =
    await poller.pollNow();

  ok(
    "held poll does not fetch again",
    held.status === "held"
  );
}

{
  const poller =
    new RuntimeCommandPoller({
      gatewayClient: {
        async request() {
          throw new Error("must not call");
        },
      },
      sessionStore: {
        load() {
          return null;
        },
      },
      intervalMs: 5000,
    });

  const result =
    await poller.pollNow();

  ok(
    "no session safely skipped",
    result.status === "skipped" &&
    result.reason === "no_device_session"
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
