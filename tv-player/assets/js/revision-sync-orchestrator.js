const DEFAULT_ERROR_CODE = "sync_failed";
const MAX_ERROR_CODE = 96;
const MAX_ERROR_MESSAGE = 240;

export class RevisionSyncError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = "RevisionSyncError";
    this.code = normalizeErrorCode(code);
    if (cause) this.cause = cause;
  }
}

export class RevisionSyncOrchestrator {
  #deps;
  #inFlight = null;

  constructor(deps) {
    this.#deps = assertDependencies(deps);
  }

  syncOnce() {
    if (this.#inFlight) return this.#inFlight;

    this.#inFlight = this.#run()
      .finally(() => {
        this.#inFlight = null;
      });

    return this.#inFlight;
  }

  async #run() {
    const startedAt = new Date().toISOString();
    let desiredRevisionId = null;
    let candidateStored = false;

    try {
      const session = await this.#deps.loadSession();

      if (!session) {
        return result("skipped", {
          reason: "no_device_session",
          started_at: startedAt,
          ack_intent: null,
        });
      }

      const bootstrap = await this.#deps.bootstrap(session);
      desiredRevisionId = normalizeRevisionId(
        bootstrap?.desired_revision_id ?? null
      );

      if (!desiredRevisionId) {
        return result("noop", {
          reason: "no_desired_revision",
          started_at: startedAt,
          ack_intent: null,
        });
      }

      const appliedRevisionId = normalizeRevisionId(
        await this.#deps.getAppliedRevisionId()
      );

      if (
        appliedRevisionId &&
        appliedRevisionId.toLowerCase() === desiredRevisionId.toLowerCase()
      ) {
        return result("noop", {
          reason: "already_applied",
          revision_id: desiredRevisionId,
          started_at: startedAt,
          ack_intent: null,
        });
      }

      const remoteRevision = await this.#deps.fetchRevision(
        session,
        desiredRevisionId
      );

      await this.#deps.saveCandidate(
        remoteRevision,
        desiredRevisionId
      );
      candidateStored = true;

      const candidate = await this.#deps.loadCandidate();

      if (!candidate) {
        throw new RevisionSyncError(
          "candidate_missing_after_store",
          "Candidate revision tidak tersedia setelah disimpan."
        );
      }

      const prepared = await this.#deps.prepareCandidate(candidate);

      // Critical transaction boundary:
      // candidate MUST be proven locally applicable before LKG promotion.
      await this.#deps.applyCandidate(prepared);

      const promoted = await this.#deps.promoteCandidate(
        desiredRevisionId
      );
      candidateStored = false;

      return result("applied", {
        reason: "revision_applied",
        revision_id: desiredRevisionId,
        revision_number:
          normalizeRevisionNumber(
            promoted?.revision_number ??
            candidate?.revision_number ??
            prepared?.revision_number
          ),
        started_at: startedAt,
        ack_intent: Object.freeze({
          revision_id: desiredRevisionId,
          success: true,
          error_message: null,
        }),
      });
    } catch (error) {
      if (candidateStored) {
        try {
          await this.#deps.clearCandidate();
        } catch {
          // Candidate cleanup failure must never mask the original failure.
        }
      }

      const safe = safeSyncError(error);

      return result("failed", {
        reason: safe.code,
        revision_id: desiredRevisionId,
        started_at: startedAt,
        ack_intent: desiredRevisionId
          ? Object.freeze({
              revision_id: desiredRevisionId,
              success: false,
              error_message: safe.message,
            })
          : null,
      });
    }
  }
}

export function safeSyncError(error) {
  const code = normalizeErrorCode(
    typeof error?.code === "string"
      ? error.code
      : DEFAULT_ERROR_CODE
  );

  const raw =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "Revision synchronization failed.";

  return Object.freeze({
    code,
    message: sanitizeMessage(raw),
  });
}

function result(status, fields) {
  return Object.freeze({
    status,
    finished_at: new Date().toISOString(),
    ...fields,
  });
}

function assertDependencies(deps) {
  if (!deps || typeof deps !== "object") {
    throw new RevisionSyncError(
      "sync_dependencies_missing",
      "Revision sync dependencies wajib tersedia."
    );
  }

  const required = [
    "loadSession",
    "bootstrap",
    "getAppliedRevisionId",
    "fetchRevision",
    "saveCandidate",
    "loadCandidate",
    "prepareCandidate",
    "applyCandidate",
    "promoteCandidate",
    "clearCandidate",
  ];

  for (const name of required) {
    if (typeof deps[name] !== "function") {
      throw new RevisionSyncError(
        "sync_dependency_missing",
        `Dependency ${name} wajib berupa function.`
      );
    }
  }

  return Object.freeze({ ...deps });
}

function normalizeRevisionId(value) {
  if (value === null || value === undefined || value === "") return null;

  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new RevisionSyncError(
      "desired_revision_id_invalid",
      "Desired revision id invalid."
    );
  }

  return value;
}

function normalizeRevisionNumber(value) {
  if (Number.isInteger(value) && value >= 0) return value;
  return null;
}

function normalizeErrorCode(value) {
  const safe = String(value || DEFAULT_ERROR_CODE)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_ERROR_CODE);

  return safe || DEFAULT_ERROR_CODE;
}

function sanitizeMessage(value) {
  return String(value)
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/sb_secret_[a-z0-9_-]+/gi, "[redacted]")
    .replace(/eyJ[a-zA-Z0-9._-]{20,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, MAX_ERROR_MESSAGE);
}
