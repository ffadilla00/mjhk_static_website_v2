const beepDb = window.mjhkSupabase;

if (!beepDb) {
  throw new Error("mjhk_supabase_client_unavailable");
}

const BEEP_STORAGE_BUCKET = "tv-content";
const BEEP_PATH_PREFIX = "cms-beep-audio";
const BEEP_MAX_FILE_BYTES = 5 * 1024 * 1024;

const BEEP_ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
]);

const BEEP_CUES = Object.freeze([
  {
    code: "adhan",
    label: "Adhan",
    state: "ADHAN",
    countField: "beep_adhan_count",
  },
  {
    code: "iqamah",
    label: "Iqamah",
    state: "IQAMAH",
    countField: "beep_iqamah_count",
  },
  {
    code: "forbidden",
    label: "Larangan Salat",
    state: "PRAYER_PROHIBITION",
    countField: "beep_forbidden_count",
  },
  {
    code: "isyraq",
    label: "Isyraq",
    state: "ISYRAQ",
    countField: "beep_isyraq_count",
  },
  {
    code: "imsak",
    label: "Imsak",
    state: "IMSAK",
    countField: "beep_imsak_count",
  },
]);

const beepState = {
  settings: null,
  config: {},
  pendingFiles: new Map(),
  previewAudio: null,
  previewObjectUrl: null,
};

function defaultCueConfig() {
  return {
    enabled: false,
    storage_bucket: null,
    storage_path: null,
    mime_type: null,
    original_name: null,
    size_bytes: null,
  };
}

function defaultBeepConfig() {
  return Object.fromEntries(
    BEEP_CUES.map((cue) => [cue.code, defaultCueConfig()])
  );
}

function normalizeCueConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultCueConfig();
  }

  const storageBucket =
    typeof value.storage_bucket === "string" &&
    value.storage_bucket.trim()
      ? value.storage_bucket.trim()
      : null;

  const storagePath =
    typeof value.storage_path === "string" &&
    value.storage_path.trim()
      ? value.storage_path.trim()
      : null;

  const mimeType =
    typeof value.mime_type === "string" &&
    value.mime_type.trim()
      ? value.mime_type.trim()
      : null;

  const originalName =
    typeof value.original_name === "string" &&
    value.original_name.trim()
      ? value.original_name.trim()
      : null;

  const sizeBytes =
    Number.isInteger(value.size_bytes) &&
    value.size_bytes >= 0
      ? value.size_bytes
      : null;

  return {
    enabled: Boolean(value.enabled && storageBucket && storagePath),
    storage_bucket: storageBucket,
    storage_path: storagePath,
    mime_type: mimeType,
    original_name: originalName,
    size_bytes: sizeBytes,
  };
}

function normalizeBeepConfig(value) {
  const base = defaultBeepConfig();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }

  for (const cue of BEEP_CUES) {
    base[cue.code] = normalizeCueConfig(value[cue.code]);
  }

  return base;
}

function cloneConfig() {
  return JSON.parse(JSON.stringify(beepState.config));
}

function safeFileName(name) {
  const cleaned = String(name || "audio")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleaned.slice(0, 80) || "audio";
}

