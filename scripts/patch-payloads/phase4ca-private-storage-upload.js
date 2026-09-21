const db = window.mjhkSupabase;

const CONTENT_TYPES =
  Object.freeze(["image", "text", "image_text"]);

const STORAGE_BUCKET = "tv-content";
const STORAGE_PREFIX = "cms-slideshow";
const PREVIEW_TTL_SECONDS = 3600;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
  Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const $ = (selector) =>
  document.querySelector(selector);

const state = {
  session: null,
  contents: [],
  editing: null,
  deleting: null,
};

let pendingImageFile = null;
let pendingObjectUrl = null;

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
  $("#adminIdentity").textContent =
    `Login sebagai ${session.user.email}`;

  return session;
}

async function loadContents() {
  setLoading(true);
  hide("#permissionBanner");

  try {
    const { data, error } =
      await db
        .from("tv_content")
        .select(
          "id,title,content_type,source_type,source_id,storage_url,body_text,metadata,status,created_by,created_at,updated_at,storage_bucket,storage_path"
        )
        .in("content_type", CONTENT_TYPES)
        .order("updated_at", {
          ascending: false,
        });

    if (error) throw error;

    state.contents =
      await hydratePrivatePreviews(data ?? []);

    renderContents();

    showStatus(
      `Content Library diperbarui ${formatDateTime(new Date().toISOString())}.`,
      "success",
      2200
    );
  } catch (error) {
    console.error(
      "MJHK TV content load failed",
      safeErrorCode(error)
    );

    if (isPermissionError(error)) {
      showPermission(
        "Session valid, tetapi RLS menolak akses ke tv_content/tv-content Storage. Pastikan akun memiliki hak is_mjhk_admin()."
      );
    } else {
      showPermission(
        `Content Library gagal dimuat: ${safeMessage(error)}`
      );
    }
  } finally {
    setLoading(false);
  }
}

async function hydratePrivatePreviews(items) {
  return Promise.all(
    items.map(async (item) => {
      if (
        item.storage_bucket === STORAGE_BUCKET &&
        item.storage_path
      ) {
        const { data, error } =
          await db.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(
              item.storage_path,
              PREVIEW_TTL_SECONDS
            );

        if (!error && data?.signedUrl) {
          return Object.freeze({
            ...item,
            _preview_url: data.signedUrl,
          });
        }
      }

      return Object.freeze({
        ...item,
        _preview_url:
          normalizedHttpsUrl(
            item.storage_url
          ),
      });
    })
  );
}

function renderContents() {
  const grid = $("#contentGrid");
  grid.replaceChildren();

  const typeFilter =
    $("#typeFilter").value;
  const statusFilter =
    $("#statusFilter").value;

  const filtered =
    state.contents.filter((item) => {
      if (
        typeFilter &&
        item.content_type !== typeFilter
      ) {
        return false;
      }

      if (
        statusFilter &&
        item.status !== statusFilter
      ) {
        return false;
      }

      return true;
    });

  $("#contentSummary").textContent =
    `${filtered.length} dari ${state.contents.length} konten`;

  if (!filtered.length) {
    const empty =
      document.createElement("div");
    empty.className = "empty-card";
    empty.textContent =
      state.contents.length
        ? "Tidak ada konten sesuai filter."
        : "Content Library masih kosong. Klik “+ Konten Baru” untuk membuat draft slideshow pertama.";
    grid.append(empty);
    return;
  }

  for (const item of filtered) {
    grid.append(renderCard(item));
  }
}

function renderCard(item) {
  const card =
    document.createElement("article");
  card.className = "content-card";
  card.tabIndex = 0;
  card.dataset.contentId = item.id;

  const preview =
    document.createElement("div");
  preview.className = "card-preview";
  renderPreview(preview, item);

  const body =
    document.createElement("div");
  body.className = "card-body";

  const head =
    document.createElement("div");
  head.className = "card-head";

  const title =
    document.createElement("strong");
  title.textContent = item.title;

  head.append(
    title,
    badge(
      item.status || "unknown",
      item.status === "draft"
        ? "draft"
        : "neutral"
    )
  );

  const meta =
    document.createElement("div");
  meta.className = "card-meta";
  meta.append(
    badge(item.content_type, "neutral"),
    badge(
      `${durationOf(item)} detik`,
      "neutral"
    )
  );

  if (item.metadata?.fullscreen) {
    meta.append(
      badge("fullscreen", "neutral")
    );
  }

  const foot =
    document.createElement("div");
  foot.className = "card-foot";

  const schedule =
    document.createElement("span");
  schedule.textContent =
    scheduleLabel(item);

  const updated =
    document.createElement("span");
  updated.textContent =
    formatDateTime(item.updated_at);

  foot.append(schedule, updated);
  body.append(head, meta, foot);
  card.append(preview, body);

  card.addEventListener(
    "click",
    () => openEditor(item)
  );

  card.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openEditor(item);
      }
    }
  );

  return card;
}

