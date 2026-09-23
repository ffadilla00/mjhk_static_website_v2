const db = window.mjhkSupabase;

if (!db) {
  throw new Error("mjhk_supabase_client_unavailable");
}

const LOCKED = Object.freeze([
  { runtime: "PRE_ADHAN", label: "Pre-Adhan", note: "Runtime-owned MJHK screen." },
  { runtime: "IQAMAH_COUNTDOWN", label: "Iqamah Countdown", note: "Countdown behavior is runtime-owned." },
  { runtime: "FRIDAY_PRE_ADHAN", label: "Friday Pre-Adhan", note: "Runtime-owned Friday sequence." },
]);

const EDITABLE = Object.freeze([
  { runtime: "ADHAN", source: "ADHAN_PAUSE", label: "Adhan", rule: "Beep memakai beep_adhan_count." },
  { runtime: "IQAMAH", source: "IQAMAH_PAUSE", label: "Iqamah", rule: "Beep memakai beep_iqamah_count." },
  { runtime: "SALAT", source: "SALAT", label: "Salat", rule: "Presentation-only. Timing tetap runtime-owned." },
  { runtime: "PRAYER_PROHIBITION", source: "FORBIDDEN_PRAYER", label: "Prayer Prohibition", rule: "Presentation-only." },
  { runtime: "SYURUQ", source: "SYURUQ_WAIT", label: "Syuruq", rule: "Wait duration di Prayer Settings, bukan editor ini." },
  { runtime: "ISYRAQ", source: "ISYRAQ", label: "Isyraq", rule: "Beep setiap hari setelah SYURUQ wait selesai." },
  { runtime: "IMSAK", source: "IMSAK", label: "Imsak", rule: "Screen + beep hanya efektif saat Ramadan mode aktif." },
  { runtime: "FRIDAY_KHUTBAH", source: "JUMAT_ADHAN_KHUTBAH", label: "Friday Khutbah", rule: "Presentation-only." },
  { runtime: "FRIDAY_SALAT", source: "SALAT_JUMAT", label: "Friday Salat", rule: "Presentation-only." },
]);

const $ = (id) => document.getElementById(id);
const state = { session: null, assets: new Map(), contents: [], editing: null };

function safeText(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
  $("sessionLabel").textContent = `Login sebagai ${session.user.email || "admin"}`;
}

async function loadSources() {
  $("loadState").textContent = "Memuat source…";

  const { data: assets, error: assetError } =
    await db.from("tv_state_assets")
      .select("state_code,content_id,enabled,notes,updated_at")
      .in("state_code", EDITABLE.map((x) => x.source));

  if (assetError) throw assetError;
state.assets = new Map((assets || []).map((row) => [row.state_code, row]));
  render();
  $("loadState").textContent = `${state.assets.size} source state`;
}

function contentTitle(contentId) {
  return contentId ? "Media dedicated terpasang" : "Belum ada konten";
}

function renderLocked() {
  const grid = $("lockedGrid");
  grid.replaceChildren();

  for (const item of LOCKED) {
    const card = el("article", "screen-card locked");
    const top = el("div", "screen-top");
    const title = el("div");
    title.append(el("h3", "", item.label), el("div", "screen-meta", item.runtime));
    top.append(title, el("span", "status locked", "LOCKED"));
    card.append(top, el("div", "screen-meta", item.note));
    grid.append(card);
  }
}

function renderEditable() {
  const grid = $("editableGrid");
  grid.replaceChildren();

  for (const def of EDITABLE) {
    const asset = state.assets.get(def.source);
    const card = el("article", "screen-card");
    const top = el("div", "screen-top");
    const title = el("div");
    title.append(el("h3", "", def.label), el("div", "screen-meta", `${def.runtime} ← ${def.source}`));

    const enabled = asset?.enabled !== false;
    top.append(title, el("span", `status ${enabled ? "enabled" : "disabled"}`, enabled ? "AKTIF" : "NONAKTIF"));

    const meta = el("div", "screen-meta");
    meta.style.whiteSpace = "pre-line";
    meta.textContent = `Konten: ${contentTitle(asset?.content_id)}\nRule: ${def.rule}`;

    const btn = el("button", "btn", "Edit Source");
    btn.type = "button";
    btn.addEventListener("click", () => openEditor(def));

    card.append(top, meta, btn);
    grid.append(card);
  }
}

function render() {
  renderLocked();
  renderEditable();
}


const DEDICATED_SOURCE_TYPE = "dedicated_screen";
const DEDICATED_BUCKET = "tv-content";
const DEDICATED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEDICATED_MAX_BYTES = 10 * 1024 * 1024;

