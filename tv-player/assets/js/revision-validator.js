import { unwrapRecord } from "./revision-client.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONFIG_FIELDS = [
  "config",
  "payload",
  "snapshot",
  "config_json",
  "revision_payload",
  "config_snapshot",
];

export function validateRevisionPayload(payload, expectedRevisionId) {
  const record = unwrapRecord(payload);

  const result = {
    ok: false,
    transportValid: false,
    identityValid: false,
    revisionNumberValid: false,
    configField: null,
    configPresent: false,
    revisionId: null,
    revisionNumber: null,
    keys: [],
    warnings: [],
    errors: [],
  };

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    result.errors.push("revision_response_not_object");
    return result;
  }

  result.transportValid = true;
  result.keys = Object.keys(record).sort();

  const revisionId =
    record.id ??
    record.revision_id ??
    record.revisionId ??
    null;

  result.revisionId = typeof revisionId === "string" ? revisionId : null;

  if (!UUID_RE.test(String(revisionId || ""))) {
    result.errors.push("revision_id_missing_or_invalid");
  } else if (
    expectedRevisionId &&
    String(revisionId).toLowerCase() !== String(expectedRevisionId).toLowerCase()
  ) {
    result.errors.push("revision_id_mismatch");
  } else {
    result.identityValid = true;
  }

  const revisionNumber =
    record.revision_number ??
    record.revisionNumber ??
    record.version ??
    null;

  result.revisionNumber = revisionNumber;

  if (
    (typeof revisionNumber === "number" && Number.isInteger(revisionNumber) && revisionNumber >= 0) ||
    (typeof revisionNumber === "string" && /^\d+$/.test(revisionNumber))
  ) {
    result.revisionNumberValid = true;
  } else {
    result.warnings.push("revision_number_not_detected");
  }

  for (const field of CONFIG_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(record, field) &&
      record[field] &&
      typeof record[field] === "object" &&
      !Array.isArray(record[field])
    ) {
      result.configField = field;
      result.configPresent = true;
      break;
    }
  }

  if (!result.configPresent) {
    result.warnings.push("config_field_not_detected_yet");
  }

  // 3B.2A is intentionally transport/identity validation only.
  // Config hydration is deferred until the actual RPC response shape is confirmed.
  result.ok =
    result.transportValid &&
    result.identityValid &&
    result.errors.length === 0;

  return result;
}

export function safeRevisionSummary(validation) {
  return {
    ok: validation.ok,
    revision_id: validation.revisionId,
    revision_number: validation.revisionNumber,
    config_field: validation.configField,
    config_present: validation.configPresent,
    response_keys: validation.keys,
    warnings: validation.warnings,
    errors: validation.errors,
  };
}
