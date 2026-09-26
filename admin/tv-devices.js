const db = window.mjhkSupabase;

if (!db) {
  throw new Error("mjhk_supabase_client_unavailable");
}

const $ = (id) => document.getElementById(id);

const state = {
  session: null,
  devices: [],
  profiles: new Map(),
  pairingSessions: new Map(),
  selectedId: null,
  pairingResult: null,
};

function safeText(value, fallback = "—") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function showStatus(message, isError = false) {
  const node = $("status");
  node.hidden = !message;
  node.textContent = message || "";
  node.classList.toggle("error", Boolean(isError));
}

async function requireAdminSession() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;

  const session = data.session;
  if (!session) {
    location.href = "login.html";
    throw new Error("admin_session_required");
  }

  state.session = session;
  $("sessionLabel").textContent =
    `Login sebagai ${session.user.email || "admin"}`;
}


// MJHK_PHASE4EB_NETWORK_PRESENCE_90S
// Bootstrap runtime contract:
// heartbeat_interval_seconds = 30
// offline_after_seconds = 90
const DEVICE_OFFLINE_AFTER_SECONDS = 90;
const DEVICE_OFFLINE_AFTER_MS =
  DEVICE_OFFLINE_AFTER_SECONDS * 1000;

function effectiveDeviceNetworkStatus(
  device,
  nowMs = Date.now()
) {
  if (!device || device.enabled === false) {
    return "unknown";
  }

  if (!device.paired_at) {
    return "unknown";
  }

  if (!device.last_seen_at) {
    return "unknown";
  }

  const lastSeenMs =
    new Date(device.last_seen_at).getTime();

  if (!Number.isFinite(lastSeenMs)) {
    return "unknown";
  }

  const ageMs =
    Math.max(0, nowMs - lastSeenMs);

  return ageMs <= DEVICE_OFFLINE_AFTER_MS
    ? "online"
    : "offline";
}

function applyEffectiveNetworkStatus(
  device,
  nowMs = Date.now()
) {
  if (!device || typeof device !== "object") {
    return device;
  }

  return {
    ...device,
    network_status_raw:
      device.network_status ?? null,
    network_status:
      effectiveDeviceNetworkStatus(
        device,
        nowMs
      ),
  };
}


// MJHK_PHASE4EB_REVOKE_DEVICE_V1
// Audited RPC contract:
// - enabled=false
// - device_token_hash=null
// - network_status='offline'
// - pending pairing sessions expired
// - pending/delivered commands expired
// - device_revoked security event with reason

function selectedDeviceForRevoke() {
  const button = document.getElementById("revokeDeviceBtn");

  // Preferred: use known state fields when present.
  const selectedId =
    state?.selectedDeviceId ??
    state?.selectedId ??
    state?.selectedDevice?.id ??
    null;

  if (selectedId) {
    const byId = state.devices?.find(
      (device) => String(device.id) === String(selectedId)
    );
    if (byId) return byId;
  }

  // Defensive fallback: identify the selected right-side panel by its
  // displayed device_code. Choose the nearest ancestor containing exactly
  // one known code to avoid matching the full page device table.
  if (button && Array.isArray(state?.devices)) {
    let node = button.parentElement;

    while (node && node !== document.body) {
      const text = node.textContent || "";
      const matches = state.devices.filter(
        (device) =>
          device?.device_code &&
          text.includes(device.device_code)
      );

      if (matches.length === 1) {
        return matches[0];
      }

      node = node.parentElement;
    }
  }

  return null;
}

