const db = window.mjhkSupabase;

const STATE_SCOPE_VALUES = Object.freeze([
  "NORMAL","PRE_ADHAN","ADHAN","IQAMAH_COUNTDOWN","IQAMAH","SALAT",
  "PRAYER_PROHIBITION","SYURUQ","ISYRAQ","IMSAK",
  "FRIDAY_PRE_ADHAN","FRIDAY_KHUTBAH","FRIDAY_SALAT"
]);

const WEEKDAYS = Object.freeze([
  { value: 0, label: "Ahad" },
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" }
]);

const DEFAULT_WEEKDAYS = Object.freeze(WEEKDAYS.map(day => day.value));
const $ = selector => document.querySelector(selector);

const state = {
  session: null,
  items: [],
  editing: null,
  deleting: null
};

async function requireSession() {
  const { data: { session }, error } = await db.auth.getSession();
  if (error) throw error;
  if (!session) {
    location.href = "login.html";
    return null;
  }
  state.session = session;
  $("#adminIdentity").textContent = `Login sebagai ${session.user.email}`;
  return session;
}

function buildOptions() {
  const stateWrap = $("#stateScopeOptions");
  const weekdayWrap = $("#weekdayOptions");
  stateWrap.replaceChildren();
  weekdayWrap.replaceChildren();

  for (const code of STATE_SCOPE_VALUES) {
    stateWrap.append(makeCheckOption("stateScope", code, code, code === "NORMAL"));
  }
  for (const day of WEEKDAYS) {
    weekdayWrap.append(makeCheckOption("weekday", String(day.value), day.label, true));
  }
}

function makeCheckOption(name, value, label, checked) {
  const wrapper = document.createElement("label");
  wrapper.className = "check-option";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = value;
  input.checked = checked;

  const text = document.createElement("span");
  text.textContent = label;

  wrapper.append(input, text);
  return wrapper;
}

async function loadItems() {
  setLoading(true);
  hide("#permissionBanner");

  try {
    const { data, error } = await db
      .from("tv_running_text")
      .select("id,text_content,sort_order,priority,active,starts_at,ends_at,weekdays,state_scope,created_at,updated_at")
      .order("priority", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    state.items = (data ?? []).map(normalizeItem);
    renderItems();
    renderTickerPreview();

    showStatus(
      `Running Text diperbarui ${formatDateTime(new Date().toISOString())}.`,
      "success",
      2200
    );
  } catch (error) {
    console.error("MJHK TV running text load failed", safeErrorCode(error));

    const message = String(error?.message || "").toLowerCase();
    if (isPermissionError(error)) {
      showPermission(
        "Session valid, tetapi RLS menolak akses ke tv_running_text. Pastikan akun memiliki hak is_mjhk_admin()."
      );
    } else if (message.includes("state_scope")) {
      showPermission(
        "Kolom state_scope belum tersedia. Jalankan migration Phase 4C-B terlebih dahulu."
      );
    } else {
      showPermission(`Running Text gagal dimuat: ${safeMessage(error)}`);
    }
  } finally {
    setLoading(false);
  }
}

function normalizeItem(item) {
  const scope =
    Array.isArray(item.state_scope) && item.state_scope.length
      ? item.state_scope.filter(value => STATE_SCOPE_VALUES.includes(value))
      : ["NORMAL"];

  const weekdays =
    Array.isArray(item.weekdays) && item.weekdays.length
      ? item.weekdays
          .map(Number)
          .filter(value => DEFAULT_WEEKDAYS.includes(value))
      : [...DEFAULT_WEEKDAYS];

  return Object.freeze({
    ...item,
    state_scope: [...new Set(scope)],
    weekdays: [...new Set(weekdays)]
  });
}

function renderItems() {
  const wrap = $("#runningList");
  wrap.replaceChildren();

  const activeFilter = $("#activeFilter").value;
  const stateFilter = $("#stateFilter").value;

  const filtered = state.items.filter(item => {
    if (activeFilter === "active" && !item.active) return false;
    if (activeFilter === "inactive" && item.active) return false;
    if (stateFilter && !item.state_scope.includes(stateFilter)) return false;
    return true;
  });

  $("#runningSummary").textContent =
    `${filtered.length} dari ${state.items.length} running text`;

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-card";
    empty.textContent = state.items.length
      ? "Tidak ada running text sesuai filter."
      : "Belum ada running text. Klik “+ Running Text” untuk membuat yang pertama.";
    wrap.append(empty);
    return;
  }

  for (const item of filtered) wrap.append(renderItem(item));
}

