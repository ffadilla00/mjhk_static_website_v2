import {
  validateRevisionPayload,
} from "./revision-validator.js";
import { unwrapRecord } from "./revision-client.js";

const CANDIDATE_KEY = "mjhk.tv.revision.candidate.v1";
const LKG_KEY = "mjhk.tv.revision.lkg.v1";
const STORE_SCHEMA_VERSION = 1;
const MAX_RECORD_BYTES = 1024 * 1024;

export class RevisionStore {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  async saveCandidate(payload, expectedRevisionId = null) {
    const validation = validateRevisionPayload(payload, expectedRevisionId);

    if (!validation.ok) {
      throw new RevisionStoreError(
        "candidate_revision_invalid",
        validation.errors.join(", ") || "revision validation failed"
      );
    }

    const record = unwrapRecord(payload);
    const snapshot = record?.snapshot;

    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new RevisionStoreError(
        "snapshot_missing_or_invalid",
        "Revision snapshot harus object."
      );
    }

    const normalized = {
      schema_version: STORE_SCHEMA_VERSION,
      kind: "candidate",
      revision_id: validation.revisionId,
      revision_number: normalizeRevisionNumber(validation.revisionNumber),
      status: typeof record.status === "string" ? record.status : null,
      published_at: typeof record.published_at === "string" ? record.published_at : null,
      config_available: record.config_available === true,
      snapshot,
      stored_at: new Date().toISOString(),
    };

    normalized.fingerprint = await fingerprintRevision(normalized);

    const serialized = JSON.stringify(normalized);
    assertRecordSize(serialized);

    this.storage.setItem(CANDIDATE_KEY, serialized);

    return safeRevisionMeta(normalized);
  }

  async loadCandidate() {
    return this.#loadVerified(CANDIDATE_KEY, "candidate");
  }

  async promoteCandidate(expectedRevisionId = null) {
    const candidate = await this.#loadVerified(CANDIDATE_KEY, "candidate");

    if (!candidate) {
      throw new RevisionStoreError(
        "candidate_not_found",
        "Tidak ada candidate revision untuk dipromosikan."
      );
    }

    if (
      expectedRevisionId &&
      candidate.revision_id.toLowerCase() !== String(expectedRevisionId).toLowerCase()
    ) {
      throw new RevisionStoreError(
        "candidate_revision_id_mismatch",
        "Candidate revision berbeda dari desired revision."
      );
    }

    const lkg = {
      ...candidate,
      kind: "lkg",
      promoted_at: new Date().toISOString(),
    };

    lkg.fingerprint = await fingerprintRevision(lkg);

    const serialized = JSON.stringify(lkg);
    assertRecordSize(serialized);

    // One-key replacement is atomic from the browser storage point of view.
    // Existing LKG is only replaced AFTER candidate integrity passes.
    this.storage.setItem(LKG_KEY, serialized);
    this.storage.removeItem(CANDIDATE_KEY);

    return safeRevisionMeta(lkg);
  }

  async loadLastKnownGood() {
    return this.#loadVerified(LKG_KEY, "lkg");
  }

  candidateMeta() {
    return safeStoredMeta(this.storage.getItem(CANDIDATE_KEY));
  }

  lkgMeta() {
    return safeStoredMeta(this.storage.getItem(LKG_KEY));
  }

  clearCandidate() {
    this.storage.removeItem(CANDIDATE_KEY);
  }

  clearAll() {
    this.storage.removeItem(CANDIDATE_KEY);
    this.storage.removeItem(LKG_KEY);
  }

  async #loadVerified(key, expectedKind) {
    const raw = this.storage.getItem(key);
    if (!raw) return null;

    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      throw new RevisionStoreError(
        "stored_revision_json_invalid",
        `${expectedKind} revision JSON rusak.`
      );
    }

    assertStoredShape(record, expectedKind);

    const expectedFingerprint = await fingerprintRevision(record);
    if (expectedFingerprint !== record.fingerprint) {
      throw new RevisionStoreError(
        "stored_revision_fingerprint_mismatch",
        `${expectedKind} revision gagal integrity check.`
      );
    }

    return record;
  }
}

export class RevisionStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RevisionStoreError";
    this.code = code;
  }
}

export function safeRevisionMeta(record) {
  if (!record || typeof record !== "object") return null;

  return {
    kind: record.kind ?? null,
    revision_id: record.revision_id ?? null,
    revision_number: record.revision_number ?? null,
    status: record.status ?? null,
    config_available: record.config_available === true,
    stored_at: record.stored_at ?? null,
    promoted_at: record.promoted_at ?? null,
    fingerprint_present: typeof record.fingerprint === "string" && record.fingerprint.length > 0,
    snapshot_present: Boolean(
      record.snapshot &&
      typeof record.snapshot === "object" &&
      !Array.isArray(record.snapshot)
    ),
  };
}

function safeStoredMeta(raw) {
  if (!raw) return null;

  try {
    return safeRevisionMeta(JSON.parse(raw));
  } catch {
    return {
      corrupt: true,
    };
  }
}

function assertStoredShape(record, expectedKind) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new RevisionStoreError(
      "stored_revision_shape_invalid",
      `${expectedKind} revision bukan object.`
    );
  }

  if (record.schema_version !== STORE_SCHEMA_VERSION) {
    throw new RevisionStoreError(
      "stored_revision_schema_unsupported",
      `${expectedKind} schema version tidak didukung.`
    );
  }

  if (record.kind !== expectedKind) {
    throw new RevisionStoreError(
      "stored_revision_kind_mismatch",
      `${expectedKind} revision memiliki kind yang salah.`
    );
  }

  if (
    typeof record.revision_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.revision_id)
  ) {
    throw new RevisionStoreError(
      "stored_revision_id_invalid",
      `${expectedKind} revision_id invalid.`
    );
  }

  if (
    !Number.isInteger(record.revision_number) ||
    record.revision_number < 0
  ) {
    throw new RevisionStoreError(
      "stored_revision_number_invalid",
      `${expectedKind} revision_number invalid.`
    );
  }

  if (
    !record.snapshot ||
    typeof record.snapshot !== "object" ||
    Array.isArray(record.snapshot)
  ) {
    throw new RevisionStoreError(
      "stored_revision_snapshot_invalid",
      `${expectedKind} snapshot invalid.`
    );
  }

  if (
    typeof record.fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/i.test(record.fingerprint)
  ) {
    throw new RevisionStoreError(
      "stored_revision_fingerprint_invalid",
      `${expectedKind} fingerprint invalid.`
    );
  }
}

function normalizeRevisionNumber(value) {
  const number = typeof value === "string" ? Number.parseInt(value, 10) : value;

  if (!Number.isInteger(number) || number < 0) {
    throw new RevisionStoreError(
      "revision_number_invalid",
      "revision_number harus integer >= 0."
    );
  }

  return number;
}

function assertRecordSize(serialized) {
  const bytes = new TextEncoder().encode(serialized).byteLength;

  if (bytes > MAX_RECORD_BYTES) {
    throw new RevisionStoreError(
      "revision_record_too_large",
      `Revision store melebihi ${MAX_RECORD_BYTES} bytes.`
    );
  }
}

async function fingerprintRevision(record) {
  const canonical = stableStringify({
    schema_version: record.schema_version,
    kind: record.kind,
    revision_id: record.revision_id,
    revision_number: record.revision_number,
    status: record.status ?? null,
    published_at: record.published_at ?? null,
    config_available: record.config_available === true,
    snapshot: record.snapshot,
    stored_at: record.stored_at ?? null,
    promoted_at: record.promoted_at ?? null,
  });

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}
