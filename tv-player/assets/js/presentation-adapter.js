const PLAYLIST_TYPES = Object.freeze([
  "image",
  "text",
  "image_text",
]);

const LOCKED_STATES = Object.freeze([
  "NORMAL",
  "PRE_ADHAN",
  "ADHAN",
  "IQAMAH_COUNTDOWN",
  "IQAMAH",
  "SALAT",
  "PRAYER_PROHIBITION",
  "SYURUQ",
  "ISYRAQ",
  "IMSAK",
  "FRIDAY_PRE_ADHAN",
  "FRIDAY_KHUTBAH",
  "FRIDAY_SALAT",
]);

const MAX_PLAYLIST_ITEMS = 200;
const MAX_RUNNING_TEXT_ITEMS = 100;
const MIN_DURATION_SECONDS = 3;
const MAX_DURATION_SECONDS = 300;
const MAX_ID_LENGTH = 120;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 1000;
const MAX_HEADING_LENGTH = 300;
const MAX_BODY_LENGTH = 4000;

export class PresentationAdapterError extends Error {
  constructor(code, message, path = null) {
    super(message);
    this.name = "PresentationAdapterError";
    this.code = code;
    this.path = path;
  }
}

export function adaptPresentationConfig(runtimeConfig) {
  assertRuntimeEnvelope(runtimeConfig);

  const snapshot = runtimeConfig.config;

  if (!Array.isArray(snapshot.playlist_items)) {
    throw new PresentationAdapterError(
      "playlist_items_invalid",
      "playlist_items harus array.",
      "playlist_items"
    );
  }

  if (!Array.isArray(snapshot.running_text)) {
    throw new PresentationAdapterError(
      "running_text_invalid",
      "running_text harus array.",
      "running_text"
    );
  }

  if (snapshot.playlist_items.length > MAX_PLAYLIST_ITEMS) {
    throw new PresentationAdapterError(
      "playlist_items_too_many",
      `playlist_items melebihi ${MAX_PLAYLIST_ITEMS}.`,
      "playlist_items"
    );
  }

  if (snapshot.running_text.length > MAX_RUNNING_TEXT_ITEMS) {
    throw new PresentationAdapterError(
      "running_text_too_many",
      `running_text melebihi ${MAX_RUNNING_TEXT_ITEMS}.`,
      "running_text"
    );
  }

  const playlistItems = snapshot.playlist_items.map((item, index) =>
    adaptPlaylistItem(item, index)
  );

  const runningText = snapshot.running_text.map((item, index) =>
    adaptRunningText(item, index)
  );

  const output = {
    schema_version: 1,
    revision_id: runtimeConfig.revision_id,
    revision_number: runtimeConfig.revision_number,
    source: "typed-presentation-adapter",
    adapted_at: new Date().toISOString(),
    playlist_items: playlistItems,
    running_text: runningText,
  };

  return deepFreeze(output);
}

export function safePresentationMeta(config) {
  if (!config || typeof config !== "object") return null;

  const typeCounts = {};
  for (const item of config.playlist_items || []) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  }

  const scopes = new Set();
  for (const item of config.running_text || []) {
    for (const state of item.state_scope || []) scopes.add(state);
  }

  return {
    revision_id: config.revision_id ?? null,
    revision_number: config.revision_number ?? null,
    source: config.source ?? null,
    playlist_count: Array.isArray(config.playlist_items)
      ? config.playlist_items.length
      : 0,
    playlist_type_counts: typeCounts,
    running_text_count: Array.isArray(config.running_text)
      ? config.running_text.length
      : 0,
    running_text_state_scopes: [...scopes].sort(),
    frozen: Object.isFrozen(config),
  };
}

