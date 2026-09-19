#!/usr/bin/env node

import {
  createRuntimeOperationsSupervisor,
} from "../tv-player/assets/js/runtime-operations-supervisor.js";

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

  emit(name, detail = undefined) {
    for (
      const fn of
      this.listeners.get(name) ?? []
    ) {
      fn({
        type: name,
        detail,
      });
    }
  }

  dispatchEvent() {}
}

{
  const win = new FakeWindow();
  const calls = [];

  const supervisor =
    createRuntimeOperationsSupervisor({
      heartbeat: {
        start(opts) {
          calls.push(
            `hb:start:${opts.immediate}`
          );
        },
        stop() {
          calls.push("hb:stop");
        },
        beatNow() {
          calls.push("hb:probe");
          return Promise.resolve();
        },
      },
      commandPoller: {
        start(opts) {
          calls.push(
            `cmd:start:${opts.immediate}`
          );
        },
        stop() {
          calls.push("cmd:stop");
        },
      },
      commandCoordinator: {
        retryNow() {
          calls.push("retry");
          return false;
        },
      },
      windowRef: win,
      navigatorRef: {
        onLine: true,
      },
      failureThreshold: 2,
    });

  supervisor.start();

  ok(
    "startup begins heartbeat probe",
    calls.includes("hb:start:true")
  );

  ok(
    "command polling gated before heartbeat success",
    calls.includes("cmd:stop") &&
    !calls.includes("cmd:start:true")
  );

  win.emit(
    "mjhk:runtime-heartbeat",
    {
      status: "sent",
      reason: "heartbeat_accepted",
    }
  );

  ok(
    "heartbeat success enables command polling",
    calls.includes("cmd:start:true")
  );

  win.emit(
    "mjhk:runtime-heartbeat",
    {
      status: "failed",
      reason: "typeerror",
    }
  );

  ok(
    "first transport failure pauses command polling",
    calls.filter(
      (x) => x === "cmd:stop"
    ).length >= 2 &&
    supervisor.meta()
      .consecutive_failures === 1
  );

  win.emit(
    "mjhk:runtime-heartbeat",
    {
      status: "failed",
      reason: "typeerror",
    }
  );

  ok(
    "repeated transport failure reaches offline threshold",
    supervisor.meta()
      .consecutive_failures === 2 &&
    supervisor.meta()
      .transport_online === false
  );

  win.emit(
    "mjhk:runtime-heartbeat",
    {
      status: "sent",
      reason: "heartbeat_accepted",
    }
  );

  ok(
    "real heartbeat recovery restores polling",
    supervisor.meta()
      .transport_online === true &&
    supervisor.meta()
      .consecutive_failures === 0 &&
    calls.filter(
      (x) => x === "cmd:start:true"
    ).length >= 2
  );

  win.emit("offline");

  ok(
    "browser offline does not stop heartbeat probe",
    calls.filter(
      (x) => x === "hb:stop"
    ).length === 0
  );

  win.emit("online");

  ok(
    "browser online triggers immediate heartbeat probe",
    calls.includes("hb:probe")
  );

  supervisor.stop();

  ok(
    "supervisor stop shuts network operations",
    calls.includes("hb:stop")
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
