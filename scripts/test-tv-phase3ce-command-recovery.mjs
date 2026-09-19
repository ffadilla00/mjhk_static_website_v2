#!/usr/bin/env node

import {
  attachRuntimeCommandCoordinator,
} from "../tv-player/assets/js/runtime-command-coordinator.js";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  console.log(
    `[${condition ? "PASS" : "FAIL"}] ${name}`
  );
  condition ? pass++ : fail++;
}

class FakeWindow {
  listeners = new Map();

  addEventListener(name, fn) {
    if (!this.listeners.has(name)) {
      this.listeners.set(
        name,
        new Set()
      );
    }

    this.listeners.get(name).add(fn);
  }

  removeEventListener(name, fn) {
    this.listeners
      .get(name)
      ?.delete(fn);
  }

  dispatchEvent(event) {
    for (
      const fn of
      this.listeners.get(event.type) ?? []
    ) {
      fn(event);
    }
  }

  setTimeout(fn, ms) {
    return setTimeout(fn, ms);
  }

  clearTimeout(id) {
    clearTimeout(id);
  }
}

const CMD = Object.freeze({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  command_type: "sync_now",
  payload: Object.freeze({}),
});

{
  const win = new FakeWindow();
  let attempts = 0;
  let released = 0;

  const coordinator =
    attachRuntimeCommandCoordinator({
      poller: {
        releaseHold() {
          released++;
        },
      },
      dispatcher: {
        async dispatchBatch() {
          attempts++;

          if (attempts === 1) {
            return [
              {
                acknowledged: false,
                status: "ack_failed",
              },
            ];
          }

          return [
            {
              acknowledged: true,
              status: "done",
            },
          ];
        },
      },
      windowRef: win,
      retryBackoffMs: [20],
    });

  win.dispatchEvent({
    type: "mjhk:runtime-command-poll",
    detail: {
      status: "batch_received",
      commands: [CMD],
    },
  });

  await new Promise((resolve) =>
    setTimeout(resolve, 80)
  );

  ok(
    "failed ACK is retried",
    attempts >= 2
  );

  ok(
    "hold releases after recovered ACK",
    released === 1
  );

  ok(
    "recovery state clears held batch",
    coordinator.meta()
      .has_held_batch === false
  );

  coordinator.stop();
}

{
  const win = new FakeWindow();
  let attempts = 0;
  let released = 0;

  const coordinator =
    attachRuntimeCommandCoordinator({
      poller: {
        releaseHold() {
          released++;
        },
      },
      dispatcher: {
        async dispatchBatch() {
          attempts++;
          return [
            {
              acknowledged:
                attempts >= 2,
              status:
                attempts >= 2
                  ? "done"
                  : "ack_failed",
            },
          ];
        },
      },
      windowRef: win,
      retryBackoffMs: [1000],
    });

  win.dispatchEvent({
    type: "mjhk:runtime-command-poll",
    detail: {
      status: "batch_received",
      commands: [CMD],
    },
  });

  await new Promise((resolve) =>
    setTimeout(resolve, 20)
  );

  const retried =
    coordinator.retryNow();

  await new Promise((resolve) =>
    setTimeout(resolve, 30)
  );

  ok(
    "manual recovery retry accepted",
    retried === true
  );

  ok(
    "manual recovery can finish ACK",
    attempts === 2 &&
    released === 1
  );

  coordinator.stop();
}

console.log();
console.log("=== SUMMARY ===");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(
  `RESULT: ${fail ? "FAIL" : "CLEAN"}`
);

process.exit(fail ? 1 : 0);
