import { DeviceSessionStore } from "./device-session.js";
import { GatewayClient } from "./gateway-client.js";
import { GATEWAY_CONFIG } from "./gateway-config.js";
import {
  RuntimeHeartbeat,
  createBrowserTelemetryProvider,
  sanitizeTelemetry,
} from "./runtime-heartbeat-core.js";

export {
  RuntimeHeartbeat,
  createBrowserTelemetryProvider,
  sanitizeTelemetry,
};

export function createRuntimeHeartbeat({
  presentationBridge,
  intervalMs = 30_000,
  gatewayClient = new GatewayClient(),
  sessionStore = new DeviceSessionStore(),
} = {}) {
  return new RuntimeHeartbeat({
    gatewayClient,
    sessionStore,
    telemetryProvider:
      createBrowserTelemetryProvider({
        presentationBridge,
      }),
    heartbeatPath:
      GATEWAY_CONFIG.routes.heartbeat,
    intervalMs,
  });
}
