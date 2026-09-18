import { DeviceSessionStore } from "./device-session.js";
import { GatewayClient } from "./gateway-client.js";
import { GATEWAY_CONFIG } from "./gateway-config.js";
import { unwrapRecord } from "./revision-client.js";
import { RevisionStore } from "./revision-store.js";
import { prepareRuntimeConfig, validateSnapshot } from "./runtime-config-core.js";
import { adaptPresentationConfig } from "./presentation-adapter.js";

export class RevisionStartupDependencyError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = "RevisionStartupDependencyError";
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export function createRevisionSyncDependencies({
  presentationBridge,
  sessionStore = new DeviceSessionStore(),
  gatewayClient = new GatewayClient(),
  revisionStore = new RevisionStore(),
} = {}) {
  if (!presentationBridge ||
      typeof presentationBridge.applyPresentationConfig !== "function" ||
      typeof presentationBridge.clearPresentationConfig !== "function") {
    throw new RevisionStartupDependencyError(
      "presentation_bridge_invalid",
      "Presentation bridge production belum siap."
    );
  }

  let rollbackPresentation = null;
  let candidateWasApplied = false;
  let lastBootstrap = null;

  return Object.freeze({
    async loadSession() {
      return sessionStore.load();
    },

    async bootstrap(session) {
      const response = await gatewayClient.bootstrap(session);
      lastBootstrap = unwrapRecord(response.data);
      return lastBootstrap;
    },

    getLastBootstrap() {
      return lastBootstrap;
    },

    async getAppliedRevisionId() {
      const lkg = await revisionStore.loadLastKnownGood();
      return lkg?.revision_id ?? null;
    },

    async fetchRevision(session, revisionId) {
      const response = await gatewayClient.request(
        GATEWAY_CONFIG.routes.revisionById(revisionId),
        { method: "GET", session, auth: true }
      );
      return response.data;
    },

    async saveCandidate(payload, expectedRevisionId) {
      return revisionStore.saveCandidate(payload, expectedRevisionId);
    },

    async loadCandidate() {
      return revisionStore.loadCandidate();
    },

    async prepareCandidate(candidateRecord) {
      return prepareCandidatePresentation(candidateRecord);
    },

    async applyCandidate(prepared) {
      rollbackPresentation = await loadCurrentLkgPresentation(revisionStore);
      presentationBridge.applyPresentationConfig(prepared.presentation);
      candidateWasApplied = true;
      return Object.freeze({
        revision_id: prepared.revision_id,
        revision_number: prepared.revision_number,
      });
    },

    async promoteCandidate(expectedRevisionId) {
      try {
        const promoted = await revisionStore.promoteCandidate(expectedRevisionId);
        candidateWasApplied = false;
        rollbackPresentation = null;
        return promoted;
      } catch (error) {
        if (candidateWasApplied) {
          try {
            if (rollbackPresentation) {
              presentationBridge.applyPresentationConfig(rollbackPresentation);
            } else {
              presentationBridge.clearPresentationConfig();
            }
          } catch (rollbackError) {
            throw new RevisionStartupDependencyError(
              "lkg_promotion_and_ui_rollback_failed",
              "LKG promotion gagal dan UI rollback juga gagal.",
              rollbackError
            );
          } finally {
            candidateWasApplied = false;
            rollbackPresentation = null;
          }
        }
        throw error;
      }
    },

    async clearCandidate() {
      revisionStore.clearCandidate();
    },
  });
}

export function prepareCandidatePresentation(candidateRecord) {
  assertCandidateRecord(candidateRecord);
  const snapshot = cloneJson(candidateRecord.snapshot);
  validateSnapshot(snapshot);

  const runtime = deepFreeze({
    schema_version: 1,
    revision_id: candidateRecord.revision_id,
    revision_number: candidateRecord.revision_number,
    source: "candidate-preflight",
    hydrated_at: new Date().toISOString(),
    config: snapshot,
  });

  const presentation = adaptPresentationConfig(runtime);

  return Object.freeze({
    revision_id: runtime.revision_id,
    revision_number: runtime.revision_number,
    runtime,
    presentation,
  });
}

async function loadCurrentLkgPresentation(revisionStore) {
  const lkg = await revisionStore.loadLastKnownGood();
  if (!lkg) return null;
  return adaptPresentationConfig(prepareRuntimeConfig(lkg));
}

function assertCandidateRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record) || record.kind !== "candidate") {
    throw new RevisionStartupDependencyError("candidate_record_invalid", "Candidate revision terverifikasi tidak tersedia.");
  }
  if (typeof record.revision_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.revision_id)) {
    throw new RevisionStartupDependencyError("candidate_revision_id_invalid", "Candidate revision_id invalid.");
  }
  if (!Number.isInteger(record.revision_number) || record.revision_number < 0) {
    throw new RevisionStartupDependencyError("candidate_revision_number_invalid", "Candidate revision_number invalid.");
  }
}

function cloneJson(value) {
  try {
    if (typeof structuredClone === "function") return structuredClone(value);
  } catch {}
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