function renderPreview(parent, item) {
  if (
    item.content_type === "image" ||
    item.content_type === "image_text"
  ) {
    const imageUrl =
      item._preview_url ||
      normalizedHttpsUrl(
        item.storage_url
      );

    if (imageUrl) {
      const image =
        document.createElement("img");
      image.src = imageUrl;
      image.alt =
        item.metadata?.alt_text ||
        item.title ||
        "Preview image";
      image.loading = "lazy";
      image.addEventListener(
        "error",
        () => {
          image.remove();
          appendPreviewPlaceholder(
            parent,
            "Preview gambar tidak tersedia"
          );
        },
        { once: true }
      );
      parent.append(image);

      if (
        item.content_type === "image"
      ) {
        return;
      }
    }
  }

  if (
    item.content_type === "text" ||
    item.content_type === "image_text"
  ) {
    const box =
      document.createElement("div");
    box.className = "preview-text";

    const heading =
      document.createElement("strong");
    heading.textContent =
      item.metadata?.heading ||
      item.title;

    const text =
      document.createElement("span");
    text.textContent =
      item.body_text ||
      item.metadata?.body ||
      "Tidak ada body text.";

    box.append(heading, text);
    parent.append(box);
    return;
  }

  appendPreviewPlaceholder(
    parent,
    "Preview belum tersedia"
  );
}

function appendPreviewPlaceholder(
  parent,
  message
) {
  const node =
    document.createElement("span");
  node.className =
    "preview-placeholder";
  node.textContent = message;
  parent.append(node);
}

function bindUploadUx() {
  const zone = $("#uploadZone");
  const input = $("#imageFileInput");
  const replace = $("#replaceImageBtn");

  if (!zone || !input) return;

  const choose = () => input.click();

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

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragover");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");

    const file =
      event.dataTransfer?.files?.[0];

    if (file) {
      acceptImageFile(file);
    }
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];

    if (file) {
      acceptImageFile(file);
    }
  });

  replace?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    choose();
  });
}

function acceptImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    showFormError(
      "Format gambar harus JPG, PNG, atau WebP."
    );
    return;
  }

  if (file.size > MAX_IMAGE_BYTES) {
    showFormError(
      "Ukuran gambar maksimal 10 MB."
    );
    return;
  }

  pendingImageFile = file;
  $("#pendingImageFileName").value =
    file.name;

  if (pendingObjectUrl) {
    URL.revokeObjectURL(
      pendingObjectUrl
    );
  }

  pendingObjectUrl =
    URL.createObjectURL(file);

  $("#uploadPreviewImage").src =
    pendingObjectUrl;
  $("#uploadFileName").textContent =
    file.name;
  $("#uploadFileMeta").textContent =
    `${formatBytes(file.size)} • ${file.type}`;

  $("#uploadEmptyState")
    .classList.add("hidden");

  $("#uploadPreview")
    .classList.remove("hidden");

  hide("#formError");
}

function hydrateUploadPreview(item) {
  resetPendingImage();

  const currentUrl =
    item?._preview_url ||
    normalizedHttpsUrl(
      item?.storage_url
    );

  if (currentUrl) {
    $("#uploadPreviewImage").src =
      currentUrl;
    $("#uploadFileName").textContent =
      item?.title ||
      "Gambar tersimpan";
    $("#uploadFileMeta").textContent =
      item?.storage_path
        ? `Private Storage • ${item.storage_path}`
        : "Media existing";
    $("#uploadEmptyState")
      .classList.add("hidden");
    $("#uploadPreview")
      .classList.remove("hidden");
  } else {
    $("#uploadPreviewImage")
      .removeAttribute("src");
    $("#uploadFileName").textContent =
      "—";
    $("#uploadFileMeta").textContent =
      "—";
    $("#uploadPreview")
      .classList.add("hidden");
    $("#uploadEmptyState")
      .classList.remove("hidden");
  }
}

function resetPendingImage() {
  pendingImageFile = null;

  const fileInput =
    $("#imageFileInput");

  if (fileInput) {
    fileInput.value = "";
  }

  if (pendingObjectUrl) {
    URL.revokeObjectURL(
      pendingObjectUrl
    );
    pendingObjectUrl = null;
  }
}