function syncRevokeDeviceButton() {
  const button = document.getElementById("revokeDeviceBtn");
  if (!button) return;

  const device = selectedDeviceForRevoke();

  // MJHK_PHASE4EB_REVOKED_HIDE_HOTFIX_V1
  let renderedRevoked = false;
  let node = button.parentElement;

  while (node && node !== document.body) {
    const text = node.textContent || "";

    if (
      /Device sudah direvoke/i.test(text) ||
      /PAIRING STATUS\s*Disabled/i.test(text) ||
      /ENABLED\s*Tidak/i.test(text)
    ) {
      renderedRevoked = true;
      break;
    }

    node = node.parentElement;
  }

  const revoked =
    device?.enabled === false ||
    renderedRevoked;

  button.disabled = !device || revoked;
  button.hidden = Boolean(revoked);

  if (!device) {
    button.title = "Pilih device terlebih dahulu";
  } else if (revoked) {
    button.title = "Device sudah revoked";
  } else {
    button.title = "Hentikan kepercayaan CMS terhadap device ini";
  }
}

function openRevokeDeviceDialog() {
  const device = selectedDeviceForRevoke();

  if (!device) {
    window.alert("Pilih device terlebih dahulu.");
    return;
  }

  if (device.enabled === false) {
    window.alert("Device ini sudah revoked.");
    return;
  }

  const dialog = document.getElementById("revokeDeviceDialog");
  const title = document.getElementById("revokeDeviceDialogTitle");
  const reason = document.getElementById("revokeDeviceReason");
  const error = document.getElementById("revokeDeviceError");

  if (!dialog || !title || !reason) return;

  dialog.dataset.deviceId = device.id;
  dialog.dataset.deviceCode = device.device_code || "";
  title.textContent = `Revoke ${device.name || device.device_code || "Device"}?`;
  reason.value = "";

  if (error) {
    error.hidden = true;
    error.textContent = "";
  }

  dialog.showModal();
  setTimeout(() => reason.focus(), 0);
}

function closeRevokeDeviceDialog() {
  const dialog = document.getElementById("revokeDeviceDialog");
  if (dialog?.open) dialog.close();
}

async function revokeSelectedDevice(event) {
  event?.preventDefault?.();

  const dialog = document.getElementById("revokeDeviceDialog");
  const reasonInput = document.getElementById("revokeDeviceReason");
  const errorBox = document.getElementById("revokeDeviceError");
  const confirmButton = document.getElementById("confirmRevokeDeviceBtn");

  if (!dialog || !reasonInput || !confirmButton) return;

  const deviceId = dialog.dataset.deviceId;
  const reason = reasonInput.value.trim();

  if (!deviceId) {
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent = "Device tidak ditemukan. Tutup dialog lalu pilih ulang device.";
    }
    return;
  }

  if (!reason) {
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent = "Alasan revoke wajib diisi.";
    }
    reasonInput.focus();
    return;
  }

  confirmButton.disabled = true;
  const originalText = confirmButton.textContent;
  confirmButton.textContent = "Memproses...";

  if (errorBox) {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  try {
    const { data, error } = await db.rpc(
      "tv_admin_revoke_device",
      {
        p_device_id: deviceId,
        p_reason: reason,
      }
    );

    if (error) throw error;

    if (!data?.revoked) {
      throw new Error("RPC tidak mengembalikan revoked=true");
    }

    closeRevokeDeviceDialog();

    // Remove any currently displayed one-time code from the DOM after revoke.
    // Backend has already expired all pending pairing sessions.
    for (const element of document.querySelectorAll(
      "[data-pairing-result], #pairingResult, #pairingResultCard, #pairingCodeResult"
    )) {
      element.hidden = true;
    }

    await loadDevices();
    syncRevokeDeviceButton();
  } catch (error) {
    console.error("[Devices] revoke failed", error);

    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent =
        error?.message || "Revoke device gagal.";
    }
  } finally {
    confirmButton.disabled = false;
    confirmButton.textContent = originalText;
  }
}

