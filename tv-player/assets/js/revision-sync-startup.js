import { RevisionSyncOrchestrator } from "./revision-sync-orchestrator.js";
import { createRevisionSyncDependencies } from "./revision-sync-startup-dependencies.js";
import { DeviceSessionStore } from "./device-session.js";
import { GatewayClient } from "./gateway-client.js";
import { RevisionStore } from "./revision-store.js";
import { RevisionAckOutbox } from "./revision-ack-outbox.js";
import { RevisionAckDelivery } from "./revision-ack-delivery.js";

const SYNC_EVENT = "mjhk:revision-sync-result";
let startupPromise = null;

export function startRevisionStartupSync({ presentationBridge } = {}) {
  if (startupPromise) return startupPromise;
  startupPromise = runStartupSync({ presentationBridge });
  return startupPromise;
}

async function runStartupSync({ presentationBridge }) {
  let result;
  let ackResult = null;

  try {
    await presentationBridge.initialize();

    const sessionStore = new DeviceSessionStore();
    const gatewayClient = new GatewayClient();
    const revisionStore = new RevisionStore();
    const ackOutbox = new RevisionAckOutbox();

    const dependencies = createRevisionSyncDependencies({
      presentationBridge,
      sessionStore,
      gatewayClient,
      revisionStore,
    });

    const orchestrator = new RevisionSyncOrchestrator(dependencies);
    result = await orchestrator.syncOnce();

    const ackDelivery = new RevisionAckDelivery({
      gatewayClient,
      sessionStore,
      outbox: ackOutbox,
    });

    await ackDelivery.flushPending({ force: true });

    if (result?.ack_intent) {
      ackResult = await ackDelivery.submit(result.ack_intent);
    } else if (result?.status === "noop" && result?.reason === "already_applied") {
      const lkg = await revisionStore.loadLastKnownGood();
      ackResult = await ackDelivery.recoverSuccessAck({
        bootstrap: dependencies.getLastBootstrap(),
        localRevisionId: lkg?.revision_id ?? null,
      });
    }
  } catch (error) {
    result = Object.freeze({
      status: "failed",
      reason: typeof error?.code === "string" ? error.code : "startup_sync_failed",
      revision_id: null,
      ack_intent: null,
      finished_at: new Date().toISOString(),
    });
    ackResult = Object.freeze({
      status: "not_attempted",
      reason: "startup_sync_exception",
    });
  }

  publishSafeSyncStatus(result, ackResult);

  return Object.freeze({
    result,
    ack_result: ackResult,
  });
  return Object.freeze({ ...result, ack_delivery: ackResult });
}

function publishSafeSyncStatus(result, ackResult) {
  const root = document.documentElement;
  root.dataset.revisionSyncStatus = safeToken(result?.status, "unknown");
  root.dataset.revisionSyncReason = safeToken(result?.reason, "unknown");
  root.dataset.revisionAckStatus = safeToken(ackResult?.status, "not_needed");
  root.dataset.revisionAckReason = safeToken(ackResult?.reason, "not_needed");

  const detail = Object.freeze({
    status: result?.status ?? "unknown",
    reason: result?.reason ?? "unknown",
    revision_id: result?.revision_id ?? null,
    revision_number: Number.isInteger(result?.revision_number) ? result.revision_number : null,
    ack_intent: result?.ack_intent ?? null,
    ack_delivery: ackResult ? Object.freeze({
      status: ackResult.status ?? "unknown",
      reason: ackResult.reason ?? "unknown",
      revision_id: ackResult.revision_id ?? null,
      recovery: ackResult.recovery === true,
    }) : null,
  });

  if (typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail }));
  }

  renderDeveloperStatus(detail);
}

function renderDeveloperStatus(detail) {
  if (document.documentElement.dataset.playerMode === "production") return;
  const devPanel = document.querySelector("#devPanel");
  if (!devPanel) return;

  let node = devPanel.querySelector("[data-revision-sync-dev-status]");
  if (!node) {
    node = document.createElement("div");
    node.dataset.revisionSyncDevStatus = "true";
    node.style.marginTop = "10px";
    node.style.paddingTop = "9px";
    node.style.borderTop = "1px solid rgba(255,255,255,.08)";
    node.style.fontSize = "11px";
    node.style.opacity = ".76";
    devPanel.append(node);
  }

  const revision = detail.revision_number === null ? "" : ` • rev ${detail.revision_number}`;
  const ack = detail.ack_delivery ? ` • ACK ${String(detail.ack_delivery.status).toUpperCase()}` : "";

  node.textContent = `Revision Sync: ${String(detail.status).toUpperCase()} • ${detail.reason}${revision}${ack}`;
}

function safeToken(value, fallback) {
  const text = typeof value === "string" ? value : fallback;
  return text.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 80) || fallback;
}


let runtimeCommandSyncPromise = null;

export function runRevisionSyncNow({
  presentationBridge,
} = {}) {
  if (runtimeCommandSyncPromise) {
    return runtimeCommandSyncPromise;
  }

  // Startup sync has already settled before command polling begins.
  // Reset only the startup memoization so sync_now can execute the exact
  // same locked pipeline again.
  startupPromise = null;

  runtimeCommandSyncPromise =
    startRevisionStartupSync({
      presentationBridge,
    }).finally(() => {
      runtimeCommandSyncPromise = null;
    });

  return runtimeCommandSyncPromise;
}