function validateDedicatedFile(file) {
  if (!file) throw new Error("Pilih gambar terlebih dahulu.");
  if (!DEDICATED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Format gambar harus JPG, PNG, atau WebP.");
  }
  if (file.size > DEDICATED_MAX_BYTES) {
    throw new Error("Ukuran gambar maksimal 10 MB.");
  }
}

function safeDedicatedName(name) {
  return String(name || "screen")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function dedicatedStoragePath(stateCode, file) {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const raw = safeDedicatedName(file.name || "screen");
  return `cms-dedicated-screen/${stateCode.toLowerCase()}/${Date.now()}-${raw}.${ext}`;
}

function setDedicatedPreview(url) {
  const img = $("dedicatedPreviewImage");
  const empty = $("dedicatedPreviewEmpty");
  const replaceBtn = $("replaceDedicatedImageBtn");
  const removeBtn = $("removeDedicatedImageBtn");

  if (url) {
    img.src = url;
    img.classList.remove("hidden");
    empty.classList.add("hidden");
    replaceBtn.classList.remove("hidden");
    removeBtn.classList.remove("hidden");
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
    empty.classList.remove("hidden");
    replaceBtn.classList.add("hidden");
    removeBtn.classList.add("hidden");
  }
}

async function getDedicatedContent(contentId) {
  if (!contentId) return null;

  const { data, error } = await db.from("tv_content")
    .select("id,title,content_type,source_type,source_id,storage_bucket,storage_path,status")
    .eq("id", contentId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function hydrateDedicatedMedia(contentId) {
  state.pendingDedicatedFile = null;
  state.removeDedicatedMedia = false;
  state.dedicatedSignedUrl = null;

  $("editContentId").value = contentId || "";

  if (!contentId) {
    setDedicatedPreview(null);
    return;
  }

  const content = await getDedicatedContent(contentId);
  if (!content || content.source_type !== DEDICATED_SOURCE_TYPE) {
    $("editContentId").value = "";
    setDedicatedPreview(null);
    return;
  }

  if (content.storage_bucket && content.storage_path) {
    const { data, error } = await db.storage
      .from(content.storage_bucket)
      .createSignedUrl(content.storage_path, 60 * 60);

    if (error) throw error;

    state.dedicatedSignedUrl = data?.signedUrl || null;
    setDedicatedPreview(state.dedicatedSignedUrl);
  } else {
    setDedicatedPreview(null);
  }
}

async function removeStorageObject(bucket, path) {
  if (!bucket || !path) return;
  const { error } = await db.storage.from(bucket).remove([path]);
  if (error) throw error;
}

async function persistDedicatedMedia(stateCode, existingContentId) {
  const oldContent = existingContentId
    ? await getDedicatedContent(existingContentId)
    : null;

  if (state.removeDedicatedMedia) {
    const { error: mappingError } = await db.from("tv_state_assets")
      .update({
        content_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("state_code", stateCode);

    if (mappingError) throw mappingError;

    if (oldContent?.source_type === DEDICATED_SOURCE_TYPE) {
      const { error: deleteError } = await db.from("tv_content")
        .delete()
        .eq("id", oldContent.id)
        .eq("source_type", DEDICATED_SOURCE_TYPE)
        .eq("source_id", stateCode);

      if (deleteError) throw deleteError;

      await removeStorageObject(oldContent.storage_bucket, oldContent.storage_path);
    }

    return null;
  }

  if (!state.pendingDedicatedFile) {
    return existingContentId || null;
  }

  validateDedicatedFile(state.pendingDedicatedFile);

  const newPath = dedicatedStoragePath(stateCode, state.pendingDedicatedFile);

  const { error: uploadError } = await db.storage
    .from(DEDICATED_BUCKET)
    .upload(newPath, state.pendingDedicatedFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: state.pendingDedicatedFile.type,
    });

  if (uploadError) throw uploadError;

  try {
    const payload = {
      title: `Dedicated Screen · ${stateCode}`,
      content_type: "image",
      source_type: DEDICATED_SOURCE_TYPE,
      source_id: stateCode,
      storage_url: null,
      body_text: null,
      metadata: {
        role: "dedicated_screen",
        state_code: stateCode,
        aspect_ratio: "16:9",
      },
      status: "draft",
      storage_bucket: DEDICATED_BUCKET,
      storage_path: newPath,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: contentError } = await db.from("tv_content")
      .upsert(payload, { onConflict: "source_type,source_id" })
      .select("id")
      .single();

    if (contentError) throw contentError;

    const { error: mappingError } = await db.from("tv_state_assets")
      .update({
        content_id: saved.id,
        updated_at: new Date().toISOString(),
      })
      .eq("state_code", stateCode);

    if (mappingError) throw mappingError;

    if (
      oldContent?.source_type === DEDICATED_SOURCE_TYPE &&
      oldContent.storage_bucket &&
      oldContent.storage_path &&
      (
        oldContent.storage_bucket !== DEDICATED_BUCKET ||
        oldContent.storage_path !== newPath
      )
    ) {
      await removeStorageObject(oldContent.storage_bucket, oldContent.storage_path);
    }

    return saved.id;
  } catch (error) {
    try {
      await removeStorageObject(DEDICATED_BUCKET, newPath);
    } catch (_) {}
    throw error;
  }
}

function bindDedicatedUploadUi() {
  const input = $("dedicatedImageInput");
  const zone = $("dedicatedUploadZone");
  const replaceBtn = $("replaceDedicatedImageBtn");
  const removeBtn = $("removeDedicatedImageBtn");

  const choose = () => input.click();

  zone.addEventListener("click", choose);
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose();
    }
  });

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });

  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    try {
      validateDedicatedFile(file);
      state.pendingDedicatedFile = file;
      state.removeDedicatedMedia = false;
      setDedicatedPreview(URL.createObjectURL(file));
    } catch (error) {
      alert(error.message);
    }
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      validateDedicatedFile(file);
      state.pendingDedicatedFile = file;
      state.removeDedicatedMedia = false;
      setDedicatedPreview(URL.createObjectURL(file));
    } catch (error) {
      input.value = "";
      alert(error.message);
    }
  });

  replaceBtn.addEventListener("click", choose);

  removeBtn.addEventListener("click", () => {
    state.pendingDedicatedFile = null;
    state.removeDedicatedMedia = true;
    input.value = "";
    setDedicatedPreview(null);
  });
}


