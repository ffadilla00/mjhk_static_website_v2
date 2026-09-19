const DEFAULT_INTERVAL_MS = 15_000;
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 120_000;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const COMMAND_EVENT = "mjhk:runtime-command-poll";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COMMAND_TYPES = Object.freeze([
  "sync_now",
  "reload_player",
  "mute",
  "unmute",
  "restart_app",
  "refresh_screenshot",
]);

const COMMAND_TYPE_SET = new Set(COMMAND_TYPES);

export class RuntimeCommandPoller {
  #gatewayClient;
  #sessionStore;
  #commandsPath;
  #intervalMs;
  #limit;
  #timer = null;
  #inFlight = null;
  #running = false;
  #held = false;
  #lastResult = null;

  constructor({
    gatewayClient,
    sessionStore,
    commandsPath = "/v1/device/commands",
    intervalMs = DEFAULT_INTERVAL_MS,
    limit = DEFAULT_LIMIT,
  } = {}) {
    if (!gatewayClient || typeof gatewayClient.request !== "function") {
      throw new Error("command_poller_gateway_client_required");
    }

    if (!sessionStore || typeof sessionStore.load !== "function") {
      throw new Error("command_poller_session_store_required");
    }

    this.#gatewayClient = gatewayClient;
    this.#sessionStore = sessionStore;
    this.#commandsPath =
      typeof commandsPath === "string" && commandsPath.startsWith("/")
        ? commandsPath
        : "/v1/device/commands";

    this.#intervalMs = clampInteger(
      intervalMs,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS,
      DEFAULT_INTERVAL_MS
    );

    this.#limit = clampInteger(
      limit,
      1,
      MAX_LIMIT,
      DEFAULT_LIMIT
    );
  }

  start({ immediate = true } = {}) {
    if (this.#running) return this.meta();

    this.#running = true;

    if (!this.#held) {
      if (immediate) {
        void this.pollNow();
      } else {
        this.#schedule(this.#intervalMs);
      }
    }

    return this.meta();
  }

  stop() {
    this.#running = false;
    this.#clearTimer();
    return this.meta();
  }

  releaseHold({ immediate = false } = {}) {
    this.#held = false;

    if (this.#running) {
      if (immediate) {
        void this.pollNow();
      } else {
        this.#schedule(this.#intervalMs);
      }
    }

    return this.meta();
  }

  pollNow() {
    if (this.#held) {
      const result = freezeResult({
        status: "held",
        reason: "command_batch_waiting_for_dispatcher",
        commands: Object.freeze([]),
        rejected: Object.freeze([]),
        lease_seconds: null,
      });

      this.#lastResult = result;
      publishCommandEvent(result);
      return Promise.resolve(result);
    }

    if (this.#inFlight) return this.#inFlight;

    this.#clearTimer();

    this.#inFlight = this.#runPoll()
      .finally(() => {
        this.#inFlight = null;

        if (this.#running && !this.#held) {
          this.#schedule(this.#intervalMs);
        }
      });

    return this.#inFlight;
  }

  meta() {
    return Object.freeze({
      running: this.#running,
      held: this.#held,
      in_flight: Boolean(this.#inFlight),
      interval_ms: this.#intervalMs,
      limit: this.#limit,
      last_result: this.#lastResult,
    });
  }

  async #runPoll() {
    const session = this.#sessionStore.load();

    if (!session) {
      const result = freezeResult({
        status: "skipped",
        reason: "no_device_session",
        commands: Object.freeze([]),
        rejected: Object.freeze([]),
        lease_seconds: null,
      });

      this.#lastResult = result;
      publishCommandEvent(result);
      return result;
    }

    try {
      const separator =
        this.#commandsPath.includes("?") ? "&" : "?";

      const path =
        `${this.#commandsPath}${separator}limit=${this.#limit}`;

      const response =
        await this.#gatewayClient.request(
          path,
          {
            method: "GET",
            session,
            auth: true,
          }
        );

      const normalized =
        normalizeCommandBatch(response?.data);

      if (
        normalized.commands.length > 0 ||
        normalized.rejected.length > 0
      ) {
        // Phase 3C-C does NOT execute or ACK commands.
        // Hold further polling after the first non-empty leased batch so
        // delivery_attempts are not consumed repeatedly before 3C-D exists.
        this.#held = true;
      }

      const result = freezeResult({
        status:
          normalized.commands.length ||
          normalized.rejected.length
            ? "batch_received"
            : "empty",
        reason:
          normalized.commands.length ||
          normalized.rejected.length
            ? "command_batch_held"
            : "no_commands",
        commands: normalized.commands,
        rejected: normalized.rejected,
        lease_seconds: normalized.lease_seconds,
        server_time: normalized.server_time,
      });

      this.#lastResult = result;
      publishCommandEvent(result);
      return result;
    } catch (error) {
      const result = freezeResult({
        status: "failed",
        reason: safeErrorCode(error),
        commands: Object.freeze([]),
        rejected: Object.freeze([]),
        lease_seconds: null,
      });

      this.#lastResult = result;
      publishCommandEvent(result);
      return result;
    }
  }

  #schedule(delayMs) {
    this.#clearTimer();

    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.pollNow();
    }, delayMs);
  }

  #clearTimer() {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}

