import { GATEWAY_CONFIG } from "./gateway-config.js";
import { DEVICE_AUTH_CONTRACT } from "./gateway-contract.generated.js";

export class GatewayClient {
  constructor({
    baseUrl = GATEWAY_CONFIG.baseUrl,
    timeoutMs = GATEWAY_CONFIG.requestTimeoutMs,
    fetchImpl = window.fetch.bind(window),
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async health() {
    return this.request(GATEWAY_CONFIG.routes.health, {
      method: "GET",
      auth: false,
    });
  }

  async claimPairing(pairingCode, deviceInfo = {}) {
    const code = String(pairingCode || "").trim();
    if (!code) throw new GatewayContractError("Pairing code wajib diisi.");

    return this.request(GATEWAY_CONFIG.routes.pairClaim, {
      method: "POST",
      auth: false,
      body: {
        pairing_code: code,
        device_info: isPlainObject(deviceInfo) ? deviceInfo : {},
      },
    });
  }

  async bootstrap(session) {
    return this.request(GATEWAY_CONFIG.routes.bootstrap, {
      method: "GET",
      session,
      auth: true,
    });
  }

  async request(path, {
    method = "GET",
    session = null,
    auth = false,
    headers = {},
    body = undefined,
  } = {}) {
    if (auth && !DEVICE_AUTH_CONTRACT.ready) {
      throw new GatewayContractError(
        "Device auth contract belum generated. Jalankan scripts/generate-tv-gateway-contract.mjs."
      );
    }

    const requestHeaders = new Headers(headers);

    if (body !== undefined && !requestHeaders.has("content-type")) {
      requestHeaders.set("content-type", "application/json");
    }

    if (auth) applyDeviceAuth(requestHeaders, session);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = parseMaybeJson(text);

      if (!response.ok) {
        throw new GatewayHttpError(
          `Gateway HTTP ${response.status}`,
          response.status,
          payload
        );
      }

      return {
        status: response.status,
        headers: response.headers,
        data: payload,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export class GatewayHttpError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "GatewayHttpError";
    this.status = status;
    this.payload = payload;
  }
}

export class GatewayContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "GatewayContractError";
  }
}

function applyDeviceAuth(headers, session) {
  if (!session?.deviceCode || !session?.deviceToken) {
    throw new GatewayContractError("Device session tidak tersedia.");
  }

  const {
    deviceCodeHeader,
    deviceTokenHeader,
    tokenScheme,
  } = DEVICE_AUTH_CONTRACT;

  headers.set(deviceCodeHeader, session.deviceCode);

  const tokenValue = tokenScheme === "bearer"
    ? `Bearer ${session.deviceToken}`
    : session.deviceToken;

  headers.set(deviceTokenHeader, tokenValue);
}

function parseMaybeJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
