import { DeviceSessionStore } from "./device-session.js";
import { GatewayClient } from "./gateway-client.js";
import { GATEWAY_CONFIG } from "./gateway-config.js";
import {
  RuntimeCommandPoller,
  normalizeCommand,
  normalizeCommandBatch,
  commandTypes,
} from "./runtime-command-poller-core.js";

export {
  RuntimeCommandPoller,
  normalizeCommand,
  normalizeCommandBatch,
  commandTypes,
};

export function createRuntimeCommandPoller({
  intervalMs = 15_000,
  limit = 5,
  gatewayClient = new GatewayClient(),
  sessionStore = new DeviceSessionStore(),
} = {}) {
  return new RuntimeCommandPoller({
    gatewayClient,
    sessionStore,
    commandsPath:
      GATEWAY_CONFIG.routes.commands,
    intervalMs,
    limit,
  });
}
