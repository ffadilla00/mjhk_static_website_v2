const STORAGE_KEY = "mjhk.tv.revision-ack-outbox.v1";
const MAX_ITEMS = 12;
const MAX_ATTEMPTS = 8;
const MAX_ERROR_MESSAGE = 240;

export class RevisionAckOutbox {
  constructor(storage = globalThis.localStorage) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new Error("ack_outbox_storage_required");
    }
    this.storage = storage;
  }

  list() {
    return this.#read();
  }

  enqueue(intent) {
    const normalized = normalizeIntent(intent);
    const items = this.#read();
    const duplicateIndex = items.findIndex((item) =>
      item.revision_id === normalized.revision_id &&
      item.success === normalized.success
    );

    const now = new Date().toISOString();
    const entry = {
      id: `${normalized.revision_id}:${normalized.success ? "ok" : "fail"}`,
      revision_id: normalized.revision_id,
      success: normalized.success,
      error_message: normalized.error_message,
      attempts: 0,
      created_at: now,
      updated_at: now,
      next_attempt_at: now,
    };

    if (duplicateIndex >= 0) {
      items[duplicateIndex] = {
        ...items[duplicateIndex],
        error_message: normalized.error_message,
        updated_at: now,
        next_attempt_at: now,
      };
    } else {
      items.push(entry);
    }

    while (items.length > MAX_ITEMS) items.shift();
    this.#write(items);
    return entry;
  }

  remove(id) {
    this.#write(this.#read().filter((item) => item.id !== id));
  }

  markTransientFailure(id, delayMs) {
    const items = this.#read();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return null;

    const current = items[index];
    const attempts = Math.min(current.attempts + 1, MAX_ATTEMPTS);
    const next = {
      ...current,
      attempts,
      updated_at: new Date().toISOString(),
      next_attempt_at: new Date(Date.now() + Math.max(0, delayMs)).toISOString(),
    };

    items[index] = next;
    this.#write(items);
    return next;
  }

  clear() {
    this.storage.removeItem(STORAGE_KEY);
  }

  #read() {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isStoredAck).slice(-MAX_ITEMS);
    } catch {
      return [];
    }
  }

  #write(items) {
    if (!items.length) {
      this.storage.removeItem(STORAGE_KEY);
      return;
    }
    this.storage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  }
}

export function normalizeAckIntent(intent) {
  return normalizeIntent(intent);
}

function normalizeIntent(intent) {
  if (!intent || typeof intent !== "object") throw new Error("ack_intent_required");

  const revisionId = String(intent.revision_id || "").trim();
  if (!isUuid(revisionId)) throw new Error("ack_revision_id_invalid");
  if (typeof intent.success !== "boolean") throw new Error("ack_success_boolean_required");

  return {
    revision_id: revisionId,
    success: intent.success,
    error_message: intent.success ? null : sanitizeErrorMessage(intent.error_message || "Revision apply failed."),
  };
}

function sanitizeErrorMessage(value) {
  return String(value)
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/sb_secret_[a-z0-9_-]+/gi, "[redacted]")
    .replace(/eyJ[a-zA-Z0-9._-]{20,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_MESSAGE);
}

function isStoredAck(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    isUuid(value.revision_id) &&
    typeof value.success === "boolean" &&
    Number.isInteger(value.attempts) &&
    typeof value.next_attempt_at === "string"
  );
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
