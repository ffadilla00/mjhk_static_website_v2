import { DeviceSessionStore } from "./device-session.js";
import { GatewayClient } from "./gateway-client.js";
import { GATEWAY_CONFIG } from "./gateway-config.js";
import { runRevisionSyncNow } from "./revision-sync-startup.js";
import {
  RuntimeCommandDispatcher,
  isBatchFullyAcknowledged,
} from "./runtime-command-dispatcher-core.js";

const DEFAULT_RELOAD_DELAY_MS = 700;

export {
  RuntimeCommandDispatcher,
  isBatchFullyAcknowledged,
};

export function createRuntimeCommandDispatcher({
  presentationBridge,
  gatewayClient = new GatewayClient(),
  sessionStore = new DeviceSessionStore(),
  windowRef = globalThis.window,
  reloadDelayMs = DEFAULT_RELOAD_DELAY_MS,
} = {}) {
  return new RuntimeCommandDispatcher({
    syncNow: async () => {
      const outcome =
        await runRevisionSyncNow({
          presentationBridge,
        });

      const result =
        outcome?.result ?? null;

      const status =
        typeof result?.status === "string"
          ? result.status.toLowerCase()
          : "";

      if (
        status === "success" ||
        status === "noop"
      ) {
        return {
          ok: true,
          reason:
            typeof result?.reason === "string"
              ? result.reason
              : status === "noop"
                ? "already_applied"
                : "revision_sync_completed",
        };
      }

      return {
        ok: false,
        reason:
          typeof result?.reason === "string"
            ? result.reason
            : "revision_sync_failed",
      };
    },

    prepareReloadPlayer: async () => {
      const reload =
        windowRef?.location?.reload;

      if (typeof reload !== "function") {
        return {
          ok: false,
          reason:
            "reload_player_capability_unavailable",
        };
      }

      const delay =
        clampInteger(
          reloadDelayMs,
          250,
          5000,
          DEFAULT_RELOAD_DELAY_MS
        );

      return {
        ok: true,
        reason: "reload_scheduled",
        after_ack: () => {
          windowRef.setTimeout(
            () => {
              windowRef.location.reload();
            },
            delay
          );
        },
      };
    },

    ackCommand: async ({
      commandId,
      status,
      errorMessage,
    }) => {
      const session =
        sessionStore.load();

      if (!session) {
        throw new Error(
          "command_ack_no_device_session"
        );
      }

      return gatewayClient.request(
        GATEWAY_CONFIG.routes.commandAck(
          commandId
        ),
        {
          method: "POST",
          session,
          auth: true,
          body: {
            status,
            ...(status === "failed" &&
            errorMessage
              ? {
                  error_message:
                    String(errorMessage)
                      .slice(0, 240),
                }
              : {}),
          },
        }
      );
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