function openEditor(item = null) {
  state.editing = item;

  $("#editorTitle").textContent =
    item ? "Edit Draft" : "Konten Baru";

  $("#contentId").value =
    item?.id || "";
  $("#titleInput").value =
    item?.title || "";
  $("#contentTypeInput").value =
    item?.content_type || "image";
  $("#durationInput").value =
    durationOf(item) || 15;
  $("#headingInput").value =
    item?.metadata?.heading || "";
  $("#bodyInput").value =
    item?.body_text ||
    item?.metadata?.body ||
    "";
  $("#altTextInput").value =
    item?.metadata?.alt_text || "";
  $("#fullscreenInput").checked =
    Boolean(item?.metadata?.fullscreen);
  $("#alwaysShowInput").checked =
    item?.metadata?.always_show !== false;

  $("#startsAtInput").value =
    toLocalDateTime(
      item?.metadata?.starts_at
    );

  $("#endsAtInput").value =
    toLocalDateTime(
      item?.metadata?.ends_at
    );

  hydrateUploadPreview(item);

  $("#deleteBtn").classList.toggle(
    "hidden",
    !item
  );

  hide("#formError");
  syncEditorVisibility();
  $("#editorDialog").showModal();
}

function syncEditorVisibility() {
  const type =
    $("#contentTypeInput").value;

  const needsImage =
    type === "image" ||
    type === "image_text";

  const needsText =
    type === "text" ||
    type === "image_text";

  document
    .querySelectorAll(".media-field")
    .forEach((node) =>
      node.classList.toggle(
        "hidden",
        !needsImage
      )
    );

  document
    .querySelectorAll(".image-alt-field")
    .forEach((node) =>
      node.classList.toggle(
        "hidden",
        !needsImage
      )
    );

  document
    .querySelectorAll(".text-field")
    .forEach((node) =>
      node.classList.toggle(
        "hidden",
        !needsText
      )
    );
}

async function saveEditor(event) {
  event.preventDefault();
  hide("#formError");

  let basePayload;

  try {
    basePayload =
      buildContentPayload();
  } catch (error) {
    showFormError(error.message);
    return;
  }

  const saveButton =
    $("#saveBtn");
  saveButton.disabled = true;
  saveButton.textContent =
    "Menyimpan...";

  let uploadedPath = null;

  try {
    const oldStoragePath =
      state.editing?.storage_bucket === STORAGE_BUCKET
        ? state.editing.storage_path
        : null;

    const needsImage =
      basePayload.content_type === "image" ||
      basePayload.content_type === "image_text";

    let storageFields = {
      storage_bucket:
        needsImage
          ? state.editing?.storage_bucket || null
          : null,
      storage_path:
        needsImage
          ? state.editing?.storage_path || null
          : null,
      storage_url: null,
    };

    if (
      needsImage &&
      pendingImageFile
    ) {
      uploadedPath =
        await uploadPendingImage(
          pendingImageFile
        );

      storageFields = {
        storage_bucket:
          STORAGE_BUCKET,
        storage_path:
          uploadedPath,
        storage_url: null,
      };
    }

    if (
      needsImage &&
      !storageFields.storage_path
    ) {
      throw new Error(
        "Pilih gambar untuk diupload."
      );
    }

    const payload = {
      ...basePayload,
      ...storageFields,
    };

    let result;

    if (state.editing) {
      result =
        await db
          .from("tv_content")
          .update(payload)
          .eq(
            "id",
            state.editing.id
          )
          .select(
            "id,title,content_type,status,storage_bucket,storage_path,updated_at"
          )
          .single();
    } else {
      result =
        await db
          .from("tv_content")
          .insert(payload)
          .select(
            "id,title,content_type,status,storage_bucket,storage_path,updated_at"
          )
          .single();
    }

    if (result.error) {
      throw result.error;
    }

    const newStoragePath =
      result.data?.storage_bucket === STORAGE_BUCKET
        ? result.data.storage_path
        : null;

    if (
      oldStoragePath &&
      oldStoragePath !== newStoragePath
    ) {
      void removeStoredObject(
        oldStoragePath
      );
    }

    $("#editorDialog").close();

    showStatus(
      state.editing
        ? "Draft berhasil diperbarui."
        : "Draft berhasil dibuat.",
      "success",
      2600
    );

    state.editing = null;
    resetPendingImage();

    await loadContents();
  } catch (error) {
    if (uploadedPath) {
      await removeStoredObject(
        uploadedPath
      );
    }

    console.error(
      "MJHK TV content save failed",
      safeErrorCode(error)
    );

    showFormError(
      safeMessage(error)
    );
  } finally {
    saveButton.disabled = false;
    saveButton.textContent =
      "Simpan Draft";
  }
}

