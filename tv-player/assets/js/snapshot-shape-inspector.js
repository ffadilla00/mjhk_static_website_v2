const MAX_DEPTH = 8;
const MAX_ARRAY_SAMPLE = 3;
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function inspectSnapshotShape(snapshot) {
  if (!isPlainObject(snapshot)) {
    return {
      ok: false,
      error: "snapshot_root_invalid",
      shape: null,
    };
  }

  return {
    ok: true,
    error: null,
    shape: describe(snapshot, 0),
  };
}

export function summarizeTypedContract(snapshot) {
  const result = inspectSnapshotShape(snapshot);

  if (!result.ok) return result;

  const playlist = Array.isArray(snapshot.playlist_items)
    ? inspectArrayContract(snapshot.playlist_items)
    : {
        present: Object.prototype.hasOwnProperty.call(snapshot, "playlist_items"),
        type: typeOf(snapshot.playlist_items),
      };

  const runningText = Object.prototype.hasOwnProperty.call(snapshot, "running_text")
    ? {
        present: true,
        type: typeOf(snapshot.running_text),
        shape: describe(snapshot.running_text, 0),
      }
    : {
        present: false,
        type: "missing",
        shape: null,
      };

  return {
    ok: true,
    error: null,
    top_level_keys: Object.keys(snapshot).sort(),
    playlist_items: playlist,
    running_text: runningText,
  };
}

function inspectArrayContract(items) {
  const itemShapes = [];
  const signatures = new Set();

  for (const item of items.slice(0, MAX_ARRAY_SAMPLE)) {
    const shape = describe(item, 0);
    const signature = signatureOf(shape);

    if (!signatures.has(signature)) {
      signatures.add(signature);
      itemShapes.push(shape);
    }
  }

  return {
    present: true,
    type: "array",
    length: items.length,
    sampled_items: Math.min(items.length, MAX_ARRAY_SAMPLE),
    distinct_sample_shapes: itemShapes,
  };
}

function describe(value, depth) {
  if (depth > MAX_DEPTH) {
    return { type: "max-depth" };
  }

  const type = typeOf(value);

  if (type === "array") {
    const samples = [];
    const seen = new Set();

    for (const item of value.slice(0, MAX_ARRAY_SAMPLE)) {
      const child = describe(item, depth + 1);
      const signature = signatureOf(child);

      if (!seen.has(signature)) {
        seen.add(signature);
        samples.push(child);
      }
    }

    return {
      type: "array",
      length: value.length,
      item_shapes: samples,
    };
  }

  if (type === "object") {
    const fields = {};

    for (const key of Object.keys(value).sort()) {
      if (BLOCKED_KEYS.has(key)) {
        fields[key] = { type: "blocked-key" };
        continue;
      }

      fields[key] = describe(value[key], depth + 1);
    }

    return {
      type: "object",
      fields,
    };
  }

  // Never expose actual values.
  return { type };
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";

  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return Number.isInteger(value) ? "integer" : "number";
    case "boolean":
      return "boolean";
    case "object":
      return isPlainObject(value) ? "object" : "unsupported-object";
    default:
      return typeof value;
  }
}

function signatureOf(value) {
  return stableStringify(value);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
