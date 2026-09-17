import { GATEWAY_CONFIG } from "./gateway-config.js";
import { DEVICE_AUTH_CONTRACT } from "./gateway-contract.generated.js";
import { DeviceSessionStore } from "./device-session.js";
import { GatewayClient } from "./gateway-client.js";

const refs = {
  gatewayUrl: document.querySelector("#gatewayUrl"),
  contractStatus: document.querySelector("#contractStatus"),
  sessionStatus: document.querySelector("#sessionStatus"),
  healthStatus: document.querySelector("#healthStatus"),
  pairingCode: document.querySelector("#pairingCode"),
  deviceLabel: document.querySelector("#deviceLabel"),
  pairingStatus: document.querySelector("#pairingStatus"),
  bootstrapStatus: document.querySelector("#bootstrapStatus"),
  runHealth: document.querySelector("#runHealth"),
  claimPairing: document.querySelector("#claimPairing"),
  runBootstrap: document.querySelector("#runBootstrap"),
  clearSession: document.querySelector("#clearSession"),
};

const sessionStore = new DeviceSessionStore();
const client = new GatewayClient();

refs.gatewayUrl.textContent = GATEWAY_CONFIG.baseUrl;
renderContract();
renderSession();

refs.runHealth.addEventListener("click", async () => {
  setStatus(refs.healthStatus, "checking", "CHECKING");

  try {
    const result = await client.health();
    setStatus(
      refs.healthStatus,
      "ok",
      `HTTP ${result.status} • ${safeSummary(result.data)}`
    );
  } catch (error) {
    setStatus(refs.healthStatus, "error", safeError(error));
  }
});

refs.claimPairing.addEventListener("click", async () => {
  const pairingCode = refs.pairingCode.value.trim();
  if (!pairingCode) {
    setStatus(refs.pairingStatus, "error", "PAIRING CODE REQUIRED");
    return;
  }

  setStatus(refs.pairingStatus, "checking", "CLAIMING...");
  refs.claimPairing.disabled = true;

  try {
    const result = await client.claimPairing(pairingCode, buildDeviceInfo());
    const credentials = extractPairCredentials(result.data);

    sessionStore.save(credentials);

    // Never keep/display the one-time pairing code after successful claim.
    refs.pairingCode.value = "";

    renderSession();
    setStatus(
      refs.pairingStatus,
      "ok",
      `HTTP ${result.status} • SESSION ENROLLED • ${credentials.deviceCode}`
    );

    setStatus(refs.bootstrapStatus, "idle", "READY");
  } catch (error) {
    setStatus(refs.pairingStatus, "error", safeError(error));
  } finally {
    refs.claimPairing.disabled = false;
  }
});

refs.runBootstrap.addEventListener("click", async () => {
  setStatus(refs.bootstrapStatus, "checking", "CHECKING");

  const session = sessionStore.load();
  if (!session) {
    setStatus(refs.bootstrapStatus, "error", "NO DEVICE SESSION");
    return;
  }

  try {
    const result = await client.bootstrap(session);
    setStatus(
      refs.bootstrapStatus,
      "ok",
      `HTTP ${result.status} • authenticated bootstrap OK • ${safeBootstrapSummary(result.data)}`
    );
  } catch (error) {
    setStatus(refs.bootstrapStatus, "error", safeError(error));
  }
});

refs.clearSession.addEventListener("click", () => {
  sessionStore.clear();
  renderSession();
  setStatus(refs.pairingStatus, "idle", "NOT RUN");
  setStatus(refs.bootstrapStatus, "idle", "NOT RUN");
});

function renderContract() {
  if (DEVICE_AUTH_CONTRACT.ready) {
    refs.contractStatus.textContent =
      `${DEVICE_AUTH_CONTRACT.deviceCodeHeader} + ${DEVICE_AUTH_CONTRACT.deviceTokenHeader}`;
    refs.contractStatus.dataset.state = "ok";
  } else {
    refs.contractStatus.textContent = "PENDING CONTRACT AUDIT";
    refs.contractStatus.dataset.state = "warning";
  }
}

function renderSession() {
  const info = sessionStore.describe();

  if (!info) {
    refs.sessionStatus.textContent = "NO SESSION";
    refs.sessionStatus.dataset.state = "warning";
    refs.runBootstrap.disabled = true;
    return;
  }

  refs.sessionStatus.textContent =
    `${info.deviceCode} • token present [never printed]`;
  refs.sessionStatus.dataset.state = "ok";
  refs.runBootstrap.disabled = !DEVICE_AUTH_CONTRACT.ready;
}

function buildDeviceInfo() {
  const label = refs.deviceLabel.value.trim() || "MJHK Browser Simulator";

  return {
    client: "mjhk-tv-browser-simulator",
    label,
    platform: navigator.platform || "browser",
    user_agent: navigator.userAgent.slice(0, 300),
    language: navigator.language || null,
    screen: {
      width: window.screen?.width || null,
      height: window.screen?.height || null,
      pixel_ratio: window.devicePixelRatio || 1,
    },
  };
}

function extractPairCredentials(payload) {
  const record = unwrapRecord(payload);

  // Phase 2B RPC contract is expected to return the device code plus the
  // one-time raw device token. Accept the canonical snake_case form first;
  // camelCase aliases keep browser diagnostics tolerant to transport mapping.
  const deviceCode =
    record?.device_code ??
    record?.deviceCode ??
    record?.code ??
    null;

  const deviceToken =
    record?.device_token ??
    record?.deviceToken ??
    record?.token ??
    null;

  if (
    typeof deviceCode !== "string" ||
    !deviceCode.trim() ||
    typeof deviceToken !== "string" ||
    !deviceToken.trim()
  ) {
    const keys = record && typeof record === "object"
      ? Object.keys(record).sort().join(", ")
      : typeof record;

    throw new Error(
      `Pairing response tidak memiliki device_code/device_token. Response keys: ${keys || "none"}`
    );
  }

  return {
    deviceCode: deviceCode.trim(),
    deviceToken: deviceToken.trim(),
  };
}

function unwrapRecord(payload) {
  if (Array.isArray(payload)) return payload[0] || null;

  if (
    payload &&
    typeof payload === "object" &&
    payload.data &&
    typeof payload.data === "object"
  ) {
    return Array.isArray(payload.data)
      ? payload.data[0] || null
      : payload.data;
  }

  return payload;
}

function setStatus(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
}

function safeSummary(value) {
  if (!value || typeof value !== "object") return "response OK";

  const summary = {};
  for (const key of ["ok", "service", "version"]) {
    if (key in value) summary[key] = value[key];
  }

  return Object.keys(summary).length
    ? JSON.stringify(summary)
    : "response OK";
}

function safeBootstrapSummary(value) {
  const record = unwrapRecord(value);
  if (!record || typeof record !== "object") return "response OK";

  // Metadata only. Never surface token-like values.
  const keys = [
    "device_code",
    "enabled",
    "desired_revision_id",
    "applied_revision_id",
    "revision_number",
  ];

  const summary = {};
  for (const key of keys) {
    if (key in record) summary[key] = record[key];
  }

  return Object.keys(summary).length
    ? JSON.stringify(summary)
    : "response OK";
}

function safeError(error) {
  if (!error) return "UNKNOWN ERROR";

  const status = Number.isInteger(error.status)
    ? `HTTP ${error.status} • `
    : "";

  const upstreamCode =
    error.payload &&
    typeof error.payload === "object" &&
    typeof error.payload.error === "string"
      ? ` • ${error.payload.error}`
      : "";

  return `${status}${error.name || "Error"}: ${error.message || "request failed"}${upstreamCode}`;
}
