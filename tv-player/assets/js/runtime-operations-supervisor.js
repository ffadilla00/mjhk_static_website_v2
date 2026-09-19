const NETWORK_EVENT =
  "mjhk:runtime-network-state";
const HEARTBEAT_EVENT =
  "mjhk:runtime-heartbeat";

const DEFAULT_FAILURE_THRESHOLD = 2;
const SUPERVISOR_VERSION = "3c-e-v4";

export function createRuntimeOperationsSupervisor({
  heartbeat,
  commandPoller,
  commandCoordinator,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
} = {}) {
  if (
    !heartbeat ||
    typeof heartbeat.start !== "function" ||
    typeof heartbeat.stop !== "function" ||
    typeof heartbeat.beatNow !== "function"
  ) {
    throw new Error(
      "runtime_supervisor_heartbeat_required"
    );
  }

  if (
    !commandPoller ||
    typeof commandPoller.start !== "function" ||
    typeof commandPoller.stop !== "function"
  ) {
    throw new Error(
      "runtime_supervisor_command_poller_required"
    );
  }

  if (
    !commandCoordinator ||
    typeof commandCoordinator.retryNow !== "function"
  ) {
    throw new Error(
      "runtime_supervisor_command_coordinator_required"
    );
  }

  const threshold =
    clampInteger(
      failureThreshold,
      1,
      10,
      DEFAULT_FAILURE_THRESHOLD
    );

  let started = false;
  let transportOnline = null;
  let consecutiveFailures = 0;

  const publish = (
    status,
    reason
  ) => {
    const root =
      globalThis.document?.documentElement;

    if (root?.dataset) {
      root.dataset.runtimeSupervisorVersion =
        SUPERVISOR_VERSION;
      root.dataset.runtimeNetworkStatus =
        safeToken(status, "unknown");
      root.dataset.runtimeNetworkReason =
        safeToken(reason, "unknown");
      root.dataset.runtimeNetworkFailures =
        String(consecutiveFailures);
    }

    if (
      typeof windowRef?.dispatchEvent === "function" &&
      typeof globalThis.CustomEvent === "function"
    ) {
      windowRef.dispatchEvent(
        new CustomEvent(
          NETWORK_EVENT,
          {
            detail: Object.freeze({
              status,
              reason,
              consecutive_failures:
                consecutiveFailures,
            }),
          }
        )
      );
    }
  };

  const pauseCommandOperations = () => {
    commandPoller.stop();
  };

  const resumeCommandOperations = () => {
    commandPoller.start({
      immediate: true,
    });

    commandCoordinator.retryNow();
  };

  const onHeartbeat = (event) => {
    if (!started) return;

    const detail =
      event?.detail ?? {};

    if (detail.status === "sent") {
      const wasOnline =
        transportOnline === true;

      transportOnline = true;
      consecutiveFailures = 0;

      publish(
        "online",
        wasOnline
          ? "heartbeat_confirmed"
          : "heartbeat_recovered"
      );

      resumeCommandOperations();
      return;
    }

    if (detail.status === "failed") {
      transportOnline = false;
      consecutiveFailures += 1;

      pauseCommandOperations();

      if (
        consecutiveFailures >= threshold
      ) {
        publish(
          "offline",
          "heartbeat_transport_failed"
        );
      } else {
        publish(
          "degraded",
          "heartbeat_transport_degraded"
        );
      }
    }
  };

  const onBrowserOffline = () => {
    if (!started) return;

    transportOnline = false;
    consecutiveFailures =
      Math.max(
        consecutiveFailures,
        threshold
      );

    pauseCommandOperations();

    publish(
      "offline",
      "browser_offline"
    );

    // Heartbeat remains running as the bounded recovery probe.
    // Its own backoff prevents tight retry loops.
  };

  const onBrowserOnline = () => {
    if (!started) return;

    publish(
      "probing",
      "browser_online_probe"
    );

    // Do not resume command polling until a real Gateway heartbeat
    // confirms transport reachability.
    void heartbeat.beatNow();
  };

  return Object.freeze({
    start() {
      if (started) {
        return this.meta();
      }

      started = true;
      consecutiveFailures = 0;
      transportOnline = null;

      const root =
        globalThis.document?.documentElement;

      if (root?.dataset) {
        root.dataset.runtimeSupervisorVersion =
          SUPERVISOR_VERSION;
      }

      windowRef.addEventListener(
        HEARTBEAT_EVENT,
        onHeartbeat
      );

      windowRef.addEventListener(
        "offline",
        onBrowserOffline
      );

      windowRef.addEventListener(
        "online",
        onBrowserOnline
      );

      publish(
        "probing",
        navigatorRef?.onLine === false
          ? "browser_reports_offline_probe"
          : "runtime_transport_probe"
      );

      // Heartbeat is always the reachability probe.
      heartbeat.start({
        immediate: true,
      });

      // Command polling is gated until a successful heartbeat event.
      commandPoller.stop();

      return this.meta();
    },

    stop() {
      if (!started) {
        return this.meta();
      }

      started = false;

      windowRef.removeEventListener(
        HEARTBEAT_EVENT,
        onHeartbeat
      );

      windowRef.removeEventListener(
        "offline",
        onBrowserOffline
      );

      windowRef.removeEventListener(
        "online",
        onBrowserOnline
      );

      heartbeat.stop();
      commandPoller.stop();

      return this.meta();
    },

    probeNow() {
      if (!started) return false;

      publish(
        "probing",
        "manual_transport_probe"
      );

      void heartbeat.beatNow();
      return true;
    },

    meta() {
      return Object.freeze({
        started,
        transport_online:
          transportOnline,
        consecutive_failures:
          consecutiveFailures,
        failure_threshold:
          threshold,
      });
    },
  });
}

function clampInteger(
  value,
  min,
  max,
  fallback
) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.max(
    min,
    Math.min(value, max)
  );
}

function safeToken(
  value,
  fallback
) {
  const text =
    typeof value === "string"
      ? value
      : fallback;

  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .slice(0, 96) ||
    fallback
  );
}
