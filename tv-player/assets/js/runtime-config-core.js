const MAX_DEPTH = 24;
const MAX_NODES = 20000;
const MAX_ARRAY_LENGTH = 5000;
const MAX_STRING_LENGTH = 100000;
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export class RuntimeConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RuntimeConfigError";
    this.code = code;
  }
}

export function prepareRuntimeConfig(lkgRecord) {
  assertLkgEnvelope(lkgRecord);

  const snapshot = cloneJsonValue(lkgRecord.snapshot);
  validateSnapshot(snapshot);

  const runtime = {
    schema_version: 1,
    revision_id: lkgRecord.revision_id,
    revision_number: lkgRecord.revision_number,
    source: "last-known-good",
    hydrated_at: new Date().toISOString(),
    config: snapshot,
  };

  return deepFreeze(runtime);
}

export function validateSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw new RuntimeConfigError(
      "snapshot_root_invalid",
      "Snapshot root harus plain object."
    );
  }

  let nodes = 0;

  walk(snapshot, 0);

  return {
    ok: true,
    node_count: nodes,
    top_level_keys: Object.keys(snapshot).sort(),
  };

  function walk(value, depth) {
    nodes += 1;

    if (nodes > MAX_NODES) {
      throw new RuntimeConfigError(
        "snapshot_too_complex",
        `Snapshot melebihi ${MAX_NODES} nodes.`
      );
    }

    if (depth > MAX_DEPTH) {
      throw new RuntimeConfigError(
        "snapshot_too_deep",
        `Snapshot melebihi depth ${MAX_DEPTH}.`
      );
    }

    if (value === null) return;

    const type = typeof value;

    if (type === "string") {
      if (value.length > MAX_STRING_LENGTH) {
        throw new RuntimeConfigError(
          "snapshot_string_too_long",
          `String snapshot melebihi ${MAX_STRING_LENGTH} karakter.`
        );
      }
      return;
    }

    if (type === "number") {
      if (!Number.isFinite(value)) {
        throw new RuntimeConfigError(
          "snapshot_number_invalid",
          "Snapshot mengandung angka non-finite."
        );
      }
      return;
    }

    if (type === "boolean") return;

    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_LENGTH) {
        throw new RuntimeConfigError(
          "snapshot_array_too_large",
          `Array snapshot melebihi ${MAX_ARRAY_LENGTH} item.`
        );
      }

      for (const item of value) walk(item, depth + 1);
      return;
    }

    if (!isPlainObject(value)) {
      throw new RuntimeConfigError(
        "snapshot_value_unsupported",
        "Snapshot hanya boleh berisi JSON-compatible values."
      );
    }

    for (const [key, child] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) {
        throw new RuntimeConfigError(
          "snapshot_dangerous_key",
          `Key berbahaya ditolak: ${key}`
        );
      }

      walk(child, depth + 1);
    }
  }
}

export function safeSnapshotShape(snapshot) {
  if (!isPlainObject(snapshot)) {
    return {
      valid_root: false,
      top_level_keys: [],
    };
  }

  return {
    valid_root: true,
    top_level_keys: Object.keys(snapshot).sort(),
  };
}

export function safeRuntimeMeta(runtime) {
  if (!runtime || typeof runtime !== "object") return null;

  return {
    revision_id: runtime.revision_id ?? null,
    revision_number: runtime.revision_number ?? null,
    source: runtime.source ?? null,
    hydrated_at: runtime.hydrated_at ?? null,
    config_present: Boolean(
      runtime.config &&
      typeof runtime.config === "object" &&
      !Array.isArray(runtime.config)
    ),
    top_level_keys:
      runtime.config && isPlainObject(runtime.config)
        ? Object.keys(runtime.config).sort()
        : [],
  };
}

function assertLkgEnvelope(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new RuntimeConfigError(
      "lkg_missing",
      "Last-Known-Good revision tidak tersedia."
    );
  }

  if (record.kind !== "lkg") {
    throw new RuntimeConfigError(
      "lkg_kind_invalid",
      "Runtime config hanya boleh berasal dari LKG."
    );
  }

  if (
    typeof record.revision_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.revision_id)
  ) {
    throw new RuntimeConfigError(
      "lkg_revision_id_invalid",
      "LKG revision_id invalid."
    );
  }

  if (!Number.isInteger(record.revision_number) || record.revision_number < 0) {
    throw new RuntimeConfigError(
      "lkg_revision_number_invalid",
      "LKG revision_number invalid."
    );
  }

  if (!isPlainObject(record.snapshot)) {
    throw new RuntimeConfigError(
      "lkg_snapshot_invalid",
      "LKG snapshot invalid."
    );
  }
}

function cloneJsonValue(value) {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch {
    // Fall through to JSON clone.
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new RuntimeConfigError(
      "snapshot_clone_failed",
      "Snapshot gagal di-clone secara aman."
    );
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
