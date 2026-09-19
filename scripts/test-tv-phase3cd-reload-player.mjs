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

const SYNC_CMD = Object.freeze({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  command_type: "sync_now",
  payload: Object.freeze({}),
});

const RELOAD_CMD = Object.freeze({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  command_type: "reload_player",
  payload: Object.freeze({}),
});

{
  const order = [];

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => ({
        ok: true,
        reason: "already_applied",
      }),
      prepareReloadPlayer: async () => ({
        ok: true,
        reason: "reload_scheduled",
        after_ack: () => {
          order.push("reload");
        },
      }),
      ackCommand: async (ack) => {
        order.push(
          `ack:${ack.status}`
        );
      },
    });

  const result =
    await dispatcher.dispatch(RELOAD_CMD);

  ok(
    "reload command ACK done",
    result.status === "done" &&
    result.acknowledged === true
  );

  ok(
    "reload marked post-ACK scheduled",
    result.post_ack_scheduled === true
  );

  ok(
    "ACK occurs before reload action",
    order.join(",") ===
      "ack:done,reload"
  );
}

{
  const order = [];

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => ({
        ok: true,
        reason: "already_applied",
      }),
      prepareReloadPlayer: async () => ({
        ok: true,
        reason: "reload_scheduled",
        after_ack: () => {
          order.push("reload");
        },
      }),
      ackCommand: async () => {
        order.push("ack_failed");
        throw new Error("network down");
      },
    });

  const result =
    await dispatcher.dispatch(RELOAD_CMD);

  ok(
    "ACK failure contained",
    result.status === "ack_failed" &&
    result.acknowledged === false
  );

  ok(
    "reload suppressed when ACK fails",
    order.join(",") ===
      "ack_failed"
  );

  ok(
    "ACK failure does not release batch",
    isBatchFullyAcknowledged(
      [result]
    ) === false
  );
}

{
  const acks = [];

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => ({
        ok: true,
        reason: "already_applied",
      }),
      prepareReloadPlayer: async () => ({
        ok: false,
        reason:
          "reload_player_capability_unavailable",
      }),
      ackCommand: async (ack) => {
        acks.push(ack);
      },
    });

  const result =
    await dispatcher.dispatch(RELOAD_CMD);

  ok(
    "missing reload capability ACK failed",
    result.status === "failed" &&
    result.acknowledged === true &&
    acks[0].status === "failed" &&
    acks[0].errorMessage ===
      "reload_player_capability_unavailable"
  );

  ok(
    "missing capability has no post-ACK action",
    result.post_ack_scheduled === false
  );
}

{
  let syncCalls = 0;
  const acks = [];

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => {
        syncCalls++;
        return {
          ok: true,
          reason: "already_applied",
        };
      },
      prepareReloadPlayer: async () => ({
        ok: true,
        reason: "reload_scheduled",
        after_ack: () => {},
      }),
      ackCommand: async (ack) => {
        acks.push(ack);
      },
    });

  const result =
    await dispatcher.dispatch(SYNC_CMD);

  ok(
    "sync_now remains unchanged",
    syncCalls === 1 &&
    result.status === "done" &&
    acks[0].status === "done"
  );
}

{
  let resolveReady;
  let prepareCalls = 0;

  const dispatcher =
    new RuntimeCommandDispatcher({
      syncNow: async () => ({
        ok: true,
        reason: "already_applied",
      }),
      prepareReloadPlayer: async () => {
        prepareCalls++;

        await new Promise((resolve) => {
          resolveReady = resolve;
        });

        return {
          ok: true,
          reason: "reload_scheduled",
          after_ack: () => {},
        };
      },
      ackCommand: async () => {},
    });

  const a =
    dispatcher.dispatch(RELOAD_CMD);
  const b =
    dispatcher.dispatch(RELOAD_CMD);

  while (!resolveReady) {
    await new Promise((resolve) =>
      setTimeout(resolve, 0)
    );
  }

  ok(
    "reload dispatch single-flight",
    a === b
  );

  resolveReady();
  await a;

  ok(
    "duplicate reload does not prepare twice",
    prepareCalls === 1
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
