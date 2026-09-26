(() => {
  "use strict";

  const ALLOWED_COMMANDS = Object.freeze(["sync_now", "reload_player"]);
  const HISTORY_LIMIT = 5;
  const REFRESH_MS = 5000;
  const BOOT_TIMEOUT_MS = 12000;

  let db = null;
  let mountedPanel = null;
  let mountedCode = null;
  let currentDevice = null;
  let refreshTimer = null;
  let loading = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitForSupabase() {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const candidate = window.mjhkSupabase;
      if (candidate && typeof candidate.from === "function") {
        return candidate;
      }
      await sleep(100);
    }

    throw new Error("window.mjhkSupabase belum siap setelah 12 detik");
  }

  function text(value) {
    return value == null || value === "" ? "—" : String(value);
  }

  function escapeHtml(value) {
    return text(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function commandLabel(type) {
    if (type === "sync_now") return "Sync Now";
    if (type === "reload_player") return "Reload Player";
    return type;
  }

  function statusLabel(status) {
    const value = String(status || "").toLowerCase();
    return ({
      pending: "PENDING",
      delivered: "DELIVERED",
      done: "DONE",
      failed: "FAILED",
      expired: "EXPIRED",
    })[value] || value.toUpperCase() || "UNKNOWN";
  }

  function statusClass(status) {
    const value = String(status || "").toLowerCase();
    return ["pending", "delivered", "done", "failed", "expired"].includes(value)
      ? value
      : "unknown";
  }

  function formatTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function looksLikeSelectedPanel(el) {
    if (!el || !(el instanceof Element)) return false;
    const value = (el.textContent || "").toUpperCase();

    return (
      value.includes("SELECTED DEVICE") &&
      value.includes("IDENTITAS") &&
      value.includes("REGISTRATION & PAIRING") &&
      value.includes("DISPLAY PROFILE")
    );
  }

  function findSelectedDevicePanel() {
    const preferredSelectors = [
      "#selectedDevice",
      "#selectedDevicePanel",
      "[data-selected-device]",
      ".selected-device",
      ".selected-device-panel",
      ".device-detail",
      ".device-detail-card",
      ".device-details",
    ];

    for (const selector of preferredSelectors) {
      const el = document.querySelector(selector);
      if (looksLikeSelectedPanel(el)) return el;
    }

    const headingCandidates = [...document.querySelectorAll("*")].filter((el) => {
      if (el.children.length > 3) return false;
      return (el.textContent || "").trim().toUpperCase() === "SELECTED DEVICE";
    });

    for (const heading of headingCandidates) {
      let node = heading;
      for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
        if (looksLikeSelectedPanel(node)) return node;
      }
    }

    const allCandidates = [...document.querySelectorAll("aside,section,article,div")]
      .filter(looksLikeSelectedPanel)
      .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);

    return allCandidates[0] || null;
  }

  function getSelectedDeviceCode(panel) {
    if (!panel) return null;

    const DEVICE_CODE_RE = new RegExp("MJHK-(?:SIM-)?[A-Z0-9]{12,32}", "i");

    const normalize = (value) =>
      String(value || "")
        .replaceAll("\u200B", "")
        .replaceAll("\u200C", "")
        .replaceAll("\u200D", "")
        .replaceAll("\uFEFF", "")
        .replace(/\s+/g, " ")
        .trim();

    const nodes = [...panel.querySelectorAll("*")];

    // 1. Utamakan field canonical DEVICE CODE.
    const label = nodes.find((el) => {
      if (el.children.length > 2) return false;
      return normalize(el.textContent).toUpperCase() === "DEVICE CODE";
    });

    if (label) {
      let container = label.parentElement;

      for (let depth = 0; container && depth < 5; depth += 1) {
        const match = normalize(container.textContent).match(DEVICE_CODE_RE);
        if (match) return match[0].toUpperCase();
        container = container.parentElement;
      }
    }

    // 2. Fallback aman ke seluruh selected-device panel.
    const panelMatch = normalize(panel.textContent).match(DEVICE_CODE_RE);
    if (panelMatch) return panelMatch[0].toUpperCase();

    // 3. Fallback element/data attribute.
    for (const el of nodes) {
      const candidates = [
        el.dataset?.deviceCode,
        el.getAttribute?.("data-device-code"),
        el.value,
        el.textContent,
      ];

      for (const candidate of candidates) {
        const match = normalize(candidate).match(DEVICE_CODE_RE);
        if (match) return match[0].toUpperCase();
      }
    }

    return null;
  }

  function findAdministrationSection(panel) {
    if (!panel) return null;

    const exact = [...panel.querySelectorAll("*")].find((el) => {
      if (el.children.length > 2) return false;
      return (el.textContent || "").trim().toLowerCase() === "device administration";
    });

    if (!exact) return null;

    let node = exact;
    while (node && node.parentElement !== panel) {
      const parent = node.parentElement;
      if (!parent) break;

      const parentText = (parent.textContent || "").toLowerCase();
      if (
        parentText.includes("device administration") &&
        !parentText.includes("display profile") &&
        !parentText.includes("registration & pairing")
      ) {
        node = parent;
      } else {
        break;
      }
    }

    return node;
  }

  function ensureMount(panel) {
    if (!panel) return null;

    let mount = panel.querySelector("#remoteCommandsCard");
    if (mount) return mount;

    mount = document.createElement("section");
    mount.id = "remoteCommandsCard";
    mount.className = "remote-commands-card";
    mount.dataset.phase = "4E-C1";

    mount.innerHTML = [
      '<div class="remote-commands-head">',
      '  <div>',
      '    <div class="remote-commands-kicker">REMOTE COMMANDS</div>',
      '    <h3>Kontrol Perangkat</h3>',
      '  </div>',
      '  <span class="remote-commands-phase">Phase 4E-C1</span>',
      '</div>',
      '<p class="remote-commands-copy" id="remoteCommandsHint">Memuat status perangkat…</p>',
      '<div class="remote-command-actions">',
      '  <button type="button" class="remote-command-btn primary" id="remoteSyncNowBtn" disabled>Sync Now</button>',
      '  <button type="button" class="remote-command-btn warning" id="remoteReloadPlayerBtn" disabled>Reload Player</button>',
      '</div>',
      '<div class="remote-command-feedback" id="remoteCommandFeedback" role="status" aria-live="polite" hidden></div>',
      '<div class="remote-command-history-head">',
      '  <strong>Recent Commands</strong>',
      '  <button type="button" class="remote-command-refresh" id="remoteCommandsRefreshBtn">Refresh</button>',
      '</div>',
      '<div class="remote-command-history" id="remoteCommandsHistory">',
      '  <div class="remote-command-empty">Belum ada data command.</div>',
      '</div>',
    ].join("");

    const administration = findAdministrationSection(panel);

    if (administration && administration.parentElement) {
      administration.parentElement.insertBefore(mount, administration);
    } else {
      panel.appendChild(mount);
    }

    mount.querySelector("#remoteSyncNowBtn")
      ?.addEventListener("click", () => void sendCommand("sync_now"));

    mount.querySelector("#remoteReloadPlayerBtn")
      ?.addEventListener("click", () => void sendCommand("reload_player"));

    mount.querySelector("#remoteCommandsRefreshBtn")
      ?.addEventListener("click", () => void refreshCurrent());

    console.info("[4E-C1] Remote Commands mounted", {
      panelClass: panel.className || null,
      code: getSelectedDeviceCode(panel),
    });

    return mount;
  }

  function setFeedback(message, kind = "info") {
    if (!mountedPanel) return;
    const el = mountedPanel.querySelector("#remoteCommandFeedback");
    if (!el) return;

    if (!message) {
      el.hidden = true;
      el.textContent = "";
      el.dataset.kind = "";
      return;
    }

    el.hidden = false;
    el.textContent = message;
    el.dataset.kind = kind;
  }

  function setButtonBusy(busy) {
    if (!mountedPanel) return;

    for (const button of [
      mountedPanel.querySelector("#remoteSyncNowBtn"),
      mountedPanel.querySelector("#remoteReloadPlayerBtn"),
    ].filter(Boolean)) {
      button.dataset.busy = busy ? "true" : "false";
    }

    applyButtonPolicy();
  }

  function applyButtonPolicy() {
    if (!mountedPanel) return;

    const sync = mountedPanel.querySelector("#remoteSyncNowBtn");
    const reload = mountedPanel.querySelector("#remoteReloadPlayerBtn");
    const hint = mountedPanel.querySelector("#remoteCommandsHint");

    const paired =
      Boolean(currentDevice?.enabled) &&
      Boolean(currentDevice?.paired_at);

    const busy =
      sync?.dataset.busy === "true" ||
      reload?.dataset.busy === "true";

    if (sync) sync.disabled = !paired || busy;
    if (reload) reload.disabled = !paired || busy;

    if (!hint) return;

    if (!currentDevice) {
      hint.textContent = "Pilih device untuk menggunakan remote command.";
    } else if (currentDevice.enabled === false) {
      hint.textContent = "Device sudah direvoke. Remote command tidak tersedia.";
    } else if (!currentDevice.paired_at) {
      hint.textContent =
        "Device belum paired. Selesaikan pairing sebelum mengirim command.";
    } else if (
      String(currentDevice.network_status || "").toLowerCase() === "online"
    ) {
      hint.textContent =
        "Device online. Command akan diambil pada siklus polling berikutnya.";
    } else {
      hint.textContent =
        "Device sedang offline. Command tetap masuk antrean dan berlaku sampai TTL berakhir.";
    }
  }

  async function resolveDevice(deviceCode) {
    const { data, error } = await db
      .from("tv_devices")
      .select("id,name,device_code,enabled,paired_at,network_status")
      .eq("device_code", deviceCode)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function loadHistory(deviceId) {
    const { data, error } = await db
      .from("tv_device_commands")
      .select(
        "id,command_type,status,created_at,delivered_at,completed_at,error_message,expires_at,delivery_attempts"
      )
      .eq("device_id", deviceId)
      .in("command_type", ALLOWED_COMMANDS)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  function renderHistory(rows) {
    if (!mountedPanel) return;
    const root = mountedPanel.querySelector("#remoteCommandsHistory");
    if (!root) return;

    if (!rows.length) {
      root.innerHTML =
        '<div class="remote-command-empty">Belum ada command untuk device ini.</div>';
      return;
    }

    root.innerHTML = rows.map((row) => {
      const finalAt = row.completed_at || row.delivered_at || null;
      const detail = row.error_message
        ? '<div class="remote-command-error">' +
          escapeHtml(row.error_message) +
          "</div>"
        : "";

      return [
        '<article class="remote-command-row">',
        '  <div class="remote-command-row-top">',
        "    <strong>" + escapeHtml(commandLabel(row.command_type)) + "</strong>",
        '    <span class="remote-command-status ' +
          escapeHtml(statusClass(row.status)) +
          '">' +
          escapeHtml(statusLabel(row.status)) +
          "</span>",
        "  </div>",
        '  <div class="remote-command-meta">',
        "    <span>Requested " + escapeHtml(formatTime(row.created_at)) + "</span>",
        "    <span>Result " + escapeHtml(formatTime(finalAt)) + "</span>",
        "    <span>Attempt " + escapeHtml(row.delivery_attempts ?? 0) + "</span>",
        "  </div>",
        detail,
        "</article>",
      ].join("");
    }).join("");
  }

  async function activeDuplicateExists(deviceId, commandType) {
    const now = new Date().toISOString();

    const { data, error } = await db
      .from("tv_device_commands")
      .select("id,status,expires_at")
      .eq("device_id", deviceId)
      .eq("command_type", commandType)
      .in("status", ["pending", "delivered"])
      .gt("expires_at", now)
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  }

  async function sendCommand(commandType) {
    if (!ALLOWED_COMMANDS.includes(commandType)) {
      setFeedback("Command tidak diizinkan pada Phase 4E-C1.", "error");
      return;
    }

    if (!currentDevice?.id) {
      setFeedback("Device terpilih tidak ditemukan.", "error");
      return;
    }

    if (!currentDevice.enabled || !currentDevice.paired_at) {
      setFeedback(
        "Remote command hanya tersedia untuk device aktif yang sudah paired.",
        "error"
      );
      return;
    }

    if (
      commandType === "reload_player" &&
      !window.confirm(
        "Reload player pada " +
          (currentDevice.name || currentDevice.device_code) +
          "?"
      )
    ) {
      return;
    }

    setButtonBusy(true);
    setFeedback("Menyiapkan " + commandLabel(commandType) + "…", "info");

    try {
      if (await activeDuplicateExists(currentDevice.id, commandType)) {
        setFeedback(
          commandLabel(commandType) +
            " masih pending/delivered. Command baru tidak dibuat.",
          "warning"
        );
        await refreshCurrent();
        return;
      }

      const { error } = await db
        .from("tv_device_commands")
        .insert({
          device_id: currentDevice.id,
          command_type: commandType,
          payload: { source: "cms_phase4ec1" },
        });

      if (error) throw error;

      setFeedback(
        commandLabel(commandType) + " berhasil masuk antrean.",
        "success"
      );

      await refreshCurrent();
    } catch (error) {
      console.error("[4E-C1] send command failed", error);
      setFeedback(error?.message || "Gagal mengirim remote command.", "error");
    } finally {
      setButtonBusy(false);
    }
  }

  async function refreshCurrent() {
    if (loading || !db) return;
    loading = true;

    try {
      const panel = findSelectedDevicePanel();
      const code = getSelectedDeviceCode(panel);

      if (!panel || !code) {
        currentDevice = null;
        mountedCode = null;
        return;
      }

      mountedPanel = ensureMount(panel);
      mountedCode = code;

      currentDevice = await resolveDevice(code);
      applyButtonPolicy();

      if (!currentDevice?.id) {
        renderHistory([]);
        return;
      }

      renderHistory(await loadHistory(currentDevice.id));
    } catch (error) {
      console.error("[4E-C1] refresh failed", error);
      setFeedback(error?.message || "Gagal memuat Remote Commands.", "error");
    } finally {
      loading = false;
    }
  }

  function startTimer() {
    if (refreshTimer !== null) window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => void refreshCurrent(), REFRESH_MS);
  }

  const observer = new MutationObserver(() => {
    const panel = findSelectedDevicePanel();
    const code = getSelectedDeviceCode(panel);

    if (
      panel &&
      (!panel.querySelector("#remoteCommandsCard") || code !== mountedCode)
    ) {
      void refreshCurrent();
    }
  });

  async function start() {
    try {
      db = await waitForSupabase();

      console.info("[4E-C1] Supabase ready");

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      startTimer();

      for (let attempt = 0; attempt < 40; attempt += 1) {
        await refreshCurrent();

        if (document.querySelector("#remoteCommandsCard")) {
          console.info("[4E-C1] Ready");
          return;
        }

        await sleep(150);
      }

      console.error("[4E-C1] Selected Device panel ditemukan terlambat/tidak cocok");
    } catch (error) {
      console.error("[4E-C1] startup failed", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void start(), {
      once: true,
    });
  } else {
    void start();
  }

  window.mjhkRemoteCommandsDebug = {
    findSelectedDevicePanel,
    getSelectedDeviceCode: () =>
      getSelectedDeviceCode(findSelectedDevicePanel()),
    refresh: () => refreshCurrent(),
  };

  window.addEventListener(
    "beforeunload",
    () => {
      observer.disconnect();
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
    },
    { once: true }
  );
})();