export function normalizeCommandBatch(raw) {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : {};

  const leaseSeconds =
    Number.isInteger(source.lease_seconds) &&
    source.lease_seconds >= 1 &&
    source.lease_seconds <= 3600
      ? source.lease_seconds
      : null;

  const serverTime =
    typeof source.server_time === "string"
      ? source.server_time.slice(0, 64)
      : null;

  const commands = [];
  const rejected = [];

  const incoming =
    Array.isArray(source.commands)
      ? source.commands.slice(0, MAX_LIMIT)
      : [];

  for (const rawCommand of incoming) {
    const parsed = normalizeCommand(rawCommand);

    if (parsed.ok) {
      commands.push(parsed.command);
    } else {
      rejected.push(parsed.rejected);
    }
  }

  return Object.freeze({
    lease_seconds: leaseSeconds,
    server_time: serverTime,
    commands: Object.freeze(commands),
    rejected: Object.freeze(rejected),
  });
}

export function normalizeCommand(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return rejectedCommand(null, "command_not_object");
  }

  const id =
    typeof raw.id === "string" && UUID_RE.test(raw.id)
      ? raw.id
      : null;

  if (!id) {
    return rejectedCommand(null, "command_id_invalid");
  }

  const commandType =
    typeof raw.command_type === "string"
      ? raw.command_type.trim()
      : "";

  if (!COMMAND_TYPE_SET.has(commandType)) {
    return rejectedCommand(id, "command_type_not_allowed");
  }

  const payload =
    raw.payload &&
    typeof raw.payload === "object" &&
    !Array.isArray(raw.payload)
      ? sanitizePayload(raw.payload)
      : Object.freeze({});

  const command = Object.freeze({
    id,
    command_type: commandType,
    payload,
    created_at:
      safeIsoLike(raw.created_at),
    expires_at:
      safeIsoLike(raw.expires_at),
    delivery_attempts:
      clampInteger(raw.delivery_attempts, 0, 100, 0),
  });

  return Object.freeze({
    ok: true,
    command,
  });
}

export function commandTypes() {
  return COMMAND_TYPES;
}

function sanitizePayload(raw) {
  const clean = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) continue;

    if (
      typeof value === "string" &&
      value.length <= 500
    ) {
      clean[key] = value;
      continue;
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      clean[key] = value;
      continue;
    }

    if (typeof value === "boolean" || value === null) {
      clean[key] = value;
    }
  }

  return Object.freeze(clean);
}

function rejectedCommand(id, reason) {
  return Object.freeze({
    ok: false,
    rejected: Object.freeze({
      id,
      reason,
    }),
  });
}

function publishCommandEvent(result) {
  const root = globalThis.document?.documentElement;

  if (root?.dataset) {
    root.dataset.runtimeCommandPollStatus =
      safeToken(result.status, "unknown");
    root.dataset.runtimeCommandPollReason =
      safeToken(result.reason, "unknown");
    root.dataset.runtimeCommandPollHeld =
      result.status === "batch_received" ||
      result.status === "held"
        ? "true"
        : "false";
  }

  if (
    typeof globalThis.window?.dispatchEvent === "function" &&
    typeof globalThis.CustomEvent === "function"
  ) {
    globalThis.window.dispatchEvent(
      new CustomEvent(COMMAND_EVENT, {
        detail: result,
      })
    );
  }
}

function freezeResult(fields) {
  return Object.freeze({
    at: new Date().toISOString(),
    ...fields,
  });
}

function safeIsoLike(value) {
  if (typeof value !== "string") return null;
  return value.slice(0, 64);
}

function safeErrorCode(error) {
  const candidates = [
    error?.payload?.error,
    error?.code,
    error?.name,
  ];

  for (const value of candidates) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return safeToken(value, "command_poll_failed");
    }
  }

  return "command_poll_failed";
}

function safeToken(value, fallback) {
  const text =
    typeof value === "string"
      ? value
      : fallback;

  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .slice(0, 96) || fallback;
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(value, max));
}
