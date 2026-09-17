import { GATEWAY_CONFIG } from "./gateway-config.js";
import { GatewayClient } from "./gateway-client.js";

export class RevisionClient {
  constructor(gatewayClient = new GatewayClient()) {
    this.gateway = gatewayClient;
  }

  async fetchDesiredRevision(session) {
    const boot = await this.gateway.bootstrap(session);
    const bootRecord = unwrapRecord(boot.data);

    const desiredRevisionId =
      bootRecord?.desired_revision_id ??
      bootRecord?.desiredRevisionId ??
      null;

    if (!isUuid(desiredRevisionId)) {
      throw new RevisionContractError(
        "Bootstrap tidak memiliki desired_revision_id UUID yang valid."
      );
    }

    const revision = await this.gateway.request(
      GATEWAY_CONFIG.routes.revisionById(desiredRevisionId),
      {
        method: "GET",
        session,
        auth: true,
      }
    );

    return {
      bootstrap: bootRecord,
      desiredRevisionId,
      response: revision,
    };
  }
}

export class RevisionContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "RevisionContractError";
  }
}

export function unwrapRecord(payload) {
  if (Array.isArray(payload)) return payload[0] ?? null;

  if (
    payload &&
    typeof payload === "object" &&
    payload.data &&
    typeof payload.data === "object"
  ) {
    return Array.isArray(payload.data)
      ? payload.data[0] ?? null
      : payload.data;
  }

  return payload;
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