function initRevokeDeviceUi() {
  const button = document.getElementById("revokeDeviceBtn");
  const form = document.getElementById("revokeDeviceForm");
  const cancel = document.getElementById("cancelRevokeDeviceBtn");
  const cancelTop = document.getElementById("cancelRevokeDeviceTopBtn");
  const dialog = document.getElementById("revokeDeviceDialog");

  button?.addEventListener("click", openRevokeDeviceDialog);
  form?.addEventListener("submit", revokeSelectedDevice);
  cancel?.addEventListener("click", closeRevokeDeviceDialog);
  cancelTop?.addEventListener("click", closeRevokeDeviceDialog);

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeRevokeDeviceDialog();
    }
  });

  // Keep the action synchronized when the selected-device panel rerenders.
  const root =
    document.querySelector("main") ||
    document.querySelector(".content") ||
    document.body;

  const observer = new MutationObserver(() => {
    queueMicrotask(syncRevokeDeviceButton);
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  syncRevokeDeviceButton();
}

async function loadDevices() {
  $("loadState").textContent = "Memuat perangkat...";
  showStatus("");

  const [
    overviewResult,
    deviceSourceResult,
    profilesResult,
    pairingSessionsResult,
  ] = await Promise.all([
    db
      .from("tv_admin_device_overview")
      .select("*")
      .order("last_seen_at", {
        ascending: false,
        nullsFirst: false,
      }),

    db
      .from("tv_devices")
      .select(
        "id,display_profile_id,android_version,paired_at,created_at,updated_at"
      ),

    db
      .from("tv_display_profiles")
      .select(
        "id,name,is_default,header_show_clock,header_show_mosque,header_show_gregorian_date,header_show_hijri_date,prayer_panel_side,default_slide_duration_seconds,running_text_speed_px_per_second,updated_at"
      )
      .order("is_default", { ascending: false })
      .order("name", { ascending: true }),

    db
      .from("tv_device_pairing_sessions")
      .select("id,device_id,expires_at,claimed_at,created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (overviewResult.error) throw overviewResult.error;
  if (deviceSourceResult.error) throw deviceSourceResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (pairingSessionsResult.error) throw pairingSessionsResult.error;

  const sourceById = new Map(
    (deviceSourceResult.data || []).map((item) => [item.id, item])
  );

  state.profiles = new Map(
    (profilesResult.data || []).map((profile) => [profile.id, profile])
  );

  state.pairingSessions = new Map();
  for (const session of pairingSessionsResult.data || []) {
    if (!state.pairingSessions.has(session.device_id)) {
      state.pairingSessions.set(session.device_id, session);
    }
  }

  renderRegistrationProfiles();

  state.devices = (overviewResult.data || []).map((overview) => {
    const source = sourceById.get(overview.id) || {};
    return {
      ...overview,
      display_profile_id:
        overview.display_profile_id ??
        source.display_profile_id ??
        null,
      android_version:
        overview.android_version ??
        source.android_version ??
        null,
      paired_at:
        overview.paired_at ??
        source.paired_at ??
        null,
      created_at:
        overview.created_at ??
        source.created_at ??
        null,
      updated_at:
        overview.updated_at ??
        source.updated_at ??
        null,
    };
  });

  // Effective presence for all Devices UI renderers.
  state.devices = state.devices.map((device) => applyEffectiveNetworkStatus(device));

  renderSummary();
  renderRows();

  if (state.selectedId) {
    const exists = state.devices.some(
      (device) => device.id === state.selectedId
    );
    if (exists) {
      selectDevice(state.selectedId);
    } else {
      clearDetail();
    }
  }

  $("loadState").textContent =
    `${state.devices.length} perangkat`;
}

function renderSummary() {
  const total = state.devices.length;
  const disabled = state.devices.filter(
    (device) => device.enabled === false
  ).length;
  const online = state.devices.filter(
    (device) =>
      device.enabled !== false &&
      String(device.network_status || "").toLowerCase() === "online"
  ).length;
  const offline = state.devices.filter(
    (device) =>
      device.enabled !== false &&
      String(device.network_status || "").toLowerCase() === "offline"
  ).length;

  $("summaryTotal").textContent = String(total);
  $("summaryOnline").textContent = String(online);
  $("summaryOffline").textContent = String(offline);
  $("summaryDisabled").textContent = String(disabled);
}

function renderRows() {
  const tbody = $("deviceRows");
  tbody.replaceChildren();

  if (!state.devices.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "empty-cell";
    td.textContent = "Belum ada device terdaftar. Klik + Register Device untuk menambahkan TV pertama.";
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const device of state.devices) {
    const tr = document.createElement("tr");
    tr.dataset.deviceId = device.id;
    tr.tabIndex = 0;
    tr.classList.toggle(
      "is-selected",
      device.id === state.selectedId
    );

    tr.addEventListener("click", () => selectDevice(device.id));
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectDevice(device.id);
      }
    });

    const profile = state.profiles.get(device.display_profile_id);

    tr.append(
      tdLifecycle(device),
      tdStatus(device),
      tdDevice(device),
      tdText(profile?.name || "Belum ada profile"),
      tdRuntime(device),
      tdLastSeen(device)
    );

    tbody.append(tr);
  }
}

function deviceLifecycle(device) {
  if (device.enabled === false) return { label:"Revoked", className:"revoked" };
  if (device.paired_at) return { label:"Paired", className:"paired" };
  const s=state.pairingSessions.get(device.id);
  const active=s && !s.claimed_at && new Date(s.expires_at).getTime()>Date.now();
  if (active) return { label:"Waiting Pairing", className:"waiting" };
  return { label:"Registered", className:"registered" };
}


function tdLifecycle(device) {
  const td = document.createElement("td");
  const lifecycle = deviceLifecycle(device);
  const pill = document.createElement("span");

  pill.className = `lifecycle-pill ${lifecycle.className}`;
  pill.textContent = lifecycle.label;

  td.append(pill);
  return td;
}

function tdStatus(device) {
  const td = document.createElement("td");
  const pill = document.createElement("span");
  const status = deviceStatus(device);
  pill.className = `status-pill ${status.className}`;
  pill.textContent = status.label;
  td.append(pill);
  return td;
}

function tdDevice(device) {
  const td = document.createElement("td");
  const name = document.createElement("span");
  name.className = "device-name";
  name.textContent = safeText(device.name, "Unnamed Device");

  const code = document.createElement("span");
  code.className = "device-code";
  code.textContent = safeText(device.device_code);

  td.append(name, code);
  return td;
}

function tdText(value) {
  const td = document.createElement("td");
  td.textContent = safeText(value);
  return td;
}

function tdRuntime(device) {
  const td = document.createElement("td");
  const stack = document.createElement("div");
  stack.className = "runtime-stack";

  const stateNode = document.createElement("strong");
  stateNode.textContent = safeText(
    device.current_state,
    "No state"
  );

  const contentNode = document.createElement("span");
  contentNode.textContent = safeText(
    device.current_content_title,
    "Tidak ada konten aktif"
  );

  stack.append(stateNode, contentNode);
  td.append(stack);
  return td;
}

function tdLastSeen(device) {
  const td = document.createElement("td");
  const stack = document.createElement("div");
  stack.className = "time-stack";

  const primary = document.createElement("strong");
  primary.textContent = device.last_seen_at ? formatDateTime(device.last_seen_at) : "Belum pernah terhubung";

  const secondary = document.createElement("span");
  secondary.textContent = relativeTime(device.last_seen_at);

  stack.append(primary, secondary);
  td.append(stack);
  return td;
}

function deviceStatus(device) {
  if (device.enabled === false) {
    return { label: "Disabled", className: "disabled" };
  }

  const value = String(
    device.network_status || "unknown"
  ).toLowerCase();

  if (value === "online") {
    return { label: "Online", className: "online" };
  }

  if (value === "offline") {
    return { label: "Offline", className: "offline" };
  }

  return { label: "Unknown", className: "unknown" };
}

function selectDevice(deviceId) {
  const device = state.devices.find(
    (item) => item.id === deviceId
  );
  if (!device) return;

  state.selectedId = device.id;

  for (const row of $("deviceRows").querySelectorAll("tr")) {
    row.classList.toggle(
      "is-selected",
      row.dataset.deviceId === device.id
    );
  }

  $("detailEmpty").hidden = true;
  $("detailBody").hidden = false;
  $("detailTitle").textContent = safeText(
    device.name,
    "Unnamed Device"
  );

  const status = deviceStatus(device);
  $("detailStatus").className =
    `status-pill ${status.className}`;
  $("detailStatus").textContent = status.label;

  $("detailCode").textContent = safeText(device.device_code);
  $("detailEnabled").textContent =
    device.enabled === false ? "Tidak" : "Ya";
  $("detailModel").textContent = safeText(device.device_model, "Belum terdeteksi");
  $("detailAndroid").textContent = safeText(device.android_version, "Belum terdeteksi");
  $("detailApp").textContent = safeText(device.app_version, "Belum terdeteksi");
  $("detailResolution").textContent =
    device.screen_width && device.screen_height
      ? `${device.screen_width} × ${device.screen_height}`
      : "Belum terdeteksi";

  $("detailState").textContent = safeText(device.current_state, "Belum ada telemetry");
  $("detailContent").textContent = safeText(device.current_content_title, "Tidak ada konten aktif");
  $("detailSlide").textContent =
    Number.isInteger(device.current_slide_index) &&
    Number.isInteger(device.total_slides)
      ? `${device.current_slide_index + 1} / ${device.total_slides}`
      : "—";
  $("detailRemaining").textContent =
    Number.isFinite(Number(device.remaining_seconds))
      ? `${Number(device.remaining_seconds)} detik`
      : "—";
  $("detailMuted").textContent =
    device.is_muted === true
      ? "Ya"
      : device.is_muted === false
        ? "Tidak"
        : "Belum ada telemetry";

  $("detailLastSync").textContent =
    device.last_sync_at ? formatDateTime(device.last_sync_at) : "Belum pernah sinkron";
  $("detailLastSeen").textContent =
    formatDateTime(device.last_seen_at);
  $("detailScreenshot").textContent =
    device.last_screenshot_at ? formatDateTime(device.last_screenshot_at) : "Belum ada screenshot";

  renderPairing(device);
  renderProfile(device);
  renderError(device);
}


function renderRegistrationProfiles() {
  const select = $("registerProfile");
  if (!select) return;

  const current = select.value;
  select.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Default Profile";
  select.append(defaultOption);

  for (const profile of state.profiles.values()) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.is_default
      ? `${profile.name} (Default)`
      : profile.name;
    select.append(option);
  }

  if (current && [...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function latestPairingState(deviceId) {
  const session = state.pairingSessions.get(deviceId);

  if (!session) {
    return {
      label: "None",
      className: "neutral",
      stateText: "Belum ada pairing session",
      session: null,
    };
  }

  if (session.claimed_at) {
    return {
      label: "Claimed",
      className: "online",
      stateText: "Sudah diklaim",
      session,
    };
  }

  const expiry = new Date(session.expires_at).getTime();

  if (Number.isFinite(expiry) && expiry > Date.now()) {
    return {
      label: "Waiting",
      className: "unknown",
      stateText: "Menunggu device claim",
      session,
    };
  }

  return {
    label: "Expired",
    className: "offline",
    stateText: "Pairing code kedaluwarsa",
    session,
  };
}

function renderPairing(device) {
  const s=state.pairingSessions.get(device.id)||null;
  const paired=Boolean(device.paired_at);
  const active=s && !s.claimed_at && new Date(s.expires_at).getTime()>Date.now();
  const expired=s && !s.claimed_at && !active;
  let badge="NONE", cls="neutral", stateText="Belum ada pairing";
  let helper="Device sudah terdaftar tetapi belum memiliki credential aktif.";
  let action="Buat Kode Pairing Baru", disabled=false;

  if(device.enabled===false){
    badge="DISABLED"; cls="disabled"; stateText="Disabled";
    helper="Device sudah direvoke dan tidak lagi dipercaya oleh CMS. Histori perangkat tetap disimpan.";
    action="Device sudah direvoke"; disabled=true;
  } else if(paired && active){
    badge="RE-PAIR ACTIVE"; cls="repair"; stateText="Re-pair code aktif";
    helper="Kode pairing baru sedang aktif. Credential device saat ini tetap berlaku sampai kode baru diklaim.";
    action="Buat Kode Pairing Baru";
  } else if(paired){
    badge="CLAIMED"; cls="online"; stateText="Claimed";
    const n=String(device.network_status||"").toLowerCase();
    helper=n==="online"?"Device terhubung dan menggunakan credential aktif.":n==="offline"?"Device sudah paired tetapi saat ini tidak terhubung.":"Device sudah paired dan memiliki credential aktif.";
    action="Pair Ulang";
  } else if(active){
    badge="WAITING"; cls="waiting"; stateText="Waiting Pairing";
    helper="Pairing code aktif sedang menunggu klaim dari device. Membuat kode baru akan mengakhiri kode sebelumnya.";
    action="Buat Kode Pairing Baru";
  } else if(expired){
    badge="EXPIRED"; cls="offline"; stateText="Expired";
    helper="Pairing code sudah kedaluwarsa. Buat kode baru untuk melanjutkan pairing.";
    action="Buat Kode Pairing Baru";
  }

  $("pairingStatusBadge").className=`status-pill ${cls}`;
  $("pairingStatusBadge").textContent=badge;
  $("pairingSessionState").textContent=stateText;
  $("pairingLatestAt").textContent=s?.created_at?formatDateTime(s.created_at):"Belum ada pairing";
  $("pairingExpiresAt").textContent=s?.expires_at?formatDateTime(s.expires_at):"Belum ada";
  $("pairingClaimedAt").textContent=device.paired_at?formatDateTime(device.paired_at):"Belum paired";
  $("pairingContextNote").textContent=helper;
  $("togglePairingControlsBtn").textContent=action;
  $("togglePairingControlsBtn").disabled=disabled;
  $("pairingControls").hidden=true;
  $("invalidateTokenCheck").disabled=!paired;
  $("invalidateTokenCheck").checked=false;
}



async function registerDevice(event) {
  event.preventDefault();

  const name = $("registerName").value.trim();
  const profileId = $("registerProfile").value || null;
  const ttl = Number.parseInt($("registerTtl").value, 10);

  if (!name) {
    showStatus("Nama device wajib diisi.", true);
    $("registerName").focus();
    return;
  }

  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 60) {
    showStatus("Pairing TTL harus 1 sampai 60 menit.", true);
    return;
  }

  const button = $("submitRegistrationBtn");
  button.disabled = true;
  showStatus("");

  try {
    const { data, error } = await db.rpc(
      "tv_admin_register_device",
      {
        p_name: name,
        p_display_profile_id: profileId,
        p_pairing_ttl_minutes: ttl,
      }
    );

    if (error) throw error;

    showPairingResult({
      resultKind: "register",
      deviceName: name,
      deviceId: data?.device_id,
      deviceCode: data?.device_code,
      pairingCode: data?.pairing_code,
      expiresAt: data?.pairing_expires_at,
    });

    $("registrationForm").reset();
    $("registerTtl").value = "15";
    $("registrationPanel").hidden = true;

    await loadDevices();

    if (data?.device_id) {
      selectDevice(data.device_id);
    }
  } catch (error) {
    console.error(error);
    showStatus(
      `Registrasi device gagal: ${friendlyPairingError(error)}`,
      true
    );
  } finally {
    button.disabled = false;
  }
}

async function generatePairingCode() {
  const device = state.devices.find(
    (item) => item.id === state.selectedId
  );

  if (!device) {
    showStatus("Pilih device terlebih dahulu.", true);
    return;
  }

  const ttl = Number.parseInt($("pairingTtl").value, 10);
  const invalidateExistingToken =
    $("invalidateTokenCheck").checked === true;

  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 60) {
    showStatus("Pairing TTL harus 1 sampai 60 menit.", true);
    return;
  }

  if (
    invalidateExistingToken &&
    !window.confirm(
      "Credential device saat ini akan langsung tidak berlaku. TV harus memasukkan pairing code baru. Lanjutkan?"
    )
  ) {
    return;
  }

  const button = $("generatePairingBtn");
  button.disabled = true;
  showStatus("");

  try {
    const { data, error } = await db.rpc(
      "tv_admin_create_pairing_code",
      {
        p_device_id: device.id,
        p_pairing_ttl_minutes: ttl,
        p_invalidate_existing_token: invalidateExistingToken,
      }
    );

    if (error) throw error;

    showPairingResult({
      resultKind: "pairing",
      deviceName: device.name,
      deviceId: data?.device_id,
      deviceCode: data?.device_code,
      pairingCode: data?.pairing_code,
      expiresAt: data?.pairing_expires_at,
    });

    $("invalidateTokenCheck").checked = false;
    $("pairingControls").hidden = true;

    await loadDevices();
    selectDevice(device.id);
  } catch (error) {
    console.error(error);
    showStatus(
      `Gagal membuat pairing code: ${friendlyPairingError(error)}`,
      true
    );
  } finally {
    button.disabled = false;
  }
}

function showPairingResult({
  resultKind,
  deviceName,
  deviceId,
  deviceCode,
  pairingCode,
  expiresAt,
}) {
  const rawCode = String(pairingCode || "")
    .replace(/[^A-Fa-f0-9]/g, "")
    .toUpperCase();

  if (rawCode.length !== 12) {
    throw new Error("pairing_code_contract_invalid");
  }

  const formattedCode =
    `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}-${rawCode.slice(8, 12)}`;

  state.pairingResult = {
    deviceId: deviceId || null,
    pairingCode: rawCode,
  };

  $("pairingResultTitle").textContent =
    resultKind === "register"
      ? "Device berhasil didaftarkan"
      : `Kode pairing baru untuk ${deviceName || deviceCode || "device"}`;

  $("pairingResultCode").textContent = formattedCode;
  $("pairingResultDevice").textContent = safeText(deviceName);
  $("pairingResultDeviceCode").textContent = safeText(deviceCode);
  $("pairingResultExpiry").textContent = formatDateTime(expiresAt);

  $("pairingResultCard").hidden = false;
  $("pairingResultCard").scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function dismissPairingResult() {
  state.pairingResult = null;
  $("pairingResultCode").textContent = "—";
  $("pairingResultDevice").textContent = "—";
  $("pairingResultDeviceCode").textContent = "—";
  $("pairingResultExpiry").textContent = "—";
  $("pairingResultCard").hidden = true;
}

async function copyPairingCode() {
  const code = state.pairingResult?.pairingCode;
  if (!code) return;

  const formatted =
    `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;

  try {
    await navigator.clipboard.writeText(formatted);
    $("copyPairingBtn").textContent = "Copied";

    window.setTimeout(() => {
      $("copyPairingBtn").textContent = "Copy";
    }, 1500);
  } catch {
    showStatus(
      "Clipboard browser tidak tersedia. Salin kode secara manual.",
      true
    );
  }
}

function friendlyPairingError(error) {
  const message = String(
    error?.message ||
    error?.details ||
    error?.hint ||
    "unknown_error"
  );

  if (message.includes("DEVICE_NAME_REQUIRED")) {
    return "nama device wajib diisi.";
  }

  if (message.includes("PAIRING_TTL_OUT_OF_RANGE")) {
    return "TTL harus antara 1 sampai 60 menit.";
  }

  if (message.includes("DEVICE_NOT_FOUND")) {
    return "device tidak ditemukan.";
  }

  if (message.includes("ADMIN_REQUIRED")) {
    return "akun ini tidak memiliki akses admin.";
  }

  return message;
}

function renderProfile(device) {
  const profile =
    state.profiles.get(device.display_profile_id) || null;

  $("profileName").textContent =
    profile?.name || "Belum ditetapkan";
  $("profileDefault").textContent =
    profile
      ? profile.is_default
        ? "Ya"
        : "Tidak"
      : "—";
  $("profilePrayerSide").textContent =
    profile?.prayer_panel_side || "—";
  $("profileSlideDuration").textContent =
    Number.isFinite(Number(profile?.default_slide_duration_seconds))
      ? `${Number(profile.default_slide_duration_seconds)} detik`
      : "—";
  $("profileRunningSpeed").textContent =
    Number.isFinite(Number(profile?.running_text_speed_px_per_second))
      ? `${Number(profile.running_text_speed_px_per_second)} px/detik`
      : "—";

  if (!profile) {
    $("profileHeader").textContent = "—";
    return;
  }

  const headerParts = [];
  if (profile.header_show_clock) headerParts.push("Jam");
  if (profile.header_show_mosque) headerParts.push("Masjid");
  if (profile.header_show_gregorian_date) headerParts.push("Masehi");
  if (profile.header_show_hijri_date) headerParts.push("Hijriah");

  $("profileHeader").textContent =
    headerParts.length ? headerParts.join(", ") : "Semua disembunyikan";
}

function renderError(device) {
  const hasError = Boolean(device.last_error);
  $("errorSection").hidden = !hasError;
  $("detailError").textContent = safeText(device.last_error);
  $("detailErrorAt").textContent =
    formatDateTime(device.last_error_at);
}

function clearDetail() {
  state.selectedId = null;
  $("detailTitle").textContent = "Pilih perangkat";
  $("detailStatus").className = "status-pill neutral";
  $("detailStatus").textContent = "—";
  $("detailEmpty").hidden = false;
  $("detailBody").hidden = true;
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function relativeTime(value) {
  if (!value) return "Belum pernah terlihat";

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "—";

  const seconds = Math.round((time - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  let amount;
  let unit;

  if (abs < 60) {
    amount = seconds;
    unit = "second";
  } else if (abs < 3600) {
    amount = Math.round(seconds / 60);
    unit = "minute";
  } else if (abs < 86400) {
    amount = Math.round(seconds / 3600);
    unit = "hour";
  } else {
    amount = Math.round(seconds / 86400);
    unit = "day";
  }

  return new Intl.RelativeTimeFormat("id-ID", {
    numeric: "auto",
  }).format(amount, unit);
}


$("registerDeviceBtn").addEventListener("click", () => {
  $("registrationPanel").hidden = false;
  $("registerName").focus();
});

$("closeRegistrationBtn").addEventListener("click", () => {
  $("registrationPanel").hidden = true;
});

$("registrationForm").addEventListener("submit", registerDevice);

$("togglePairingControlsBtn").addEventListener("click", () => {
  const controls = $("pairingControls");
  controls.hidden = !controls.hidden;
});

$("cancelPairingBtn").addEventListener("click", () => {
  $("pairingControls").hidden = true;
  $("invalidateTokenCheck").checked = false;
});
$("generatePairingBtn").addEventListener("click", generatePairingCode);
$("copyPairingBtn").addEventListener("click", copyPairingCode);
$("dismissPairingResultBtn").addEventListener(
  "click",
  dismissPairingResult
);

$("refreshBtn").addEventListener("click", async () => {
  const button = $("refreshBtn");
  button.disabled = true;

  try {
    await loadDevices();
  } catch (error) {
    console.error(error);
    showStatus(
      `Gagal memuat perangkat: ${error?.message || "unknown_error"}`,
      true
    );
    $("loadState").textContent = "Gagal memuat";
  } finally {
    button.disabled = false;
  }
});

(async () => {
  try {
    await requireAdminSession();
    await loadDevices();

    if (state.devices.length) {
      selectDevice(state.devices[0].id);
    }
  } catch (error) {
    console.error(error);

    if (error?.message !== "admin_session_required") {
      showStatus(
        `Gagal membuka Devices: ${error?.message || "unknown_error"}`,
        true
      );
      $("loadState").textContent = "Gagal memuat";
    }
  }
})();


// MJHK_PHASE4EB_REVOKE_INIT_V1
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initRevokeDeviceUi,
    { once: true }
  );
} else {
  initRevokeDeviceUi();
}
