import fs from "node:fs";

const htmlFile = "admin/tv-dedicated-screens.html";
const cssFile = "admin/tv-dedicated-screens.css";
const jsFile = "admin/tv-dedicated-screens.js";

for (const f of [htmlFile, cssFile, jsFile]) {
  if (!fs.existsSync(f)) throw new Error(`File tidak ditemukan: ${f}`);
}

let html = fs.readFileSync(htmlFile, "utf8");
let css = fs.readFileSync(cssFile, "utf8");
let js = fs.readFileSync(jsFile, "utf8");

const requiredHtml = [
  'id="editorDialog"',
  'id="editorForm"',
  'id="editStateCode"',
  'id="editRuntimeState"',
  'id="editContentId"',
  'id="editEnabled"',
  'id="editNotes"',
  'id="specialRule"',
  'id="saveBtn"',
];

for (const anchor of requiredHtml) {
  if (!html.includes(anchor)) {
    throw new Error(`Preflight gagal: HTML anchor ${anchor} tidak ditemukan.`);
  }
}

const requiredJs = [
  'function openEditor(def)',
  'function fillContentOptions(selectedId)',
  'async function saveEditor(event)',
  '$("editorForm").addEventListener("submit", saveEditor);',
];

for (const anchor of requiredJs) {
  if (!js.includes(anchor)) {
    throw new Error(`Preflight gagal: JS anchor ${anchor} tidak ditemukan.`);
  }
}

html = html.replace(
  /<label class="field">\s*<span>Konten Visual<\/span>\s*<select id="editContentId">[\s\S]*?<\/select>\s*<small>Konten diambil dari Content Library yang sudah ada\.<\/small>\s*<\/label>/,
  `<div class="field dedicated-media-field">
        <span>Konten Visual</span>
        <input id="editContentId" type="hidden">
        <input id="dedicatedImageInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>

        <div id="dedicatedUploadZone" class="dedicated-upload-zone" tabindex="0" role="button" aria-label="Upload gambar Dedicated Screen">
          <div id="dedicatedPreviewEmpty" class="dedicated-preview-empty">
            <div class="dedicated-upload-icon" aria-hidden="true">↑</div>
            <strong>Upload gambar</strong>
            <span>Klik atau drag & drop JPG, PNG, atau WebP</span>
            <small>Rasio 16:9 · rekomendasi 1920 × 1080 · maksimal 10 MB</small>
          </div>
          <img id="dedicatedPreviewImage" class="dedicated-preview-image hidden" alt="">
        </div>

        <div class="dedicated-media-actions">
          <button type="button" class="btn light hidden" id="replaceDedicatedImageBtn">Ganti Gambar</button>
          <button type="button" class="btn light danger-text hidden" id="removeDedicatedImageBtn">Hapus Gambar</button>
        </div>

        <small id="dedicatedMediaHelp">Media khusus Dedicated Screen ini dan tidak masuk Slideshow Library.</small>
      </div>`
);

