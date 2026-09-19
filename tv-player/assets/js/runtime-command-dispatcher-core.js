const COMMAND_EVENT = "mjhk:runtime-command-dispatch";

export class RuntimeCommandDispatcher {
  #syncNow;
  #prepareReloadPlayer;
  #ackCommand;
  #inFlight = new Map();

  constructor({
    syncNow,
    prepareReloadPlayer,
    ackCommand,
  } = {}) {
    if (typeof syncNow !== "function") {
      throw new Error("command_dispatcher_sync_now_required");
    }

    if (typeof ackCommand !== "function") {
      throw new Error("command_dispatcher_ack_required");
    }

    this.#syncNow = syncNow;
    this.#prepareReloadPlayer =
      typeof prepareReloadPlayer === "function"
        ? prepareReloadPlayer
        : async () => ({
            ok: false,
            reason:
              "reload_player_capability_unavailable",
          });
    this.#ackCommand = ackCommand;
  }

  async dispatchBatch(commands) {
    const list = Array.isArray(commands)
      ? commands.slice(0, 20)
      : [];

    const results = [];

    for (const command of list) {
      results.push(await this.dispatch(command));
    }

    return Object.freeze(results);
  }

  dispatch(command) {
    const id =
      typeof command?.id === "string"
        ? command.id
        : null;

    if (!id) {
      return Promise.resolve(
        freezeResult({
          command_id: null,
          command_type: null,
          status: "rejected",
          reason: "command_id_missing",
          acknowledged: false,
          post_ack_scheduled: false,
        })
      );
    }

    if (this.#inFlight.has(id)) {
      return this.#inFlight.get(id);
    }

    const promise =
      this.#run(command)
        .finally(() => {
          this.#inFlight.delete(id);
        });

    this.#inFlight.set(id, promise);
    return promise;
  }

  async #run(command) {
    const commandType =
      typeof command.command_type === "string"
        ? command.command_type
        : "";

    let execution;

    if (commandType === "sync_now") {
      execution = await executeSafely(
        () => this.#syncNow(command)
      );
    } else if (commandType === "reload_player") {
      execution = await preparePostAckSafely(
        () => this.#prepareReloadPlayer(command)
      );
    } else {
      execution = Object.freeze({
        ok: false,
        reason: "command_capability_unavailable",
        after_ack: null,
      });
    }

    const ackStatus =
      execution.ok ? "done" : "failed";

    const errorMessage =
      execution.ok
        ? null
        : safeReason(
            execution.reason,
            "command_failed"
          );

    try {
      await this.#ackCommand({
        commandId: command.id,
        status: ackStatus,
        errorMessage,
      });

      let postAckScheduled = false;

      if (
        execution.ok &&
        typeof execution.after_ack === "function"
      ) {
        try {
          execution.after_ack();
          postAckScheduled = true;
        } catch {
          // Command is already ACKed done at this point.
          // The adapter must make after_ack a safe scheduling operation.
          postAckScheduled = false;
        }
      }

      const result = freezeResult({
        command_id: command.id,
        command_type: commandType,
        status:
          execution.ok
            ? "done"
            : "failed",
        reason:
          safeReason(
            execution.reason,
            execution.ok
              ? "command_completed"
              : "command_failed"
          ),
        acknowledged: true,
        post_ack_scheduled: postAckScheduled,
      });

      publishCommandDispatchEvent(result);
      return result;
    } catch (error) {
      const result = freezeResult({
        command_id: command.id,
        command_type: commandType,
        status: "ack_failed",
        reason: safeErrorCode(error),
        acknowledged: false,
        post_ack_scheduled: false,
      });

      publishCommandDispatchEvent(result);
      return result;
    }
  }
}

export function isBatchFullyAcknowledged(results) {
  return (
    Array.isArray(results) &&
    results.length > 0 &&
    results.every(
      (item) => item?.acknowledged === true
    )
  );
}

async function executeSafely(fn) {
  try {
    const result = await fn();

    if (
      result &&
      typeof result === "object" &&
      result.ok === true
    ) {
      return Object.freeze({
        ok: true,
        reason:
          safeReason(
            result.reason,
            "command_completed"
          ),
        after_ack: null,
      });
    }

    return Object.freeze({
      ok: false,
      reason:
        safeReason(
          result?.reason,
          "command_execution_failed"
        ),
      after_ack: null,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      reason: safeErrorCode(error),
      after_ack: null,
    });
  }
}

async function preparePostAckSafely(fn) {
  try {
    const result = await fn();

    if (
      result &&
      typeof result === "object" &&
      result.ok === true &&
      typeof result.after_ack === "function"
    ) {
      return Object.freeze({
        ok: true,
        reason:
          safeReason(
            result.reason,
            "post_ack_action_ready"
          ),
        after_ack: result.after_ack,
      });
    }

    return Object.freeze({
      ok: false,
      reason:
        safeReason(
          result?.reason,
          "post_ack_action_unavailable"
        ),
      after_ack: null,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      reason: safeErrorCode(error),
      after_ack: null,
    });
  }
}

function publishCommandDispatchEvent(result) {
  const root = globalThis.document?.documentElement;

  if (root?.dataset) {
    root.dataset.runtimeCommandDispatchStatus =
      safeToken(result.status, "unknown");
    root.dataset.runtimeCommandDispatchReason =
      safeToken(result.reason, "unknown");
    root.dataset.runtimeCommandPostAckScheduled =
      result.post_ack_scheduled
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
      return safeToken(
        value,
        "command_ack_failed"
      );
    }
  }

  return "command_ack_failed";
}

function safeReason(value, fallback) {
  return safeToken(
    typeof value === "string"
      ? value
      : fallback,
    fallback
  ).slice(0, 240);
}

function safeToken(value, fallback) {
  const text =
    typeof value === "string"
      ? value
      : fallback;

  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .slice(0, 240) ||
    fallback
  );
}
