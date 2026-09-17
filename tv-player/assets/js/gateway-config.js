export const GATEWAY_CONFIG = Object.freeze({
  baseUrl: "https://mjhk-tv-gateway.ffadilla-90.workers.dev",

  routes: Object.freeze({
    health: "/health",
    pairClaim: "/v1/pair/claim",
    bootstrap: "/v1/device/bootstrap",
    heartbeat: "/v1/device/heartbeat",
    revisionCurrent: "/v1/device/revision",
    revisionById: (revisionId) => `/v1/device/revision/${encodeURIComponent(revisionId)}`,
    revisionAck: "/v1/device/revision/ack",
    commands: "/v1/device/commands",
    commandAck: (commandId) => `/v1/device/commands/${encodeURIComponent(commandId)}/ack`,
    screenshot: "/v1/device/screenshot",
    media: (contentId) => `/v1/device/media/${encodeURIComponent(contentId)}`,
  }),

  requestTimeoutMs: 12000,
});