async function uploadPendingImage(file) {
  if (!state.session?.user?.id) {
    throw new Error(
      "Session admin tidak tersedia."
    );
  }

  const extension =
    extensionForMime(file.type);

  const path = [
    STORAGE_PREFIX,
    state.session.user.id,
    `${Date.now()}-${crypto.randomUUID()}.${extension}`,
  ].join("/");

  const { error } =
    await db.storage
      .from(STORAGE_BUCKET)
      .upload(
        path,
        file,
        {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        }
      );

  if (error) throw error;

  return path;
}

async function removeStoredObject(path) {
  if (!path) return;

  const { error } =
    await db.storage
      .from(STORAGE_BUCKET)
      .remove([path]);

  if (error) {
    console.warn(
      "MJHK TV storage cleanup failed",
      safeErrorCode(error)
    );
  }
}

function buildContentPayload() {
  const title =
    $("#titleInput").value.trim();

  const contentType =
    $("#contentTypeInput").value;

  const duration =
    Number.parseInt(
      $("#durationInput").value,
      10
    );

  if (!title) {
    throw new Error(
      "Judul wajib diisi."
    );
  }

  if (
    !CONTENT_TYPES.includes(
      contentType
    )
  ) {
    throw new Error(
      "Tipe konten tidak valid."
    );
  }

  if (
    !Number.isInteger(duration) ||
    duration < 3 ||
    duration > 300
  ) {
    throw new Error(
      "Durasi harus 3–300 detik."
    );
  }

  const startsAt =
    fromLocalDateTime(
      $("#startsAtInput").value
    );

  const endsAt =
    fromLocalDateTime(
      $("#endsAtInput").value
    );

  if (
    startsAt &&
    endsAt &&
    new Date(endsAt) <=
      new Date(startsAt)
  ) {
    throw new Error(
      "Selesai tayang harus setelah mulai tayang."
    );
  }

  const imageRequired =
    contentType === "image" ||
    contentType === "image_text";

  const textRequired =
    contentType === "text" ||
    contentType === "image_text";

  const heading =
    $("#headingInput").value.trim();

  const body =
    $("#bodyInput").value.trim();

  if (
    textRequired &&
    !heading
  ) {
    throw new Error(
      "Heading wajib untuk tipe text/image_text."
    );
  }

  if (
    textRequired &&
    !body
  ) {
    throw new Error(
      "Body wajib untuk tipe text/image_text."
    );
  }

  if (
    imageRequired &&
    !pendingImageFile &&
    !state.editing?.storage_path
  ) {
    throw new Error(
      "Pilih gambar untuk diupload."
    );
  }

  const metadata = {
    duration_seconds: duration,
    fullscreen:
      $("#fullscreenInput").checked,
    always_show:
      $("#alwaysShowInput").checked,
    starts_at: startsAt,
    ends_at: endsAt,
  };

  if (imageRequired) {
    metadata.alt_text =
      $("#altTextInput").value.trim() ||
      title;
  }

  if (textRequired) {
    metadata.heading = heading;
    metadata.body = body;
  }

  return {
    title,
    content_type: contentType,
    body_text:
      textRequired ? body : null,
    metadata,
    status: "draft",
  };
}

function requestDelete() {
  if (!state.editing) return;

  state.deleting =
    state.editing;

  $("#deleteMessage").textContent =
    `“${state.editing.title}” akan dihapus permanen dari draft Content Library.`;

  $("#deleteDialog").showModal();
}

async function confirmDelete() {
  if (!state.deleting) return;

  const button =
    $("#confirmDeleteBtn");
  button.disabled = true;
  button.textContent =
    "Menghapus...";

  const storagePath =
    state.deleting.storage_bucket === STORAGE_BUCKET
      ? state.deleting.storage_path
      : null;

  try {
    const { error } =
      await db
        .from("tv_content")
        .delete()
        .eq(
          "id",
          state.deleting.id
        );

    if (error) throw error;

    if (storagePath) {
      await removeStoredObject(
        storagePath
      );
    }

    $("#deleteDialog").close();
    $("#editorDialog").close();

    showStatus(
      "Draft berhasil dihapus.",
      "success",
      2600
    );

    state.editing = null;
    state.deleting = null;
    resetPendingImage();

    await loadContents();
  } catch (error) {
    console.error(
      "MJHK TV content delete failed",
      safeErrorCode(error)
    );

    $("#deleteDialog").close();
    showFormError(
      `Gagal menghapus: ${safeMessage(error)}`
    );
  } finally {
    button.disabled = false;
    button.textContent =
      "Ya, Hapus";
  }
}

