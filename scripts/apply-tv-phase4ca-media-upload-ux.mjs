#!/usr/bin/env node
import fs from "node:fs";

const HTML = "admin/tv-content.html";
const CSS = "admin/tv-content.css";
const JS = "admin/tv-content.js";

for (const file of [HTML, CSS, JS]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
}

let html = fs.readFileSync(HTML, "utf8");
let css = fs.readFileSync(CSS, "utf8");
let js = fs.readFileSync(JS, "utf8");

// Replace URL-first image field with upload-first UI.
const oldHtml = /<label class="field span-2 media-field">[\s\S]*?<input id="imageUrlInput"[^>]*>[\s\S]*?<\/label>/;

const newHtml = `
        <div class="field span-2 media-field">
          <span>Gambar</span>

          <div class="upload-zone" id="uploadZone" tabindex="0" role="button" aria-label="Pilih gambar untuk diupload">
            <input
              id="imageFileInput"
              class="upload-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            >

            <div class="upload-empty" id="uploadEmptyState">
              <div class="upload-icon" aria-hidden="true">⬆</div>
              <strong>Upload gambar</strong>
              <span>Klik atau drag &amp; drop file JPG, PNG, atau WebP</span>
              <small>File akan disimpan ke Supabase Storage setelah storage contract dikonfirmasi.</small>
            </div>

            <div class="upload-preview hidden" id="uploadPreview">
              <img id="uploadPreviewImage" alt="Preview gambar">
              <div class="upload-preview-meta">
                <strong id="uploadFileName">—</strong>
                <span id="uploadFileMeta">—</span>
                <button type="button" class="btn light" id="replaceImageBtn">Ganti Gambar</button>
              </div>
            </div>
          </div>

          <input id="imageUrlInput" type="hidden">
          <input id="pendingImageFileName" type="hidden">
        </div>`;

if (!oldHtml.test(html)) {
  throw new Error("URL-first media field anchor tidak ditemukan.");
}

html = html.replace(oldHtml, newHtml);

if (!html.includes('id="imageFileInput"')) {
  throw new Error("Upload file input gagal terpasang.");
}

fs.writeFileSync(HTML, html, "utf8");

// Add upload UI styles.
if (!css.includes(".upload-zone{")) {
  css += `

.upload-zone{
  position:relative;
  min-height:180px;
  border:1.5px dashed #9bb5aa;
  border-radius:14px;
  background:#f7faf8;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  cursor:pointer;
  transition:.15s ease;
  overflow:hidden;
}
.upload-zone:hover,
.upload-zone:focus{
  border-color:var(--green);
  background:#f1f7f4;
  outline:none;
  box-shadow:0 0 0 3px rgba(22,77,59,.08);
}
.upload-zone.dragover{
  border-color:var(--green);
  background:#eaf4ef;
}
.upload-input{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  opacity:0;
  cursor:pointer;
}
.upload-empty{
  pointer-events:none;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:6px;
  text-align:center;
  color:var(--muted);
}
.upload-empty strong{
  color:var(--text);
  font-size:14px;
}
.upload-empty span{
  font-size:12px;
}
.upload-empty small{
  font-size:10px;
}
.upload-icon{
  width:46px;
  height:46px;
  border-radius:50%;
  display:flex;
  align-items:center;
  justify-content:center;
  background:var(--green);
  color:white;
  font-size:24px;
  line-height:1;
}
.upload-preview{
  width:100%;
  display:grid;
  grid-template-columns:180px minmax(0,1fr);
  gap:16px;
  align-items:center;
}
.upload-preview img{
  width:180px;
  height:120px;
  object-fit:cover;
  border-radius:10px;
  border:1px solid var(--border);
  background:#eef3f0;
}
.upload-preview-meta{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:6px;
}
.upload-preview-meta strong{
  font-size:13px;
  word-break:break-word;
}
.upload-preview-meta span{
  font-size:11px;
  color:var(--muted);
}
.upload-preview-meta .btn{
  margin-top:4px;
}
@media(max-width:760px){
  .upload-preview{
    grid-template-columns:1fr;
  }
  .upload-preview img{
    width:100%;
    height:180px;
  }
}
`;

  fs.writeFileSync(CSS, css, "utf8");
}

// Inject upload UX behavior without changing DB mutation contract yet.
const anchor = 'function syncEditorVisibility() {';