function openEditor(def) {
  const asset = state.assets.get(def.source) || {
    state_code: def.source, content_id: null, enabled: true, notes: "",
  };

  state.editing = def;
  $("dialogTitle").textContent = def.label;
  $("editStateCode").value = def.source;
  $("editRuntimeState").value = `${def.runtime} ← ${def.source}`;
  $("editEnabled").checked = asset.enabled !== false;
  $("editNotes").value = asset.notes || "";
  $("specialRule").textContent = def.rule;
  $("editorDialog").showModal();
  void hydrateDedicatedMedia(asset.content_id).catch((error) => {
    console.error("[MJHK TV 4D-A2 media hydrate]", error);
    alert(`Gagal memuat media Dedicated Screen: ${safeText(error?.message, "unknown_error")}`);
  });
}

async function saveEditor(event) {
  event.preventDefault();
  if (!state.editing) return;

  const payload = {
    state_code: $("editStateCode").value,
    content_id: $("editContentId").value || null,
    enabled: $("editEnabled").checked,
    notes: $("editNotes").value.trim() || null,
  };

  if (!EDITABLE.some((item) => item.source === payload.state_code)) {
    throw new Error("state_code_not_editable");
  }

  $("saveBtn").disabled = true;
  $("saveBtn").textContent = "Menyimpan…";

  try {
    payload.content_id = await persistDedicatedMedia(payload.state_code, payload.content_id);

    const { error } = await db.from("tv_state_assets")
      .update({
        content_id: payload.content_id,
        enabled: payload.enabled,
        notes: payload.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("state_code", payload.state_code);

    if (error) throw error;

    state.pendingDedicatedFile = null;
    state.removeDedicatedMedia = false;
    $("dedicatedImageInput").value = "";

    $("editorDialog").close();
    await loadSources();
  } catch (error) {
    alert(`Gagal menyimpan Dedicated Screen: ${safeText(error?.message, "unknown_error")}`);
  } finally {
    $("saveBtn").disabled = false;
    $("saveBtn").textContent = "Simpan Source";
  }
}

async function boot() {
  try {
    await requireAdminSession();
    renderLocked();
    await loadSources();
  } catch (error) {
    console.error("[MJHK TV 4D-A2]", error);
    $("loadState").textContent = safeText(error?.message, "Gagal memuat Dedicated Screens");
  }
}

bindDedicatedUploadUi();

$("refreshBtn").addEventListener("click", loadSources);
$("editorForm").addEventListener("submit", saveEditor);
void boot();
