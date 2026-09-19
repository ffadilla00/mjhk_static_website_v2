#!/usr/bin/env node

import {
  RuntimeCommandDispatcher,
  isBatchFullyAcknowledged,
} from "../tv-player/assets/js/runtime-command-dispatcher-core.js";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  console.log(
    `[${condition ? "PASS" : "FAIL"}] ${name}`
  );
  condition ? pass++ : fail++;
}

const CMD =
  Object.freeze({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    command_type: "sync_now",
    payload: Object.freeze({}),
  });

{
  const acks = [];
  let syncCalls = 0;

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => {
        syncCalls++;
        return {
          ok: true,
          reason: "already_applied",
        };
      },
      ackCommand: async (ack) => {
        acks.push(ack);
        return { acknowledged: true };
      },
    });

  const result =
    await dispatcher.dispatch(CMD);

  ok(
    "sync_now executed once",
    syncCalls === 1
  );

  ok(
    "successful sync ACK done",
    acks.length === 1 &&
    acks[0].status === "done" &&
    acks[0].errorMessage === null
  );

  ok(
    "successful dispatch acknowledged",
    result.status === "done" &&
    result.acknowledged === true
  );
}

{
  const acks = [];

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => ({
        ok: false,
        reason: "revision_sync_failed",
      }),
      ackCommand: async (ack) => {
        acks.push(ack);
      },
    });

  const result =
    await dispatcher.dispatch(CMD);

  ok(
    "failed sync ACK failed",
    acks[0].status === "failed" &&
    acks[0].errorMessage ===
      "revision_sync_failed"
  );

  ok(
    "failed command still acknowledged",
    result.status === "failed" &&
    result.acknowledged === true
  );
}

{
  let resolveSync;
  let syncCalls = 0;

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => {
        syncCalls++;
        await new Promise((resolve) => {
          resolveSync = resolve;
        });

        return {
          ok: true,
          reason: "already_applied",
        };
      },
      ackCommand: async () => {},
    });

  const a = dispatcher.dispatch(CMD);
  const b = dispatcher.dispatch(CMD);

  while (!resolveSync) {
    await new Promise((resolve) =>
      setTimeout(resolve, 0)
    );
  }

  ok(
    "same command dispatch single-flight",
    a === b
  );

  resolveSync();
  await a;

  ok(
    "single-flight prevents double execution",
    syncCalls === 1
  );
}

{
  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => ({
        ok: true,
        reason: "already_applied",
      }),
      ackCommand: async () => {
        throw new Error("network down");
      },
    });

  const result =
    await dispatcher.dispatch(CMD);

  ok(
    "ACK transport failure contained",
    result.status === "ack_failed" &&
    result.acknowledged === false
  );

  ok(
    "failed ACK prevents hold release",
    isBatchFullyAcknowledged([result]) === false
  );
}

{
  const acks = [];

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => ({
        ok: true,
        reason: "not_used",
      }),
      ackCommand: async (ack) => {
        acks.push(ack);
      },
    });

  const unsupported =
    await dispatcher.dispatch({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      command_type: "restart_app",
      payload: {},
    });

  ok(
    "unsupported browser command ACK failed",
    unsupported.status === "failed" &&
    unsupported.acknowledged === true &&
    acks[0].status === "failed" &&
    acks[0].errorMessage ===
      "command_capability_unavailable"
  );
}

{
  ok(
    "all-acknowledged batch can release hold",
    isBatchFullyAcknowledged([
      { acknowledged: true },
      { acknowledged: true },
    ]) === true
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