export function getPresentationContract() {
  return {
    playlist_types: [...PLAYLIST_TYPES],
    locked_states: [...LOCKED_STATES],
    duration_seconds: {
      min: MIN_DURATION_SECONDS,
      max: MAX_DURATION_SECONDS,
    },
    limits: {
      playlist_items: MAX_PLAYLIST_ITEMS,
      running_text: MAX_RUNNING_TEXT_ITEMS,
    },
  };
}

function adaptPlaylistItem(item, index) {
  const path = `playlist_items[${index}]`;

  assertPlainObject(item, path);

  const id = requireString(item.id, `${path}.id`, MAX_ID_LENGTH);
  const type = requireString(item.type, `${path}.type`, 40);

  if (!PLAYLIST_TYPES.includes(type)) {
    throw new PresentationAdapterError(
      "playlist_type_unsupported",
      `Playlist type tidak didukung: ${type}`,
      `${path}.type`
    );
  }

  const title = requireString(item.title, `${path}.title`, MAX_TITLE_LENGTH);
  const durationSeconds = requireIntegerRange(
    item.duration_seconds,
    `${path}.duration_seconds`,
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS
  );
  const fullscreen = requireBoolean(item.fullscreen, `${path}.fullscreen`);
  const alwaysShow = requireBoolean(item.always_show, `${path}.always_show`);
  const startsAt = normalizeNullableIso(item.starts_at, `${path}.starts_at`);
  const endsAt = normalizeNullableIso(item.ends_at, `${path}.ends_at`);
  assertDateWindow(startsAt, endsAt, path);

  const payload = adaptPayload(type, item.payload, `${path}.payload`);

  return {
    id,
    type,
    title,
    duration_seconds: durationSeconds,
    fullscreen,
    always_show: alwaysShow,
    starts_at: startsAt,
    ends_at: endsAt,
    payload,
  };
}

function adaptPayload(type, payload, path) {
  assertPlainObject(payload, path);

  if (type === "image") {
    return {
      image_url: requireHttpsUrl(payload.image_url, `${path}.image_url`),
      alt_text: requireString(payload.alt_text, `${path}.alt_text`, MAX_TITLE_LENGTH),
    };
  }

  if (type === "text") {
    const heading = requireString(payload.heading, `${path}.heading`, MAX_HEADING_LENGTH);
    const body = requireString(payload.body, `${path}.body`, MAX_BODY_LENGTH);

    if (!heading && !body) {
      throw new PresentationAdapterError(
        "text_payload_empty",
        "Text payload membutuhkan heading atau body.",
        path
      );
    }

    return { heading, body };
  }

  if (type === "image_text") {
    const imageUrl = requireHttpsUrl(payload.image_url, `${path}.image_url`);
    const heading = requireString(payload.heading, `${path}.heading`, MAX_HEADING_LENGTH);
    const body = requireString(payload.body, `${path}.body`, MAX_BODY_LENGTH);

    if (!heading && !body) {
      throw new PresentationAdapterError(
        "image_text_payload_empty",
        "Image+text payload membutuhkan heading atau body.",
        path
      );
    }

    return {
      image_url: imageUrl,
      heading,
      body,
    };
  }

  throw new PresentationAdapterError(
    "playlist_type_unsupported",
    `Playlist type tidak didukung: ${type}`,
    path
  );
}

