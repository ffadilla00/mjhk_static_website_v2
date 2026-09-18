#!/usr/bin/env node

import {
  RevisionSyncOrchestrator,
  safeSyncError,
} from "../tv-player/assets/js/revision-sync-orchestrator.js";

const REV_1 = "53b55497-f01e-4809-a7be-828a8bf0c9a9";
const REV_2 = "63b55497-f01e-4809-a7be-828a8bf0c9aa";

let pass = 0;
let fail = 0;

function ok(name, condition) {
  console.log(`[${condition ? "PASS" : "FAIL"}] ${name}`);
  condition ? pass++ : fail++;
}

function makeDeps(overrides = {}) {
  const calls = [];
  let candidate = null;
  let currentLkg = {
    revision_id: REV_1,
    revision_number: 4,
  };

  const deps = {
    async loadSession() {
      calls.push("loadSession");
      return { deviceCode: "SIM", deviceToken: "[opaque]" };
    },

    async bootstrap() {
      calls.push("bootstrap");
      return { desired_revision_id: REV_2 };
    },

    async getAppliedRevisionId() {
      calls.push("getAppliedRevisionId");
      return currentLkg?.revision_id ?? null;
    },

    async fetchRevision(_session, revisionId) {
      calls.push("fetchRevision");
      return {
        revision_id: revisionId,
        revision_number: 5,
        status: "draft",
        snapshot: {
          playlist_items: [],
          running_text: [],
        },
      };
    },

    async saveCandidate(payload, expectedRevisionId) {
      calls.push("saveCandidate");
      if (payload.revision_id !== expectedRevisionId) {
        throw Object.assign(
          new Error("candidate mismatch"),
          { code: "candidate_revision_id_mismatch" }
        );
      }
      candidate = {
        kind: "candidate",
        ...payload,
      };
      return { revision_id: payload.revision_id };
    },

    async loadCandidate() {
      calls.push("loadCandidate");
      return candidate;
    },

    async prepareCandidate(record) {
      calls.push("prepareCandidate");
      return Object.freeze({
        revision_id: record.revision_id,
        revision_number: record.revision_number,
        presentation: Object.freeze({
          playlist_items: [],
          running_text: [],
        }),
      });
    },

    async applyCandidate(prepared) {
      calls.push("applyCandidate");
      return { applied_revision_id: prepared.revision_id };
    },

    async promoteCandidate(expectedRevisionId) {
      calls.push("promoteCandidate");
      if (!candidate || candidate.revision_id !== expectedRevisionId) {
        throw Object.assign(
          new Error("candidate missing"),
          { code: "candidate_not_found" }
        );
      }
      currentLkg = {
        revision_id: candidate.revision_id,
        revision_number: candidate.revision_number,
      };
      candidate = null;
      return currentLkg;
    },

    async clearCandidate() {
      calls.push("clearCandidate");
      candidate = null;
    },

    ...overrides,
  };

  return {
    deps,
    calls,
    getCandidate: () => candidate,
    getLkg: () => currentLkg,
  };
}

{
  const { deps } = makeDeps({
    async loadSession() { return null; },
  });

  const out = await new RevisionSyncOrchestrator(deps).syncOnce();
  ok("no session => skipped", out.status === "skipped");
  ok("no session => no ACK intent", out.ack_intent === null);
}

{
  const { deps } = makeDeps({
    async bootstrap() { return { desired_revision_id: null }; },
  });

  const out = await new RevisionSyncOrchestrator(deps).syncOnce();
  ok("no desired revision => noop", out.status === "noop");
}

{
  const { deps } = makeDeps({
    async bootstrap() { return { desired_revision_id: REV_1 }; },
  });

  const out = await new RevisionSyncOrchestrator(deps).syncOnce();
  ok("already applied => noop", out.reason === "already_applied");
}

{
  const ctx = makeDeps();
  const out = await new RevisionSyncOrchestrator(ctx.deps).syncOnce();

  ok("success => applied", out.status === "applied");
  ok("success => ACK intent true", out.ack_intent?.success === true);
  ok(
    "promote strictly after apply",
    ctx.calls.indexOf("applyCandidate") >= 0 &&
    ctx.calls.indexOf("promoteCandidate") >
      ctx.calls.indexOf("applyCandidate")
  );
  ok("success clears candidate through promotion", ctx.getCandidate() === null);
  ok("success updates LKG to desired revision", ctx.getLkg().revision_id === REV_2);
}

{
  const ctx = makeDeps({
    async applyCandidate() {
      ctx.calls.push("applyCandidate");
      throw Object.assign(
        new Error("render rejected"),
        { code: "presentation_apply_failed" }
      );
    },
  });

  const before = ctx.getLkg().revision_id;
  const out = await new RevisionSyncOrchestrator(ctx.deps).syncOnce();

  ok("apply failure => failed", out.status === "failed");
  ok("apply failure => negative ACK intent", out.ack_intent?.success === false);
  ok("apply failure => old LKG preserved", ctx.getLkg().revision_id === before);
  ok("apply failure => candidate cleared", ctx.getCandidate() === null);
  ok(
    "apply failure => no promotion",
    !ctx.calls.includes("promoteCandidate")
  );
}

{
  const ctx = makeDeps({
    async fetchRevision() {
      ctx.calls.push("fetchRevision");
      throw Object.assign(
        new Error("gateway unavailable"),
        { code: "gateway_unavailable" }
      );
    },
  });

  const out = await new RevisionSyncOrchestrator(ctx.deps).syncOnce();
  ok("fetch failure => failed", out.status === "failed");
  ok("fetch failure => no promotion", !ctx.calls.includes("promoteCandidate"));
}

{
  const ctx = makeDeps();
  let release;
  ctx.deps.applyCandidate = async () => {
    ctx.calls.push("applyCandidate");
    await new Promise((resolve) => { release = resolve; });
  };

  const orchestrator = new RevisionSyncOrchestrator(ctx.deps);
  const first = orchestrator.syncOnce();
  const second = orchestrator.syncOnce();

  // Let the run reach applyCandidate.
  while (!release) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  ok("concurrent sync shares one in-flight promise", first === second);
  release();
  await first;
}

{
  const safe = safeSyncError(
    Object.assign(
      new Error(
        "Bearer abcdefghijklmnopqrstuvwxyz0123456789 " +
        "sb_secret_1234567890abcdefghijklmnop"
      ),
      { code: "UPSTREAM AUTH FAILED!!" }
    )
  );

  ok("safe error code normalized", safe.code === "upstream_auth_failed");
  ok("safe error message redacts secrets", !safe.message.includes("sb_secret_"));
  ok("safe error bounded", safe.message.length <= 240);
}

console.log();
console.log("=== SUMMARY ===");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
console.log(`RESULT: ${fail ? "FAIL" : "CLEAN"}`);

process.exit(fail ? 1 : 0);