function extensionForMime(type) {
  if (type === "audio/mpeg") return "mp3";
  if (type === "audio/mp4") return "m4a";
  if (type === "audio/ogg") return "ogg";
  throw new Error("Format audio tidak didukung.");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showBeepStatus(message, isError = false) {
  const el = document.getElementById("beepAudioStatus");
  if (!el) return;

  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-error", isError);
  el.classList.toggle("is-success", !isError);
}

function clearBeepStatus() {
  const el = document.getElementById("beepAudioStatus");
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
  el.classList.remove("is-error", "is-success");
}

function validateAudioFile(file) {
  if (!file) throw new Error("Pilih file audio terlebih dahulu.");

  if (!BEEP_ALLOWED_MIME.has(file.type)) {
    throw new Error(
      "Format audio harus MP3, M4A/MP4 audio, atau OGG."
    );
  }

  if (file.size <= 0) {
    throw new Error("File audio kosong.");
  }

  if (file.size > BEEP_MAX_FILE_BYTES) {
    throw new Error("Ukuran file maksimal 5 MB.");
  }

  return file;
}

function createPanel() {
  if (document.getElementById("customBeepAudioPanel")) return;

  const prayerPanels = document.querySelectorAll(
    ".prayer-settings-page > .panel"
  );

  if (!prayerPanels.length) {
    throw new Error("prayer_settings_panel_anchor_missing");
  }

  const section = document.createElement("section");
  section.className = "panel";
  section.id = "customBeepAudioPanel";

  section.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>Custom Beep Audio</h2>
        <p>
          Upload suara cue untuk Adhan, Iqamah, Larangan Salat,
          Isyraq, dan Imsak. Perubahan disimpan sebagai source config;
          belum aktif di TV sampai Phase 4F Publish & Revision.
        </p>
      </div>
    </div>

    <div class="panel-body">
      <div class="beep-audio-boundary">
        <span>SOURCE CONFIG</span>
        <span>PRIVATE STORAGE</span>
        <span>FALLBACK SAFE</span>
        <span>NO PUBLISH</span>
      </div>

      <div id="beepAudioStatus" class="beep-audio-status" hidden></div>

      <div class="beep-audio-note">
        <strong>Format:</strong> MP3, M4A, OGG · Maksimal 5 MB.
        Untuk alarm/beep disarankan audio singkat.
        Jika custom audio tidak tersedia pada runtime, built-in beep
        tetap menjadi fallback.
      </div>

      <div id="beepAudioGrid" class="beep-audio-grid"></div>
    </div>
  `;

  prayerPanels[0].insertAdjacentElement("afterend", section);
}

function renderCards() {
  const mount = document.getElementById("beepAudioGrid");
  if (!mount) return;

  mount.replaceChildren();

  for (const cue of BEEP_CUES) {
    const config =
      beepState.config[cue.code] || defaultCueConfig();
    const count =
      beepState.settings?.[cue.countField] ?? 0;

    const card = document.createElement("article");
    card.className = "beep-audio-card";
    card.dataset.cue = cue.code;

    const hasStoredFile = Boolean(
      config.storage_bucket && config.storage_path
    );

    card.innerHTML = `
      <div class="beep-audio-card-head">
        <div>
          <strong>${cue.label}</strong>
          <span>${cue.state} · Beep count: ${count}</span>
        </div>

        <label class="beep-enable">
          <input
            type="checkbox"
            id="beepEnabled_${cue.code}"
            ${config.enabled ? "checked" : ""}
          >
          Gunakan Custom Audio
        </label>
      </div>

      <div class="beep-audio-card-body">
        <div class="beep-current-file">
          <span>File tersimpan</span>
          <strong>${
            config.original_name ||
            (hasStoredFile ? "Custom audio" : "Belum ada")
          }</strong>
          <small>${
            hasStoredFile
              ? `${config.mime_type || "audio"} · ${formatBytes(config.size_bytes)}`
              : "Fallback: built-in beep"
          }</small>
        </div>

        <label class="field">
          <span>Pilih Audio Baru</span>
          <input
            id="beepFile_${cue.code}"
            type="file"
            accept="audio/mpeg,audio/mp4,audio/ogg,.mp3,.m4a,.ogg"
          >
          <small id="beepPending_${cue.code}">
            Belum ada file baru dipilih.
          </small>
        </label>

        <div class="beep-audio-actions">
          <button
            type="button"
            class="btn light"
            data-beep-action="preview"
            data-cue="${cue.code}"
          >
            ▶ Preview
          </button>

          <button
            type="button"
            class="btn primary btn-save"
            data-beep-action="save"
            data-cue="${cue.code}"
          >
            Simpan Audio
          </button>

          <button
            type="button"
            class="btn btn-cancel"
            data-beep-action="cancel"
            data-cue="${cue.code}"
          >
            Batal Pilihan
          </button>

          <button
            type="button"
            class="btn danger"
            data-beep-action="delete"
            data-cue="${cue.code}"
            ${hasStoredFile ? "" : "disabled"}
          >
            Hapus Audio
          </button>
        </div>

        <div class="beep-storage-meta">
          ${
            hasStoredFile
              ? `Private Storage · ${config.storage_path}`
              : "Tidak ada custom asset."
          }
        </div>
      </div>
    `;

    mount.appendChild(card);
  }

  bindCardEvents();
}

function bindCardEvents() {
  for (const cue of BEEP_CUES) {
    const input = document.getElementById(`beepFile_${cue.code}`);

    input?.addEventListener("change", () => {
      const file = input.files?.[0] || null;

      if (!file) {
        beepState.pendingFiles.delete(cue.code);
        updatePendingLabel(cue.code, null);
        return;
      }

      try {
        validateAudioFile(file);
        beepState.pendingFiles.set(cue.code, file);
        updatePendingLabel(cue.code, file);
        clearBeepStatus();
      } catch (error) {
        input.value = "";
        beepState.pendingFiles.delete(cue.code);
        updatePendingLabel(cue.code, null);
        showBeepStatus(error.message, true);
      }
    });
  }

  document
    .getElementById("beepAudioGrid")
    ?.querySelectorAll("[data-beep-action]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const cueCode = button.dataset.cue;
        const action = button.dataset.beepAction;

        if (action === "preview") {
          await previewCue(cueCode);
        } else if (action === "save") {
          await saveCue(cueCode, button);
        } else if (action === "cancel") {
          cancelPending(cueCode);
        } else if (action === "delete") {
          await deleteCue(cueCode, button);
        }
      });
    });
}

function updatePendingLabel(cueCode, file) {
  const label =
    document.getElementById(`beepPending_${cueCode}`);

  if (!label) return;

  label.textContent = file
    ? `${file.name} · ${formatBytes(file.size)}`
    : "Belum ada file baru dipilih.";
}

function stopPreview() {
  if (beepState.previewAudio) {
    try {
      beepState.previewAudio.pause();
      beepState.previewAudio.currentTime = 0;
    } catch {
      // no-op
    }
  }

  beepState.previewAudio = null;

  if (beepState.previewObjectUrl) {
    URL.revokeObjectURL(beepState.previewObjectUrl);
  }

  beepState.previewObjectUrl = null;
}

async function previewCue(cueCode) {
  clearBeepStatus();
  stopPreview();

  const pending = beepState.pendingFiles.get(cueCode);

  try {
    let url;

    if (pending) {
      validateAudioFile(pending);
      url = URL.createObjectURL(pending);
      beepState.previewObjectUrl = url;
    } else {
      const config =
        beepState.config[cueCode] || defaultCueConfig();

      if (!config.storage_bucket || !config.storage_path) {
        throw new Error(
          "Belum ada custom audio untuk dipreview."
        );
      }

      const { data, error } = await beepDb.storage
        .from(config.storage_bucket)
        .createSignedUrl(config.storage_path, 60 * 60);

      if (error) throw error;
      if (!data?.signedUrl) {
        throw new Error("signed_audio_url_missing");
      }

      url = data.signedUrl;
    }

    const audio = new Audio(url);
    audio.preload = "auto";
    beepState.previewAudio = audio;

    await audio.play();

    showBeepStatus(
      `Preview ${cueCode.toUpperCase()} sedang diputar.`
    );
  } catch (error) {
    console.error(error);
    stopPreview();
    showBeepStatus(
      error?.message || "Gagal memutar preview audio.",
      true
    );
  }
}

function cancelPending(cueCode) {
  stopPreview();

  beepState.pendingFiles.delete(cueCode);

  const input =
    document.getElementById(`beepFile_${cueCode}`);

  if (input) input.value = "";

  const config =
    beepState.config[cueCode] || defaultCueConfig();

  const enabled =
    document.getElementById(`beepEnabled_${cueCode}`);

  if (enabled) enabled.checked = Boolean(config.enabled);

  updatePendingLabel(cueCode, null);
  clearBeepStatus();
}

async function uploadAudio(cueCode, file) {
  validateAudioFile(file);

  const ext = extensionForMime(file.type);
  const original = safeFileName(file.name);
  const path =
    `${BEEP_PATH_PREFIX}/${cueCode}/` +
    `${Date.now()}-${crypto.randomUUID()}-${original}.${ext}`;

  const { error } = await beepDb.storage
    .from(BEEP_STORAGE_BUCKET)
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type,
    });

  if (error) throw error;

  return {
    enabled: true,
    storage_bucket: BEEP_STORAGE_BUCKET,
    storage_path: path,
    mime_type: file.type,
    original_name: file.name.slice(0, 180),
    size_bytes: file.size,
  };
}

async function removeStorageObject(config) {
  if (!config?.storage_bucket || !config?.storage_path) return;

  const { error } = await beepDb.storage
    .from(config.storage_bucket)
    .remove([config.storage_path]);

  if (error) throw error;
}

async function saveCue(cueCode, button) {
  clearBeepStatus();
  stopPreview();

  const oldConfig =
    beepState.config[cueCode] || defaultCueConfig();

  const pending =
    beepState.pendingFiles.get(cueCode) || null;

  const enabledInput =
    document.getElementById(`beepEnabled_${cueCode}`);

  const requestedEnabled = Boolean(enabledInput?.checked);

  let uploaded = null;

  button.disabled = true;

  try {
    let nextCue = { ...oldConfig };

    if (pending) {
      uploaded = await uploadAudio(cueCode, pending);
      nextCue = uploaded;
    }

    if (requestedEnabled && !nextCue.storage_path) {
      throw new Error(
        "Upload audio terlebih dahulu sebelum mengaktifkan custom audio."
      );
    }

    nextCue.enabled = Boolean(
      requestedEnabled && nextCue.storage_path
    );

    const nextConfig = cloneConfig();
    nextConfig[cueCode] = nextCue;

    const { data, error } = await beepDb
      .from("tv_system_settings")
      .update({ beep_audio_config: nextConfig })
      .eq("id", 1)
      .select("id,beep_audio_config")
      .single();

    if (error) throw error;

    beepState.config = normalizeBeepConfig(
      data.beep_audio_config
    );

    if (
      uploaded &&
      oldConfig.storage_bucket &&
      oldConfig.storage_path &&
      (
        oldConfig.storage_bucket !== uploaded.storage_bucket ||
        oldConfig.storage_path !== uploaded.storage_path
      )
    ) {
      try {
        await removeStorageObject(oldConfig);
      } catch (cleanupError) {
        console.warn(
          "old_beep_audio_cleanup_failed",
          cleanupError?.message || "cleanup_failed"
        );
      }
    }

    beepState.pendingFiles.delete(cueCode);

    showBeepStatus(
      `${cueCode.toUpperCase()} custom audio berhasil disimpan. ` +
      "Belum dipublish ke revision TV."
    );

    renderCards();
  } catch (error) {
    console.error(error);

    if (uploaded) {
      try {
        await removeStorageObject(uploaded);
      } catch {
        // rollback cleanup best effort
      }
    }

    showBeepStatus(
      error?.message || "Gagal menyimpan custom beep audio.",
      true
    );
  } finally {
    button.disabled = false;
  }
}

async function deleteCue(cueCode, button) {
  clearBeepStatus();
  stopPreview();

  const oldConfig =
    beepState.config[cueCode] || defaultCueConfig();

  if (!oldConfig.storage_path) {
    showBeepStatus("Tidak ada custom audio untuk dihapus.", true);
    return;
  }

  const confirmed = window.confirm(
    `Hapus custom audio ${cueCode.toUpperCase()}? ` +
    "Cue akan kembali memakai built-in beep."
  );

  if (!confirmed) return;

  button.disabled = true;

  try {
    const nextConfig = cloneConfig();
    nextConfig[cueCode] = defaultCueConfig();

    const { data, error } = await beepDb
      .from("tv_system_settings")
      .update({ beep_audio_config: nextConfig })
      .eq("id", 1)
      .select("id,beep_audio_config")
      .single();

    if (error) throw error;

    beepState.config = normalizeBeepConfig(
      data.beep_audio_config
    );

    let cleanupWarning = "";

    try {
      await removeStorageObject(oldConfig);
    } catch (cleanupError) {
      console.warn(
        "beep_audio_storage_cleanup_failed",
        cleanupError?.message || "cleanup_failed"
      );
      cleanupWarning =
        " Metadata sudah dihapus, tetapi cleanup object storage perlu dicek.";
    }

    beepState.pendingFiles.delete(cueCode);

    showBeepStatus(
      `${cueCode.toUpperCase()} custom audio dihapus. ` +
      `Fallback built-in beep aktif.${cleanupWarning}`
    );

    renderCards();
  } catch (error) {
    console.error(error);
    showBeepStatus(
      error?.message || "Gagal menghapus custom beep audio.",
      true
    );
  } finally {
    button.disabled = false;
  }
}

async function loadBeepAudioSettings() {
  const { data, error } = await beepDb
    .from("tv_system_settings")
    .select(
      [
        "id",
        "beep_audio_config",
        "beep_adhan_count",
        "beep_iqamah_count",
        "beep_forbidden_count",
        "beep_isyraq_count",
        "beep_imsak_count",
      ].join(",")
    )
    .eq("id", 1)
    .single();

  if (error) throw error;

  beepState.settings = data;
  beepState.config = normalizeBeepConfig(
    data.beep_audio_config
  );

  renderCards();
}

async function bootstrapBeepAudio() {
  createPanel();

  const { data, error } = await beepDb.auth.getSession();

  if (error) throw error;
  if (!data.session) return;

  await loadBeepAudioSettings();
}

bootstrapBeepAudio().catch((error) => {
  console.error(error);

  try {
    createPanel();
  } catch {
    // no-op
  }

  showBeepStatus(
    error?.message || "Gagal memuat Custom Beep Audio.",
    true
  );
});

window.addEventListener("pagehide", stopPreview);
