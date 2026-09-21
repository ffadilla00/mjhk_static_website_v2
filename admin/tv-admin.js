const db = window.mjhkSupabase;

const $ = (selector) => document.querySelector(selector);

const state = {
  session: null,
  devices: [],
  revisions: [],
  contents: [],
  commands: [],
};

const SAFE_DEVICE_FIELDS = [
  "id",
  "name",
  "device_code",
  "enabled",
  "desired_revision_id",
  "applied_revision_id",
  "last_seen_at",
  "last_sync_at",
  "network_status",
  "app_version",
  "device_model",
  "screen_width",
  "screen_height",
  "is_muted",
  "current_state",
  "current_slide_index",
  "total_slides",
  "remaining_seconds",
  "last_error",
  "last_error_at",
].join(",");

async function requireSession() {
  const {
    data: { session },
    error,
  } = await db.auth.getSession();

  if (error) throw error;

  if (!session) {
    location.href = "login.html";
    return null;
  }

  state.session = session;
  $("#adminIdentity").textContent = `Login sebagai ${session.user.email}`;
  return session;
}

async function loadDashboard() {
  setLoading(true);
  hideBanner("#permissionBanner");
  showStatus("Memuat data MJHK TV…");

  try {
    const [
      devicesResult,
      revisionsResult,
      contentResult,
      commandsResult,
    ] = await Promise.all([
      db
        .from("tv_devices")
        .select(SAFE_DEVICE_FIELDS)
        .order("created_at", { ascending: true }),
      db
        .from("tv_config_revisions")
        .select("id,revision_number,status,created_at,published_at,change_summary")
        .order("revision_number", { ascending: false })
        .limit(8),
      db
        .from("tv_content")
        .select("id,title,content_type,status,updated_at")
        .order("updated_at", { ascending: false })
        .limit(12),
      db
        .from("tv_device_commands")
        .select("id,device_id,command_type,status,delivery_attempts,created_at,delivered_at,completed_at,error_message")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const firstError = [
      devicesResult.error,
      revisionsResult.error,
      contentResult.error,
      commandsResult.error,
    ].find(Boolean);

    if (firstError) throw firstError;

    state.devices = devicesResult.data ?? [];
    state.revisions = revisionsResult.data ?? [];
    state.contents = contentResult.data ?? [];
    state.commands = commandsResult.data ?? [];

    renderMetrics();
    renderDevices();
    renderRevisions();
    renderContents();
    renderCommands();

    showStatus(
      `Dashboard diperbarui ${formatDateTime(new Date().toISOString())}.`,
      "success",
      2600
    );
  } catch (error) {
    console.error("MJHK TV dashboard load failed", safeErrorCode(error));

    const message =
      isPermissionError(error)
        ? "Akun ini tidak memiliki izin admin MJHK TV. Session valid, tetapi RLS menolak akses."
        : `Dashboard TV gagal dimuat: ${safeMessage(error)}`;

    showPermission(message);
    renderLoadFailure();
  } finally {
    setLoading(false);
  }
}

function renderMetrics() {
  const devices = state.devices;
  const online = devices.filter(
    (device) =>
      device.enabled === true &&
      String(device.network_status || "").toLowerCase() === "online"
  );

  const syncEligible = devices.filter(
    (device) => device.desired_revision_id
  );

  const synced = syncEligible.filter(
    (device) =>
      normalizeUuid(device.desired_revision_id) &&
      normalizeUuid(device.desired_revision_id) ===
        normalizeUuid(device.applied_revision_id)
  );

  const latest = state.revisions[0] ?? null;

  $("#metricOnline").textContent = `${online.length}/${devices.length}`;
  $("#metricOnlineMeta").textContent =
    devices.length
      ? `${online.length} device aktif sedang online`
      : "Belum ada device";

  $("#metricSync").textContent =
    `${synced.length}/${syncEligible.length || devices.length || 0}`;
  $("#metricSyncMeta").textContent =
    syncEligible.length
      ? `${synced.length} device sesuai desired revision`
      : "Belum ada desired revision";

  $("#metricRevision").textContent =
    latest ? `#${latest.revision_number}` : "—";
  $("#metricRevisionMeta").textContent =
    latest
      ? `${latest.status} • ${formatDateTime(latest.created_at)}`
      : "Belum ada revision";

  $("#metricContent").textContent =
    String(state.contents.length);
  $("#metricContentMeta").textContent =
    state.contents.length
      ? summarizeContentStatus(state.contents)
      : "Content Library masih kosong";
}

function renderDevices() {
  const tbody = $("#deviceRows");
  tbody.replaceChildren();

  if (!state.devices.length) {
    appendEmptyRow(tbody, 6, "Belum ada device MJHK TV.");
    return;
  }

  for (const device of state.devices) {
    const row = document.createElement("tr");

    const deviceCell = td();
    appendText(deviceCell, device.name || "Unnamed device", "primary-cell");
    appendText(deviceCell, device.device_code || "—", "subtle");

    const statusCell = td();
    statusCell.append(
      badge(
        device.enabled ? device.network_status || "unknown" : "disabled",
        device.enabled
          ? statusClass(device.network_status)
          : "neutral"
      )
    );
    if (!device.enabled) appendText(statusCell, "Device disabled", "subtle");

    const revisionCell = td();
    const synced =
      normalizeUuid(device.desired_revision_id) &&
      normalizeUuid(device.desired_revision_id) ===
        normalizeUuid(device.applied_revision_id);

    revisionCell.append(
      badge(
        synced ? "synced" : "out of sync",
        synced ? "synced" : "warning"
      )
    );
    appendText(
      revisionCell,
      `Desired: ${shortId(device.desired_revision_id)} • Applied: ${shortId(device.applied_revision_id)}`,
      "subtle"
    );

    const runtimeCell = td();
    appendText(runtimeCell, device.current_state || "—", "primary-cell");
    appendText(
      runtimeCell,
      [
        device.app_version || null,
        device.device_model || null,
      ].filter(Boolean).join(" • ") || "Runtime belum melapor",
      "subtle"
    );

    const displayCell = td();
    appendText(
      displayCell,
      device.screen_width && device.screen_height
        ? `${device.screen_width} × ${device.screen_height}`
        : "—",
      "primary-cell"
    );
    appendText(
      displayCell,
      device.total_slides != null
        ? `Slide ${device.current_slide_index ?? "—"} / ${device.total_slides}`
        : "Slide telemetry belum tersedia",
      "subtle"
    );

    const seenCell = td();
    appendText(seenCell, relativeTime(device.last_seen_at), "primary-cell");
    appendText(seenCell, formatDateTime(device.last_seen_at), "subtle");

    row.append(
      deviceCell,
      statusCell,
      revisionCell,
      runtimeCell,
      displayCell,
      seenCell
    );

    tbody.append(row);
  }
}

function renderRevisions() {
  const wrap = $("#revisionList");
  wrap.replaceChildren();

  if (!state.revisions.length) {
    appendEmptyCard(wrap, "Belum ada revision TV.");
    return;
  }

  for (const revision of state.revisions.slice(0, 6)) {
    const item = document.createElement("div");
    item.className = "stack-item";

    const main = document.createElement("div");
    main.className = "stack-main";
    appendText(
      main,
      `Revision #${revision.revision_number}`,
      "primary-cell"
    );
    appendText(
      main,
      summarizeChange(revision.change_summary),
      "subtle"
    );

    const side = document.createElement("div");
    side.className = "stack-side";
    side.append(
      badge(
        revision.status || "unknown",
        statusClass(revision.status)
      )
    );
    appendText(
      side,
      formatDateTime(revision.published_at || revision.created_at),
      "subtle"
    );

    item.append(main, side);
    wrap.append(item);
  }
}

function renderContents() {
  const wrap = $("#contentList");
  wrap.replaceChildren();

  if (!state.contents.length) {
    appendEmptyCard(
      wrap,
      "Content Library masih kosong. Ini expected sebelum Phase 4C."
    );
    return;
  }

  for (const content of state.contents) {
    const item = document.createElement("div");
    item.className = "stack-item";

    const main = document.createElement("div");
    main.className = "stack-main";
    appendText(main, content.title || "Untitled", "primary-cell");
    appendText(
      main,
      `${content.content_type || "unknown"} • ${formatDateTime(content.updated_at)}`,
      "subtle"
    );

    const side = document.createElement("div");
    side.className = "stack-side";
    side.append(
      badge(
        content.status || "unknown",
        statusClass(content.status)
      )
    );

    item.append(main, side);
    wrap.append(item);
  }
}

function renderCommands() {
  const tbody = $("#commandRows");
  tbody.replaceChildren();

  if (!state.commands.length) {
    appendEmptyRow(tbody, 6, "Belum ada command activity.");
    return;
  }

  const deviceMap = new Map(
    state.devices.map((device) => [device.id, device.name])
  );

  for (const command of state.commands) {
    const row = document.createElement("tr");

    const commandCell = td();
    appendText(commandCell, command.command_type || "unknown", "primary-cell");
    appendText(commandCell, shortId(command.id), "subtle");

    const deviceCell = td();
    appendText(
      deviceCell,
      deviceMap.get(command.device_id) || shortId(command.device_id),
      "primary-cell"
    );

    const statusCell = td();
    statusCell.append(
      badge(
        command.status || "unknown",
        statusClass(command.status)
      )
    );
    if (command.error_message) {
      appendText(statusCell, command.error_message, "subtle");
    }

    const attemptsCell = td(String(command.delivery_attempts ?? 0));
    const createdCell = td(formatDateTime(command.created_at));
    const completedCell = td(
      command.completed_at ? formatDateTime(command.completed_at) : "—"
    );

    row.append(
      commandCell,
      deviceCell,
      statusCell,
      attemptsCell,
      createdCell,
      completedCell
    );

    tbody.append(row);
  }
}

function renderLoadFailure() {
  $("#metricOnline").textContent = "—";
  $("#metricSync").textContent = "—";
  $("#metricRevision").textContent = "—";
  $("#metricContent").textContent = "—";
  appendFailureRow("#deviceRows", 6);
  appendFailureCard("#revisionList");
  appendFailureCard("#contentList");
  appendFailureRow("#commandRows", 6);
}

function summarizeContentStatus(items) {
  const counts = new Map();

  for (const item of items) {
    const key = item.status || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => `${count} ${key}`)
    .join(" • ");
}

function summarizeChange(summary) {
  if (!summary || typeof summary !== "object") return "Tidak ada change summary";

  const candidates = [
    summary.purpose,
    summary.message,
    summary.test_harness,
  ];

  const text = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );

  return text ? text.slice(0, 120) : "Change summary tersedia";
}

function badge(label, className = "neutral") {
  const node = document.createElement("span");
  node.className = `badge ${className}`;
  node.textContent = String(label || "unknown");
  return node;
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["online", "done", "published", "synced", "active"].includes(status)) {
    return status === "active" ? "online" : status;
  }

  if (["offline", "failed", "error", "revoked"].includes(status)) {
    return status === "revoked" ? "failed" : status;
  }

  if (["pending", "delivered", "draft", "pairing"].includes(status)) {
    return status;
  }

  return "neutral";
}