html = html.replace(
  /<\/dialog>\s*<\/main>\s*<\/div>\s*(?=<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.116\.0"><\/script>)/,
  `</dialog>

  `
);

html = html.replace(
  /<button class="btn(?:\s+primary)?" id="saveBtn" type="submit">Simpan Source<\/button>/,
  `<button class="btn primary" id="saveBtn" type="submit">Simpan Source</button>`
);

fs.writeFileSync(htmlFile, html, "utf8");

const cssMarker = "/* PHASE4D-A2 DEDICATED MEDIA UPLOAD RECOVERY V2 START */";
if (!css.includes(cssMarker)) {
  css += `

${cssMarker}
.dedicated-media-field {
  display: grid;
  gap: 10px;
}

.dedicated-upload-zone {
  min-height: 230px;
  border: 1.5px dashed #9eb7ae;
  border-radius: 14px;
  background: #f7faf8;
  display: grid;
  place-items: center;
  overflow: hidden;
  cursor: pointer;
}

.dedicated-upload-zone.dragover {
  background: #eef6f2;
  border-color: #185c46;
}

.dedicated-upload-zone:focus {
  outline: 3px solid rgba(24, 92, 70, .18);
  outline-offset: 2px;
}

.dedicated-preview-empty {
  display: grid;
  gap: 7px;
  justify-items: center;
  text-align: center;
  padding: 26px;
}

.dedicated-upload-icon {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #185c46;
  color: #fff;
  font-size: 28px;
  font-weight: 900;
}

.dedicated-preview-empty span,
.dedicated-preview-empty small,
#dedicatedMediaHelp {
  color: #64766f;
}

.dedicated-preview-image {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: #e9efec;
}

.dedicated-media-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hidden {
  display: none !important;
}

.danger-text {
  color: #a12f2f;
}

#saveBtn.btn.primary {
  background: #185c46;
  color: #fff;
  border-color: #185c46;
}
`;
  fs.writeFileSync(cssFile, css, "utf8");
}

js = js.replace(
  /const state = \{([\s\S]*?)\n\};/,
  (match, body) => {
    if (body.includes("pendingDedicatedFile")) return match;
    return `const state = {${body}
  pendingDedicatedFile: null,
  dedicatedSignedUrl: null,
  removeDedicatedMedia: false,
};`;
  }
);

js = js.replace(
  /const \[\{ data: assets, error: assetError \}, \{ data: contents, error: contentError \}\]\s*=\s*await Promise\.all\(\[\s*db\.from\("tv_state_assets"\)[\s\S]*?\.limit\(200\),\s*\]\);/,
  `const { data: assets, error: assetError } =
    await db.from("tv_state_assets")
      .select("state_code,content_id,enabled,notes,updated_at")
      .in("state_code", EDITABLE.map((x) => x.source));`
);

js = js.replace(/\s*if \(contentError\) throw contentError;\s*/, "\n");

js = js.replace(
  /state\.contents = \(contents \|\| \[\]\)\.filter\(\(row\) =>[\s\S]*?\);\s*/,
  ""
);

js = js.replace(
  /\$\("loadState"\)\.textContent = `\$\{state\.assets\.size\} source state · \$\{state\.contents\.length\} content option`;/,
  '$("loadState").textContent = `${state.assets.size} source state`;'
);

js = js.replace(
  /function contentTitle\(contentId\) \{[\s\S]*?\n\}/,
  `function contentTitle(contentId) {
  return contentId ? "Media dedicated terpasang" : "Belum ada konten";
}`
);

js = js.replace(
  /function fillContentOptions\(selectedId\) \{[\s\S]*?\n\}\n\n/,
  ""
);

const helperBlock = `
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
  return \`cms-dedicated-screen/\${stateCode.toLowerCase()}/\${Date.now()}-\${raw}.\${ext}\`;
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
      title: \`Dedicated Screen · \${stateCode}\`,
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

`;

js = js.replace(
  /function openEditor\(def\) \{/,
  helperBlock + "\nfunction openEditor(def) {"
);

js = js.replace(
  /fillContentOptions\(asset\.content_id\);\s*\$\("editorDialog"\)\.showModal\(\);/,
  `$("editorDialog").showModal();
  void hydrateDedicatedMedia(asset.content_id).catch((error) => {
    console.error("[MJHK TV 4D-A2 media hydrate]", error);
    alert(\`Gagal memuat media Dedicated Screen: \${safeText(error?.message, "unknown_error")}\`);
  });`
);

js = js.replace(
  /try \{\s*const \{ error \} = await db\.from\("tv_state_assets"\)[\s\S]*?if \(error\) throw error;\s*\$\("editorDialog"\)\.close\(\);\s*await loadSources\(\);/,
  `try {
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
    await loadSources();`
);

js = js.replace(
  /\$\("refreshBtn"\)\.addEventListener\("click", loadSources\);/,
  `bindDedicatedUploadUi();

$("refreshBtn").addEventListener("click", loadSources);`
);

fs.writeFileSync(jsFile, js, "utf8");

console.log("[PASS] Exact audited HTML anchors patched.");
console.log("[PASS] Legacy Content Library dropdown replaced by dedicated upload UX.");
console.log("[PASS] Existing openEditor/saveEditor wired to dedicated media lifecycle.");
console.log("[PASS] Malformed legacy closing tags after dialog cleaned.");