function adaptRunningText(item, index) {
  const path = `running_text[${index}]`;

  assertPlainObject(item, path);

  const id = requireString(item.id, `${path}.id`, MAX_ID_LENGTH);
  const text = requireString(item.text, `${path}.text`, MAX_TEXT_LENGTH);

  if (!text) {
    throw new PresentationAdapterError(
      "running_text_empty",
      "Running text tidak boleh kosong.",
      `${path}.text`
    );
  }

  const enabled = requireBoolean(item.enabled, `${path}.enabled`);
  const priority = requireIntegerRange(
    item.priority,
    `${path}.priority`,
    -1000,
    1000
  );
  const startsAt = normalizeNullableIso(item.starts_at, `${path}.starts_at`);
  const endsAt = normalizeNullableIso(item.ends_at, `${path}.ends_at`);
  assertDateWindow(startsAt, endsAt, path);

  if (!Array.isArray(item.state_scope)) {
    throw new PresentationAdapterError(
      "state_scope_invalid",
      "state_scope harus array.",
      `${path}.state_scope`
    );
  }

  const stateScope = [...new Set(item.state_scope.map((state, stateIndex) => {
    const normalized = requireString(
      state,
      `${path}.state_scope[${stateIndex}]`,
      60
    );

    if (!LOCKED_STATES.includes(normalized)) {
      throw new PresentationAdapterError(
        "state_scope_unsupported",
        `State tidak dikenal: ${normalized}`,
        `${path}.state_scope[${stateIndex}]`
      );
    }

    return normalized;
  }))];

  if (stateScope.length === 0) {
    throw new PresentationAdapterError(
      "state_scope_empty",
      "state_scope minimal berisi satu state.",
      `${path}.state_scope`
    );
  }

  return {
    id,
    text,
    enabled,
    priority,
    starts_at: startsAt,
    ends_at: endsAt,
    state_scope: stateScope,
  };
}

function assertRuntimeEnvelope(runtime) {
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
    throw new PresentationAdapterError(
      "runtime_config_missing",
      "Runtime config tidak tersedia."
    );
  }

  if (
    typeof runtime.revision_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runtime.revision_id)
  ) {
    throw new PresentationAdapterError(
      "runtime_revision_id_invalid",
      "Runtime revision_id invalid."
    );
  }

  if (!Number.isInteger(runtime.revision_number) || runtime.revision_number < 0) {
    throw new PresentationAdapterError(
      "runtime_revision_number_invalid",
      "Runtime revision_number invalid."
    );
  }

  assertPlainObject(runtime.config, "config");
}

function assertPlainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PresentationAdapterError(
      "object_required",
      `${path} harus object.`,
      path
    );
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new PresentationAdapterError(
      "plain_object_required",
      `${path} harus plain object.`,
      path
    );
  }
}

function requireString(value, path, maxLength) {
  if (typeof value !== "string") {
    throw new PresentationAdapterError(
      "string_required",
      `${path} harus string.`,
      path
    );
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new PresentationAdapterError(
      "string_too_long",
      `${path} terlalu panjang.`,
      path
    );
  }

  return normalized;
}

function requireBoolean(value, path) {
  if (typeof value !== "boolean") {
    throw new PresentationAdapterError(
      "boolean_required",
      `${path} harus boolean.`,
      path
    );
  }
  return value;
}

function requireIntegerRange(value, path, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new PresentationAdapterError(
      "integer_out_of_range",
      `${path} harus integer ${min}..${max}.`,
      path
    );
  }
  return value;
}

function normalizeNullableIso(value, path) {
  if (value === null) return null;

  if (typeof value !== "string" || !value.trim()) {
    throw new PresentationAdapterError(
      "datetime_invalid",
      `${path} harus null atau ISO datetime string.`,
      path
    );
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new PresentationAdapterError(
      "datetime_invalid",
      `${path} bukan datetime valid.`,
      path
    );
  }

  return new Date(timestamp).toISOString();
}

function assertDateWindow(startsAt, endsAt, path) {
  if (!startsAt || !endsAt) return;

  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new PresentationAdapterError(
      "datetime_window_invalid",
      `${path}: ends_at harus sesudah starts_at.`,
      path
    );
  }
}

function requireHttpsUrl(value, path) {
  const raw = requireString(value, path, 2048);

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new PresentationAdapterError(
      "url_invalid",
      `${path} bukan URL valid.`,
      path
    );
  }

  if (url.protocol !== "https:") {
    throw new PresentationAdapterError(
      "url_https_required",
      `${path} wajib HTTPS.`,
      path
    );
  }

  return url.toString();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;

  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
