import {
  isBatchFullyAcknowledged,
} from "./runtime-command-dispatcher-core.js";

const POLL_EVENT = "mjhk:runtime-command-poll";
const DEFAULT_RETRY_BACKOFF_MS =
  Object.freeze([5000, 15000, 60000, 120000]);

export function attachRuntimeCommandCoordinator({
  poller,
  dispatcher,
  windowRef = globalThis.window,
  retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS,
} = {}) {
  if (
    !poller ||
    typeof poller.releaseHold !== "function"
  ) {
    throw new Error(
      "command_coordinator_poller_required"
    );
  }

  if (
    !dispatcher ||
    typeof dispatcher.dispatchBatch !== "function"
  ) {
    throw new Error(
      "command_coordinator_dispatcher_required"
    );
  }

  const backoff =
    normalizeBackoff(retryBackoffMs);

  let processing = false;
  let stopped = false;
  let heldBatch = null;
  let retryTimer = null;
  let retryAttempt = 0;

  const clearRetryTimer = () => {
    if (retryTimer !== null) {
      windowRef.clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const publishRecovery = (
    status,
    reason
  ) => {
    const root =
      globalThis.document?.documentElement;

    if (root?.dataset) {
      root.dataset.runtimeCommandRecoveryStatus =
        safeToken(status, "unknown");
      root.dataset.runtimeCommandRecoveryReason =
        safeToken(reason, "unknown");
      root.dataset.runtimeCommandRecoveryAttempt =
        String(retryAttempt);
    }
  };

  const scheduleRetry = () => {
    if (
      stopped ||
      processing ||
      !heldBatch ||
      retryTimer !== null
    ) {
      return;
    }

    const index =
      Math.min(
        retryAttempt,
        backoff.length - 1
      );

    const delay = backoff[index];
    retryAttempt += 1;

    publishRecovery(
      "waiting",
      "command_ack_retry_scheduled"
    );

    retryTimer =
      windowRef.setTimeout(() => {
        retryTimer = null;
        void processHeldBatch();
      }, delay);
  };

  const processHeldBatch = async () => {
    if (
      stopped ||
      processing ||
      !heldBatch
    ) {
      return;
    }

    processing = true;
    clearRetryTimer();

    try {
      const results =
        await dispatcher.dispatchBatch(
          heldBatch
        );

      if (
        isBatchFullyAcknowledged(
          results
        )
      ) {
        heldBatch = null;
        retryAttempt = 0;

        publishRecovery(
          "recovered",
          "command_batch_acknowledged"
        );

        poller.releaseHold({
          immediate: false,
        });
      } else {
        publishRecovery(
          "degraded",
          "command_batch_ack_pending"
        );

        scheduleRetry();
      }
    } finally {
      processing = false;

      if (
        !stopped &&
        heldBatch &&
        retryTimer === null
      ) {
        scheduleRetry();
      }
    }
  };

  const onPoll = (event) => {
    if (stopped) return;

    const detail = event?.detail;

    if (
      detail?.status !== "batch_received" ||
      !Array.isArray(detail.commands) ||
      detail.commands.length === 0
    ) {
      return;
    }

    if (!heldBatch) {
      heldBatch =
        Object.freeze(
          detail.commands.slice(0, 20)
        );
      retryAttempt = 0;
    }

    void processHeldBatch();
  };

  windowRef.addEventListener(
    POLL_EVENT,
    onPoll
  );

  return Object.freeze({
    retryNow() {
      if (
        stopped ||
        !heldBatch
      ) {
        return false;
      }

      clearRetryTimer();

      publishRecovery(
        "retrying",
        "command_ack_retry_now"
      );

      void processHeldBatch();
      return true;
    },

    meta() {
      return Object.freeze({
        processing,
        has_held_batch:
          Boolean(heldBatch),
        retry_attempt:
          retryAttempt,
        retry_scheduled:
          retryTimer !== null,
      });
    },

    stop() {
      stopped = true;
      clearRetryTimer();
      windowRef.removeEventListener(
        POLL_EVENT,
        onPoll
      );
    },
  });
}

function normalizeBackoff(values) {
  const clean =
    Array.isArray(values)
      ? values
          .filter(
            (value) =>
              Number.isInteger(value) &&
              value >= 10 &&
              value <= 300000
          )
          .slice(0, 8)
      : [];

  return Object.freeze(
    clean.length
      ? clean
      : [...DEFAULT_RETRY_BACKOFF_MS]
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