function renderItem(item) {
  const row = document.createElement("article");
  row.className = "running-item";
  row.tabIndex = 0;
  row.dataset.runningId = item.id;

  const copy = document.createElement("div");
  copy.className = "running-copy";

  const text = document.createElement("strong");
  text.textContent = item.text_content;

  const detail = document.createElement("p");
  detail.textContent = [
    scheduleLabel(item),
    weekdayLabel(item.weekdays),
    `State: ${item.state_scope.join(", ")}`
  ].join(" • ");

  copy.append(text, detail);

  const meta = document.createElement("div");
  meta.className = "running-meta";

  const badges = document.createElement("div");
  badges.className = "meta-row";
  badges.append(
    badge(item.active ? "aktif" : "nonaktif", item.active ? "online" : "neutral"),
    badge(`priority ${item.priority}`, "neutral"),
    badge(`urutan ${item.sort_order}`, "neutral")
  );

  const updated = document.createElement("span");
  updated.className = "meta-note";
  updated.textContent = `Update ${formatDateTime(item.updated_at)}`;

  meta.append(badges, updated);
  row.append(copy, meta);

  row.addEventListener("click", () => openEditor(item));
  row.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEditor(item);
    }
  });

  return row;
}

function renderTickerPreview() {
  const now = new Date();
  const today = now.getDay();

  const eligible = state.items.filter(item => {
    if (!item.active) return false;
    if (!item.weekdays.includes(today)) return false;
    if (item.starts_at && new Date(item.starts_at) > now) return false;
    if (item.ends_at && new Date(item.ends_at) <= now) return false;
    return item.state_scope.includes("NORMAL");
  });

  $("#tickerPreviewText").textContent = eligible.length
    ? eligible.map(item => item.text_content).join("   •   ")
    : "Tidak ada running text NORMAL yang aktif untuk waktu sekarang.";
}

function openEditor(item = null) {
  state.editing = item;

  $("#editorTitle").textContent = item ? "Edit Running Text" : "Running Text Baru";
  $("#runningId").value = item?.id || "";
  $("#textInput").value = item?.text_content || "";
  $("#priorityInput").value = item?.priority ?? 20;
  $("#sortOrderInput").value = item?.sort_order ?? 100;
  $("#activeInput").checked = item?.active !== false;
  $("#startsAtInput").value = toLocalDateTime(item?.starts_at);
  $("#endsAtInput").value = toLocalDateTime(item?.ends_at);

  setCheckedValues("stateScope", item?.state_scope || ["NORMAL"]);
  setCheckedValues(
    "weekday",
    (item?.weekdays || DEFAULT_WEEKDAYS).map(String)
  );

  $("#charCount").textContent = String($("#textInput").value.length);
  $("#deleteBtn").classList.toggle("hidden", !item);

  hide("#formError");
  $("#editorDialog").showModal();
}

function setCheckedValues(name, values) {
  const allow = new Set(values.map(String));
  document
    .querySelectorAll(`input[name="${name}"]`)
    .forEach(input => {
      input.checked = allow.has(input.value);
    });
}

async function saveEditor(event) {
  event.preventDefault();
  hide("#formError");

  let payload;
  try {
    payload = buildPayload();
  } catch (error) {
    showFormError(error.message);
    return;
  }

  const button = $("#saveBtn");
  button.disabled = true;
  button.textContent = "Menyimpan...";

  try {
    const result = state.editing
      ? await db
          .from("tv_running_text")
          .update(payload)
          .eq("id", state.editing.id)
          .select("id")
          .single()
      : await db
          .from("tv_running_text")
          .insert(payload)
          .select("id")
          .single();

    if (result.error) throw result.error;

    $("#editorDialog").close();
    showStatus(
      state.editing
        ? "Running text berhasil diperbarui."
        : "Running text berhasil dibuat.",
      "success",
      2600
    );

    state.editing = null;
    await loadItems();
  } catch (error) {
    console.error("MJHK TV running text save failed", safeErrorCode(error));
    showFormError(safeMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = "Simpan";
  }
}

function buildPayload() {
  const text = $("#textInput").value.trim();
  const priority = Number.parseInt($("#priorityInput").value, 10);
  const sortOrder = Number.parseInt($("#sortOrderInput").value, 10);

  if (!text) throw new Error("Teks wajib diisi.");
  if (text.length > 500) throw new Error("Teks maksimal 500 karakter.");

  if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
    throw new Error("Priority harus 0–100.");
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
    throw new Error("Urutan harus 0–9999.");
  }

  const stateScope = checkedValues("stateScope");
  if (!stateScope.length) throw new Error("Pilih minimal satu State Scope.");
  if (stateScope.some(value => !STATE_SCOPE_VALUES.includes(value))) {
    throw new Error("State Scope tidak valid.");
  }

  const weekdays = checkedValues("weekday")
    .map(Number)
    .filter(value => DEFAULT_WEEKDAYS.includes(value));

  if (!weekdays.length) throw new Error("Pilih minimal satu hari tayang.");

  const startsAt = fromLocalDateTime($("#startsAtInput").value);
  const endsAt = fromLocalDateTime($("#endsAtInput").value);

  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new Error("Selesai tayang harus setelah mulai tayang.");
  }

  return {
    text_content: text,
    sort_order: sortOrder,
    priority,
    active: $("#activeInput").checked,
    starts_at: startsAt,
    ends_at: endsAt,
    weekdays,
    state_scope: stateScope
  };
}

function checkedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)]
    .map(input => input.value);
}

function requestDelete() {
  if (!state.editing) return;
  state.deleting = state.editing;
  $("#deleteMessage").textContent =
    `“${truncate(state.editing.text_content, 90)}” akan dihapus permanen.`;
  $("#deleteDialog").showModal();
}

async function confirmDelete() {
  if (!state.deleting) return;

  const button = $("#confirmDeleteBtn");
  button.disabled = true;
  button.textContent = "Menghapus...";

  try {
    const { error } = await db
      .from("tv_running_text")
      .delete()
      .eq("id", state.deleting.id);

    if (error) throw error;

    $("#deleteDialog").close();
    $("#editorDialog").close();

    showStatus("Running text berhasil dihapus.", "success", 2600);

    state.editing = null;
    state.deleting = null;
    await loadItems();
  } catch (error) {
    console.error("MJHK TV running text delete failed", safeErrorCode(error));
    $("#deleteDialog").close();
    showFormError(`Gagal menghapus: ${safeMessage(error)}`);
  } finally {
    button.disabled = false;
    button.textContent = "Ya, Hapus";
  }
}

function scheduleLabel(item) {
  if (!item.starts_at && !item.ends_at) return "Tanpa batas tanggal";
  if (item.starts_at && item.ends_at) {
    return `${formatDateTime(item.starts_at)} → ${formatDateTime(item.ends_at)}`;
  }
  if (item.starts_at) return `Mulai ${formatDateTime(item.starts_at)}`;
  return `Sampai ${formatDateTime(item.ends_at)}`;
}

function weekdayLabel(values) {
  if (values.length === DEFAULT_WEEKDAYS.length) return "Setiap hari";
  return WEEKDAYS
    .filter(day => values.includes(day.value))
    .map(day => day.label)
    .join(", ");
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = number => String(number).padStart(2, "0");
  return [
    date.getFullYear(), "-",
    pad(date.getMonth() + 1), "-",
    pad(date.getDate()), "T",
    pad(date.getHours()), ":",
    pad(date.getMinutes())
  ].join("");
}

function fromLocalDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Format tanggal/jam tidak valid.");
  }
  return date.toISOString();
}

function badge(label, className) {
  const node = document.createElement("span");
  node.className = `badge ${className || "neutral"}`;
  node.textContent = String(label || "unknown");
  return node;
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function showStatus(message, type = "", timeout = 0) {
  const banner = $("#statusBanner");
  banner.textContent = message;
  banner.className = "banner";
  if (type) banner.classList.add(type);
  banner.classList.remove("hidden");

  if (timeout > 0) {
    window.setTimeout(() => banner.classList.add("hidden"), timeout);
  }
}

function showPermission(message) {
  const banner = $("#permissionBanner");
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function showFormError(message) {
  const node = $("#formError");
  node.textContent = message;
  node.classList.remove("hidden");
}

function hide(selector) {
  $(selector)?.classList.add("hidden");
}

function setLoading(loading) {
  $("#refreshBtn").disabled = loading;
  $("#newBtn").disabled = loading;
  $("#refreshBtn").textContent = loading ? "Memuat..." : "Refresh";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
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
  return String(error?.message || "unknown_error")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

function safeErrorCode(error) {
  return String(error?.code || error?.name || "running_text_error")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
}

$("#refreshBtn").addEventListener("click", () => void loadItems());
$("#newBtn").addEventListener("click", () => openEditor());
$("#textInput").addEventListener("input", () => {
  $("#charCount").textContent = String($("#textInput").value.length);
});
$("#editorForm").addEventListener("submit", saveEditor);
$("#closeEditorBtn").addEventListener("click", () => $("#editorDialog").close());
$("#cancelBtn").addEventListener("click", () => $("#editorDialog").close());
$("#deleteBtn").addEventListener("click", requestDelete);
$("#cancelDeleteBtn").addEventListener("click", () => {
  state.deleting = null;
  $("#deleteDialog").close();
});
$("#confirmDeleteBtn").addEventListener("click", () => void confirmDelete());
$("#activeFilter").addEventListener("change", renderItems);
$("#stateFilter").addEventListener("change", renderItems);

(async () => {
  buildOptions();
  try {
    const session = await requireSession();
    if (session) await loadItems();
  } catch (error) {
    showPermission(`Gagal memuat sesi admin: ${safeMessage(error)}`);
  }
})();