if (!js.includes("function bindUploadUx()")) {
  const helper = `
let pendingImageFile = null;
let pendingObjectUrl = null;

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

    const file = event.dataTransfer?.files?.[0];
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
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  if (!allowed.has(file.type)) {
    showFormError("Format gambar harus JPG, PNG, atau WebP.");
    return;
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    showFormError("Ukuran gambar maksimal 10 MB.");
    return;
  }

  pendingImageFile = file;
  $("#pendingImageFileName").value = file.name;

  if (pendingObjectUrl) {
    URL.revokeObjectURL(pendingObjectUrl);
  }

  pendingObjectUrl = URL.createObjectURL(file);

  $("#uploadPreviewImage").src = pendingObjectUrl;
  $("#uploadFileName").textContent = file.name;
  $("#uploadFileMeta").textContent =
    \`\${formatBytes(file.size)} • \${file.type}\`;

  $("#uploadEmptyState").classList.add("hidden");
  $("#uploadPreview").classList.remove("hidden");

  hide("#formError");
}

function hydrateUploadPreview(item) {
  pendingImageFile = null;

  if (pendingObjectUrl) {
    URL.revokeObjectURL(pendingObjectUrl);
    pendingObjectUrl = null;
  }

  const currentUrl =
    item?.storage_url ||
    item?.metadata?.image_url ||
    "";

  if (currentUrl) {
    $("#imageUrlInput").value = currentUrl;
    $("#uploadPreviewImage").src = currentUrl;
    $("#uploadFileName").textContent =
      item?.title || "Gambar tersimpan";
    $("#uploadFileMeta").textContent =
      "Media existing";
    $("#uploadEmptyState").classList.add("hidden");
    $("#uploadPreview").classList.remove("hidden");
  } else {
    $("#imageUrlInput").value = "";
    $("#uploadPreviewImage").removeAttribute("src");
    $("#uploadFileName").textContent = "—";
    $("#uploadFileMeta").textContent = "—";
    $("#uploadPreview").classList.add("hidden");
    $("#uploadEmptyState").classList.remove("hidden");
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return \`\${bytes} B\`;
  if (bytes < 1024 * 1024) return \`\${(bytes / 1024).toFixed(1)} KB\`;
  return \`\${(bytes / (1024 * 1024)).toFixed(1)} MB\`;
}

`;

  js = js.replace(anchor, helper + anchor);
}

// hydrate preview when editor opens.
const oldUrlHydrate = `  $("#imageUrlInput").value =
    item?.storage_url ||
    item?.metadata?.image_url ||
    "";`;

const newUrlHydrate = `  hydrateUploadPreview(item);`;

if (js.includes(oldUrlHydrate)) {
  js = js.replace(oldUrlHydrate, newUrlHydrate);
}

// Change validation: file is accepted UX-wise but saving is blocked until storage wiring exists.
// Existing stored URL is still acceptable for editing old records.
const oldImageValidation = `  const imageUrl =
    normalizedHttpsUrl(
      $("#imageUrlInput").value
    );

  if (
    imageRequired &&
    !imageUrl
  ) {
    throw new Error(
      "Image URL HTTPS wajib untuk tipe ini."
    );
  }`;

const newImageValidation = `  const imageUrl =
    normalizedHttpsUrl(
      $("#imageUrlInput").value
    );

  if (
    imageRequired &&
    pendingImageFile
  ) {
    throw new Error(
      "File sudah dipilih, tetapi upload Storage belum diaktifkan. Jalankan audit Storage 4C-A.1 terlebih dahulu."
    );
  }

  if (
    imageRequired &&
    !imageUrl
  ) {
    throw new Error(
      "Pilih gambar melalui Upload. Penyimpanan file akan diaktifkan setelah audit Storage selesai."
    );
  }`;

if (!js.includes(oldImageValidation)) {
  throw new Error("Image validation anchor tidak ditemukan.");
}

js = js.replace(oldImageValidation, newImageValidation);

// Bind UX on startup.
const startupAnchor = `(async () => {
  try {`;

if (!js.includes("bindUploadUx();")) {
  js = js.replace(
    startupAnchor,
    `(async () => {
  bindUploadUx();

  try {`
  );
}

fs.writeFileSync(JS, js, "utf8");

console.log("[PASS] Image editor diubah menjadi upload-first UX.");
console.log("[INFO] DB upload belum diaktifkan sampai storage bucket/policy audit selesai.");