function td(textValue = null) {
  const cell = document.createElement("td");
  if (textValue !== null) cell.textContent = textValue;
  return cell;
}

function appendText(parent, value, className = "") {
  const node = document.createElement(className === "primary-cell" ? "strong" : "span");
  if (className) node.className = className;
  node.textContent = value ?? "—";
  parent.append(node);
  return node;
}

function appendEmptyRow(tbody, colspan, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  cell.className = "empty";
  cell.textContent = message;
  row.append(cell);
  tbody.append(row);
}

function appendEmptyCard(parent, message) {
  const node = document.createElement("div");
  node.className = "empty-card";
  node.textContent = message;
  parent.append(node);
}

function appendFailureRow(selector, colspan) {
  const tbody = $(selector);
  tbody.replaceChildren();
  appendEmptyRow(tbody, colspan, "Data gagal dimuat.");
}

function appendFailureCard(selector) {
  const node = $(selector);
  node.replaceChildren();
  appendEmptyCard(node, "Data gagal dimuat.");
}

function showPermission(message) {
  const banner = $("#permissionBanner");
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function showStatus(message, type = "", timeout = 0) {
  const banner = $("#statusBanner");
  banner.textContent = message;
  banner.className = "banner";
  if (type) banner.classList.add(type);
  banner.classList.remove("hidden");

  if (timeout > 0) {
    window.setTimeout(() => {
      banner.classList.add("hidden");
    }, timeout);
  }
}

function hideBanner(selector) {
  $(selector)?.classList.add("hidden");
}

function setLoading(loading) {
  const button = $("#refreshBtn");
  button.disabled = loading;
  button.textContent = loading ? "Memuat..." : "Refresh";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function relativeTime(value) {
  if (!value) return "Belum pernah";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const delta = Date.now() - date.getTime();
  const seconds = Math.round(delta / 1000);

  if (seconds < 45) return "Baru saja";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

function normalizeUuid(value) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function shortId(value) {
  if (!value || typeof value !== "string") return "—";
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function isPermissionError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "42501" ||
    code === "PGRST301" ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

function safeMessage(error) {
  const message = String(error?.message || "unknown_error");
  return message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 240);
}

function safeErrorCode(error) {
  return String(error?.code || error?.name || "dashboard_error")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
}

$("#refreshBtn").addEventListener("click", () => {
  void loadDashboard();
});

$("#logoutBtn").addEventListener("click", async () => {
  const button = $("#logoutBtn");
  button.disabled = true;
  button.textContent = "Logout...";

  try {
    await db.auth.signOut();
  } finally {
    location.href = "login.html";
  }
});

(async () => {
  try {
    const session = await requireSession();
    if (session) await loadDashboard();
  } catch (error) {
    showPermission(`Gagal memuat sesi admin: ${safeMessage(error)}`);
  }
})();
