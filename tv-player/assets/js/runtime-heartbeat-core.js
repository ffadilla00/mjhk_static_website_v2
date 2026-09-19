const DEFAULT_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 120_000;
const MIN_INTERVAL_MS = 15_000;
const MAX_INTERVAL_MS = 300_000;
const HEARTBEAT_EVENT = "mjhk:runtime-heartbeat";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class RuntimeHeartbeat {
  #gatewayClient;
  #sessionStore;
  #telemetryProvider;
  #heartbeatPath;
  #intervalMs;
  #timer = null;
  #inFlight = null;
  #running = false;
  #consecutiveFailures = 0;
  #lastResult = null;

  constructor({
    gatewayClient,
    sessionStore,
    telemetryProvider,
    heartbeatPath = "/v1/device/heartbeat",
    intervalMs = DEFAULT_INTERVAL_MS,
  } = {}) {
    if (!gatewayClient || typeof gatewayClient.request !== "function") {
      throw new Error("heartbeat_gateway_client_required");
    }

    if (!sessionStore || typeof sessionStore.load !== "function") {
      throw new Error("heartbeat_session_store_required");
    }

    if (typeof telemetryProvider !== "function") {
      throw new Error("heartbeat_telemetry_provider_required");
    }

    this.#gatewayClient = gatewayClient;
    this.#sessionStore = sessionStore;
    this.#telemetryProvider = telemetryProvider;
    this.#heartbeatPath =
      typeof heartbeatPath === "string" && heartbeatPath.startsWith("/")
        ? heartbeatPath
        : "/v1/device/heartbeat";

    this.#intervalMs = clampInteger(
      intervalMs,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS,
      DEFAULT_INTERVAL_MS
    );
  }

  start({ immediate = true } = {}) {
    if (this.#running) return this.meta();

    this.#running = true;

    if (immediate) {
      void this.beatNow();
    } else {
      this.#schedule(this.#intervalMs);
    }

    return this.meta();
  }

  stop() {
    this.#running = false;
    this.#clearTimer();
    return this.meta();
  }

  beatNow() {
    if (this.#inFlight) return this.#inFlight;

    this.#clearTimer();

    this.#inFlight = this.#runBeat()
      .finally(() => {
        this.#inFlight = null;

        if (this.#running) {
          this.#schedule(this.#nextDelayMs());
        }
      });

    return this.#inFlight;
  }

  meta() {
    return Object.freeze({
      running: this.#running,
      in_flight: Boolean(this.#inFlight),
      interval_ms: this.#intervalMs,
      consecutive_failures: this.#consecutiveFailures,
      last_result: this.#lastResult,
    });
  }

  async #runBeat() {
    const session = this.#sessionStore.load();

    if (!session) {
      const result = freezeResult({
        status: "skipped",
        reason: "no_device_session",
      });

      this.#lastResult = result;
      publishHeartbeatEvent(result);
      return result;
    }

    let telemetry;

    try {
      telemetry = sanitizeTelemetry(
        await this.#telemetryProvider()
      );
    } catch {
      const result = freezeResult({
        status: "skipped",
        reason: "telemetry_collection_failed",
      });

      this.#lastResult = result;
      publishHeartbeatEvent(result);
      return result;
    }

    try {
      const response = await this.#gatewayClient.request(
        this.#heartbeatPath,
        {
          method: "POST",
          session,
          auth: true,
          body: telemetry,
        }
      );

      this.#consecutiveFailures = 0;

      const result = freezeResult({
        status: "sent",
        reason: "heartbeat_accepted",
        server_time:
          typeof response?.data?.server_time === "string"
            ? response.data.server_time
            : null,
        desired_revision_id:
          safeUuid(response?.data?.desired_revision_id),
        applied_revision_id:
          safeUuid(response?.data?.applied_revision_id),
        pending_commands:
          Number.isInteger(response?.data?.pending_commands)
            ? response.data.pending_commands
            : null,
      });

      this.#lastResult = result;
      publishHeartbeatEvent(result);
      return result;
    } catch (error) {
      this.#consecutiveFailures =
        Math.min(this.#consecutiveFailures + 1, 8);

      const result = freezeResult({
        status: "failed",
        reason: safeErrorCode(error),
      });

      this.#lastResult = result;
      publishHeartbeatEvent(result);
      return result;
    }
  }

  #nextDelayMs() {
    if (this.#consecutiveFailures <= 0) {
      return this.#intervalMs;
    }

    const multiplier =
      2 ** Math.min(this.#consecutiveFailures - 1, 3);

    return Math.min(
      this.#intervalMs * multiplier,
      MAX_BACKOFF_MS
    );
  }

  #schedule(delayMs) {
    this.#clearTimer();

    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.beatNow();
    }, delayMs);
  }

  #clearTimer() {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}