function extensionForMime(type) {
  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function durationOf(item) {
  const value =
    item?.metadata?.duration_seconds;

  return Number.isInteger(value)
    ? value
    : 15;
}

function scheduleLabel(item) {
  const start =
    item?.metadata?.starts_at;
  const end =
    item?.metadata?.ends_at;

  if (!start && !end) {
    return "Tanpa jadwal";
  }

  if (start && end) {
    return `${formatDateTime(start)} → ${formatDateTime(end)}`;
  }

  if (start) {
    return `Mulai ${formatDateTime(start)}`;
  }

  return `Sampai ${formatDateTime(end)}`;
}

function normalizedHttpsUrl(value) {
  const text =
    String(value || "").trim();

  if (!text) return null;

  try {
    const url = new URL(text);

    return url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function toLocalDateTime(value) {
  if (!value) return "";

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) =>
    String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function fromLocalDateTime(value) {
  if (!value) return null;

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "Format tanggal/jam tidak valid."
    );
  }

  return date.toISOString();
}

function badge(label, className) {
  const node =
    document.createElement("span");
  node.className =
    `badge ${className || "neutral"}`;
  node.textContent =
    String(label || "unknown");
  return node;
}

function showStatus(
  message,
  type = "",
  timeout = 0
) {
  const banner =
    $("#statusBanner");

  banner.textContent = message;
  banner.className = "banner";

  if (type) {
    banner.classList.add(type);
  }

  banner.classList.remove("hidden");

  if (timeout > 0) {
    window.setTimeout(
      () =>
        banner.classList.add(
          "hidden"
        ),
      timeout
    );
  }
}

function showPermission(message) {
  const banner =
    $("#permissionBanner");
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function showFormError(message) {
  const node =
    $("#formError");
  node.textContent = message;
  node.classList.remove("hidden");
}

function hide(selector) {
  $(selector)?.classList.add(
    "hidden"
  );
}

function setLoading(loading) {
  const refresh =
    $("#refreshBtn");
  const create =
    $("#newBtn");

  refresh.disabled = loading;
  create.disabled = loading;

  refresh.textContent =
    loading
      ? "Memuat..."
      : "Refresh";
}

function formatDateTime(value) {
  if (!value) return "—";

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function formatBytes(bytes) {
  if (
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPermissionError(error) {
  const code =
    String(error?.code || "")
      .toUpperCase();

  const message =
    String(error?.message || "")
      .toLowerCase();

  return (
    code === "42501" ||
    code === "PGRST301" ||
    message.includes(
      "permission denied"
    ) ||
    message.includes(
      "row-level security"
    )
  );
}

function safeMessage(error) {
  return String(
    error?.message ||
    "unknown_error"
  )
    .replace(
      /Bearer\s+\S+/gi,
      "Bearer [redacted]"
    )
    .slice(0, 300);
}

function safeErrorCode(error) {
  return String(
    error?.code ||
    error?.name ||
    "content_error"
  )
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )
    .slice(0, 80);
}

$("#refreshBtn").addEventListener(
  "click",
  () => void loadContents()
);

$("#newBtn").addEventListener(
  "click",
  () => openEditor()
);

$("#contentTypeInput")
  .addEventListener(
    "change",
    syncEditorVisibility
  );

$("#editorForm").addEventListener(
  "submit",
  saveEditor
);

$("#closeEditorBtn")
  .addEventListener(
    "click",
    () =>
      $("#editorDialog").close()
  );

$("#cancelBtn").addEventListener(
  "click",
  () =>
    $("#editorDialog").close()
);

$("#deleteBtn").addEventListener(
  "click",
  requestDelete
);

$("#cancelDeleteBtn")
  .addEventListener(
    "click",
    () => {
      state.deleting = null;
      $("#deleteDialog").close();
    }
  );

$("#confirmDeleteBtn")
  .addEventListener(
    "click",
    () =>
      void confirmDelete()
  );

$("#typeFilter").addEventListener(
  "change",
  renderContents
);

$("#statusFilter").addEventListener(
  "change",
  renderContents
);

(async () => {
  bindUploadUx();

  try {
    const session =
      await requireSession();

    if (session) {
      await loadContents();
    }
  } catch (error) {
    showPermission(
      `Gagal memuat sesi admin: ${safeMessage(error)}`
    );
  }
})();
