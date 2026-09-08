const db=window.mjhkSupabase;
const pages=[
  {slug:"sejarah",label:"Sejarah"},
  {slug:"visi-misi",label:"Visi & Misi"},
  {slug:"struktur-dkm",label:"Struktur DKM"},
  {slug:"program-fasilitas",label:"Program & Fasilitas"}
];
let activeSlug=pages[0].slug;
const $=s=>document.querySelector(s);

function toast(message,error=false){
  const el=$("#toast");el.textContent=message;el.className=`toast show ${error?"error":""}`;
  setTimeout(()=>el.className="toast",2600);
}
function renderPreview(){
  const raw=marked.parse($("#contentMarkdown").value||"");
  $("#preview").innerHTML=DOMPurify.sanitize(raw,{USE_PROFILES:{html:true}});
}
function setEditor(text,before,after=""){
  const el=$("#contentMarkdown"),start=el.selectionStart,end=el.selectionEnd,sel=el.value.slice(start,end);
  el.setRangeText(`${before}${sel}${after}`,start,end,"end");el.focus();renderPreview();
}
function applyToolbar(type){
  const actions={
    bold:()=>setEditor("", "**","**"),
    italic:()=>setEditor("", "*","*"),
    h2:()=>setEditor("", "## "),
    ul:()=>setEditor("", "- "),
    ol:()=>setEditor("", "1. "),
    quote:()=>setEditor("", "> "),
    table:()=>setEditor("", "| Kolom 1 | Kolom 2 |\\n| --- | --- |\\n| Isi | Isi |\\n"),
    link:()=>setEditor("", "[Teks link](",")")
  };
  actions[type]?.();
}
function renderTabs(){
  $("#profileTabs").innerHTML=pages.map(p=>`<button class="tab ${p.slug===activeSlug?"active":""}" data-slug="${p.slug}">${p.label}</button>`).join("");
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{activeSlug=b.dataset.slug;renderTabs();loadPage()});
}
async function requireSession(){
  const {data:{session}}=await db.auth.getSession();
  if(!session){location.href="login.html";return null}
  $("#adminIdentity").textContent=`Login sebagai ${session.user.email}`;
  return session;
}
async function loadPage(){
  $("#saveState").textContent="Memuat...";
  const {data,error}=await db.from("profile_pages").select("*").eq("slug",activeSlug).maybeSingle();
  if(error){toast(error.message,true);$("#saveState").textContent="";return}
  $("#pageId").value=data?.id||"";
  $("#judul").value=data?.judul||pages.find(p=>p.slug===activeSlug)?.label||"";
  $("#ringkasan").value=data?.ringkasan||"";
  $("#contentMarkdown").value=data?.content_markdown||"";
  $("#status").value=data?.status||"draft";
  $("#saveState").textContent="";
  renderPreview();
}
async function uploadImage(file){
  if(!file)return;
  if(file.size>5*1024*1024){toast("Ukuran gambar maksimal 5 MB.",true);return}
  const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";
  const safeBase=file.name.replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]+/g,"-").toLowerCase();
  const storagePath=`${activeSlug}/${Date.now()}-${safeBase}.${ext}`;
  $("#saveState").textContent="Mengupload gambar...";
  const {error}=await db.storage.from("profile-content").upload(storagePath,file,{upsert:false,contentType:file.type});
  if(error){$("#saveState").textContent="";toast(error.message,true);return}
  const {data}=db.storage.from("profile-content").getPublicUrl(storagePath);
  const md=`\\n![${safeBase}](${data.publicUrl})\\n`;
  const el=$("#contentMarkdown");
  el.setRangeText(md,el.selectionStart,el.selectionEnd,"end");
  $("#saveState").textContent="";
  renderPreview();toast("Gambar berhasil diupload.");
}
async function savePage(e){
  e.preventDefault();
  const btn=$("#saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  const payload={
    slug:activeSlug,
    judul:$("#judul").value.trim(),
    ringkasan:$("#ringkasan").value.trim()||null,
    content_markdown:$("#contentMarkdown").value,
    status:$("#status").value,
    urutan:pages.findIndex(p=>p.slug===activeSlug)+1,
    updated_at:new Date().toISOString()
  };
  const {error}=await db.from("profile_pages").upsert(payload,{onConflict:"slug"});
  btn.disabled=false;btn.textContent="Simpan";
  if(error){toast(error.message,true);return}
  toast("Profile berhasil disimpan.");loadPage();
}

document.addEventListener("DOMContentLoaded",async()=>{
  if(!db)return;
  const session=await requireSession();if(!session)return;
  renderTabs();await loadPage();
  $("#contentMarkdown").addEventListener("input",renderPreview);
  document.querySelectorAll("[data-md]").forEach(b=>b.onclick=()=>applyToolbar(b.dataset.md));
  $("#uploadImageBtn").onclick=()=>$("#imageInput").click();
  $("#imageInput").onchange=e=>uploadImage(e.target.files?.[0]);
  $("#profileForm").addEventListener("submit",savePage);
  $("#logoutBtn").onclick=async()=>{await db.auth.signOut();location.href="login.html"};
});
