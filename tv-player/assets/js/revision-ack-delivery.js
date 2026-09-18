import { GatewayClient } from "./gateway-client.js";
import { DeviceSessionStore } from "./device-session.js";
import { RevisionAckOutbox } from "./revision-ack-outbox.js";

const ACK_PATH = "/v1/device/revision/ack";
const BACKOFF_MS = Object.freeze([5000, 15000, 60000, 300000, 300000, 300000, 300000, 300000]);

export class RevisionAckDelivery {
  constructor({
    gatewayClient = new GatewayClient(),
    sessionStore = new DeviceSessionStore(),
    outbox = new RevisionAckOutbox(),
    nowProvider = () => new Date(),
  } = {}) {
    this.gatewayClient = gatewayClient;
    this.sessionStore = sessionStore;
    this.outbox = outbox;
    this.nowProvider = nowProvider;
  }

  async submit(intent) {
    const entry = this.outbox.enqueue(intent);
    return this.#deliverEntry(entry);
  }

  async flushPending({ force = false } = {}) {
    const results = [];
    for (const entry of this.outbox.list()) {
      const due = Date.parse(entry.next_attempt_at) <= this.nowProvider().getTime();
      if (!force && !due) continue;
      results.push(await this.#deliverEntry(entry));
    }
    return Object.freeze(results);
  }

  async recoverSuccessAck({ bootstrap, localRevisionId }) {
    const desired = normalizeUuid(bootstrap?.desired_revision_id);
    const serverApplied = normalizeUuid(bootstrap?.applied_revision_id);
    const local = normalizeUuid(localRevisionId);

    if (!desired || !local) {
      return Object.freeze({ status: "not_needed", reason: "missing_revision_context" });
    }
    if (desired.toLowerCase() !== local.toLowerCase()) {
      return Object.freeze({ status: "not_needed", reason: "local_not_desired" });
    }
    if (serverApplied && serverApplied.toLowerCase() === desired.toLowerCase()) {
      return Object.freeze({ status: "not_needed", reason: "server_already_applied" });
    }

    const result = await this.submit({
      revision_id: desired,
      success: true,
      error_message: null,
    });

    return Object.freeze({ ...result, recovery: true });
  }

  async #deliverEntry(entry) {
    const session = this.sessionStore.load();
    if (!session) {
      return Object.freeze({
        status: "queued",
        reason: "no_device_session",
        revision_id: entry.revision_id,
      });
    }

    try {
      await this.gatewayClient.request(ACK_PATH, {
        method: "POST",
        session,
        auth: true,
        body: {
          revision_id: entry.revision_id,
          success: entry.success,
          error_message: entry.success ? null : entry.error_message,
        },
      });

      this.outbox.remove(entry.id);
      return Object.freeze({
        status: "sent",
        reason: "ack_accepted",
        revision_id: entry.revision_id,
        success: entry.success,
      });
    } catch (error) {
      const classification = classifyAckError(error);

      if (classification === "stale" || classification === "permanent") {
        this.outbox.remove(entry.id);
        return Object.freeze({
          status: classification === "stale" ? "stale" : "rejected",
          reason: safeErrorCode(error) || (classification === "stale" ? "stale_revision_ack" : "ack_rejected"),
          revision_id: entry.revision_id,
          success: entry.success,
        });
      }

      const attempt = Math.min(Number.isInteger(entry.attempts) ? entry.attempts : 0, BACKOFF_MS.length - 1);
      const updated = this.outbox.markTransientFailure(entry.id, BACKOFF_MS[attempt]);

      return Object.freeze({
        status: "queued",
        reason: safeErrorCode(error) || "ack_transient_failure",
        revision_id: entry.revision_id,
        success: entry.success,
        attempts: updated?.attempts ?? null,
        next_attempt_at: updated?.next_attempt_at ?? null,
      });
    }
  }
}

export function classifyAckError(error) {
  const status = Number.isInteger(error?.status) ? error.status : null;
  const code = safeErrorCode(error);

  if (status === 409 || code === "stale_revision_ack") return "stale";
  if (status === 400 || status === 401 || status === 403 || status === 404) return "permanent";
  if (status === 408 || status === 425 || status === 429 || (status !== null && status >= 500)) return "transient";
  return "transient";
}

function safeErrorCode(error) {
  for (const value of [error?.payload?.error, error?.code]) {
    if (typeof value === "string" && value.trim()) {
      return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 96);
    }
  }
  return null;
}

function normalizeUuid(value) {
  if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  return null;
}