export function createBrowserTelemetryProvider({
  presentationBridge,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
} = {}) {
  return () => {
    const stage =
      documentRef?.querySelector?.("#tvStage") ?? null;

    const currentStateNode =
      documentRef?.querySelector?.("#currentStateCode") ?? null;

    const remainingNode =
      documentRef?.querySelector?.("#remainingSeconds") ?? null;

    const presentationMeta =
      typeof presentationBridge?.getSafeMeta === "function"
        ? presentationBridge.getSafeMeta()
        : null;

    const stageWidth =
      positiveInteger(stage?.clientWidth) ??
      positiveInteger(stage?.getBoundingClientRect?.().width) ??
      positiveInteger(windowRef?.innerWidth);

    const stageHeight =
      positiveInteger(stage?.clientHeight) ??
      positiveInteger(stage?.getBoundingClientRect?.().height) ??
      positiveInteger(windowRef?.innerHeight);

    const telemetry = {
      app_version: "mjhk-web-player-3c-b",
      device_model: "Web TV Simulator",
      screen_width: stageWidth,
      screen_height: stageHeight,
      current_state:
        safeState(
          currentStateNode?.textContent ||
          presentationMeta?.state ||
          null
        ),
      remaining_seconds:
        nonNegativeIntegerFromText(
          remainingNode?.textContent
        ),
    };

    const contentId =
      safeUuid(
        presentationMeta?.content_id ??
        presentationMeta?.current_content_id ??
        stage?.dataset?.presentationContentId
      );

    if (contentId) {
      telemetry.current_content_id = contentId;
    }

    const slideIndex =
      nonNegativeInteger(
        presentationMeta?.slide_index ??
        presentationMeta?.current_slide_index ??
        presentationMeta?.index
      );

    if (slideIndex !== null) {
      telemetry.current_slide_index = slideIndex;
    }

    const totalSlides =
      nonNegativeInteger(
        presentationMeta?.total_slides ??
        presentationMeta?.item_count ??
        presentationMeta?.items_count
      );

    if (totalSlides !== null) {
      telemetry.total_slides = totalSlides;
    }

    const userAgent =
      typeof navigatorRef?.userAgent === "string"
        ? navigatorRef.userAgent
        : "";

    if (/android/i.test(userAgent)) {
      const match =
        userAgent.match(/Android\s+([0-9.]+)/i);

      if (match?.[1]) {
        telemetry.android_version =
          match[1].slice(0, 40);
      }

      telemetry.device_model =
        "Android WebView / TV";
    }

    const bridgeError =
      typeof stage?.dataset?.presentationBridgeError === "string"
        ? stage.dataset.presentationBridgeError
        : "";

    if (bridgeError) {
      telemetry.last_error =
        bridgeError.slice(0, 240);
    }

    return telemetry;
  };
}

export function sanitizeTelemetry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return Object.freeze({});
  }

  const telemetry = {};

  putString(telemetry, "app_version", raw.app_version, 80);
  putString(telemetry, "device_model", raw.device_model, 120);
  putString(telemetry, "android_version", raw.android_version, 40);
  putString(telemetry, "current_state", raw.current_state, 80);
  putString(telemetry, "last_error", raw.last_error, 240);

  putInteger(telemetry, "screen_width", raw.screen_width, 0, 16384);
  putInteger(telemetry, "screen_height", raw.screen_height, 0, 16384);
  putInteger(
    telemetry,
    "current_slide_index",
    raw.current_slide_index,
    0,
    100000
  );
  putInteger(
    telemetry,
    "total_slides",
    raw.total_slides,
    0,
    100000
  );
  putInteger(
    telemetry,
    "remaining_seconds",
    raw.remaining_seconds,
    0,
    86400
  );

  if (typeof raw.is_muted === "boolean") {
    telemetry.is_muted = raw.is_muted;
  }

  const contentId =
    safeUuid(raw.current_content_id);

  if (contentId) {
    telemetry.current_content_id = contentId;
  }

  return Object.freeze(telemetry);
}

function publishHeartbeatEvent(result) {
  const root = globalThis.document?.documentElement;

  if (root?.dataset) {
    root.dataset.runtimeHeartbeatStatus =
      safeToken(result.status, "unknown");
    root.dataset.runtimeHeartbeatReason =
      safeToken(result.reason, "unknown");
  }

  if (
    typeof globalThis.window?.dispatchEvent === "function" &&
    typeof globalThis.CustomEvent === "function"
  ) {
    globalThis.window.dispatchEvent(
      new CustomEvent(HEARTBEAT_EVENT, {
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

function putString(target, key, value, maxLength) {
  if (typeof value !== "string") return;

  const clean =
    value.replace(/\s+/g, " ").trim();

  if (!clean) return;

  target[key] = clean.slice(0, maxLength);
}

function putInteger(target, key, value, min, max) {
  if (!Number.isInteger(value)) return;
  if (value < min || value > max) return;
  target[key] = value;
}

function positiveInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function nonNegativeInteger(value) {
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

function nonNegativeIntegerFromText(value) {
  const parsed =
    Number.parseInt(String(value ?? "").trim(), 10);

  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : null;
}

function safeState(value) {
  if (typeof value !== "string") return null;

  const clean = value.trim().toUpperCase();

  return /^[A-Z0-9_]{1,80}$/.test(clean)
    ? clean
    : null;
}

function safeUuid(value) {
  if (
    typeof value === "string" &&
    UUID_RE.test(value)
  ) {
    return value;
  }

  return null;
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
      return safeToken(value, "heartbeat_failed");
    }
  }

  return "heartbeat_failed";
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
