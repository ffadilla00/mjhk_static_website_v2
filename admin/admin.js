const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const db=window.mjhkSupabase;
const MONTHS=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MAX_FILE_SIZE=5*1024*1024;
let kajianData=[],mediaData=[],keuanganData=[],pendingDelete=null;

function fmtDate(s){if(!s)return"";const[y,m,d]=s.split("-").map(Number);return `${d} ${MONTHS[m-1]} ${y}`}
function fmtPeriod(a,b){if(!a||!b)return"";const[ya,ma,da]=a.split("-").map(Number),[yb,mb,dbb]=b.split("-").map(Number);if(ya===yb&&ma===mb)return `${da} sampai ${dbb} ${MONTHS[mb-1]} ${yb}`;if(ya===yb)return `${da} ${MONTHS[ma-1]} sampai ${dbb} ${MONTHS[mb-1]} ${yb}`;return `${da} ${MONTHS[ma-1]} ${ya} sampai ${dbb} ${MONTHS[mb-1]} ${yb}`}
function toast(message,type="info"){const node=document.createElement("div");node.className=`toast ${type}`;node.textContent=message;$("#toastRegion").appendChild(node);setTimeout(()=>node.remove(),4500)}
function setBusy(form,busy){const button=form.querySelector('button[type="submit"]');if(!button)return;if(busy){button.dataset.label=button.textContent;button.textContent="Memproses..."}else button.textContent=button.dataset.label||"Simpan";button.disabled=busy;form.querySelectorAll("button, input, select, textarea").forEach(control=>{if(control!==button)control.disabled=busy})}
function tab(t){$$(".view").forEach(v=>v.classList.add("hidden"));$("#view-"+t).classList.remove("hidden");$$(".menu button").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));$("#pageTitle").textContent={dashboard:"Dashboard",kajian:"Kajian & Kegiatan",media:"Media YouTube",keuangan:"Laporan Keuangan"}[t]}
$$(".menu button").forEach(b=>b.onclick=()=>tab(b.dataset.tab));

async function requireAuth(){const {data:{session}}=await db.auth.getSession();if(!session){location.href="login.html";return false}$("#adminIdentity").textContent=`Login sebagai ${session.user.email}`;return true}
$("#logoutBtn").onclick=async()=>{const button=$("#logoutBtn");button.disabled=true;button.textContent="Logout...";await db.auth.signOut();location.href="login.html"};

async function loadAll(){
  ["#kajianRows","#mediaRows","#keuanganRows"].forEach(selector=>$(selector).innerHTML='<tr><td colspan="6" class="loading-row">Memuat data...</td></tr>');
  const[k,m,f]=await Promise.all([
    db.from("kajian").select("*").order("tanggal",{ascending:false}),
    db.from("media").select("*").order("tanggal",{ascending:false}),
    db.from("keuangan").select("*").order("periode_akhir",{ascending:false}).order("tanggal_publish",{ascending:false})
  ]);
  if(k.error||m.error||f.error)throw (k.error||m.error||f.error);
  kajianData=k.data||[];mediaData=m.data||[];keuanganData=f.data||[];refresh();
}
function refresh(){
  $("#statKajian").textContent=kajianData.length;$("#statMedia").textContent=mediaData.length;$("#statKeuangan").textContent=keuanganData.length;
  $("#kajianRows").innerHTML=kajianData.map(x=>`<tr><td>${x.jenis||""}</td><td><b>${x.judul||""}</b><br>${x.tema||""}</td><td>${x.penceramah||""}</td><td>${fmtDate(x.tanggal)}<br>${x.waktu||""}</td><td><span class="status">${x.status}</span></td><td><div class="actions"><button class="small edit" onclick="editK(${x.id})">Edit</button><button class="small delete" onclick="deleteKajian(${x.id},this)">Hapus</button></div></td></tr>`).join("")||'<tr><td colspan="6" class="loading-row">Belum ada data.</td></tr>';
  $("#mediaRows").innerHTML=mediaData.map(x=>`<tr><td><b>${x.judul||""}</b></td><td>${x.kategori||""}</td><td>${x.youtube_url||""}</td><td>${fmtDate(x.tanggal)}</td><td><span class="status">${x.status}</span></td><td><div class="actions"><button class="small edit" onclick="editM(${x.id})">Edit</button><button class="small delete" onclick="deleteMedia(${x.id},this)">Hapus</button></div></td></tr>`).join("")||'<tr><td colspan="6" class="loading-row">Belum ada data.</td></tr>';
  $("#keuanganRows").innerHTML=keuanganData.map(x=>`<tr><td><b>${fmtPeriod(x.periode_awal,x.periode_akhir)}</b></td><td>${fmtDate(x.periode_awal)}</td><td>${fmtDate(x.periode_akhir)}</td><td>${fmtDate(x.tanggal_publish)}</td><td><span class="status">${x.status}</span></td><td><div class="actions"><button class="small edit" onclick="editF(${x.id})">Edit</button><button class="small delete" onclick="deleteFinance(${x.id},this)">Hapus</button></div></td></tr>`).join("")||'<tr><td colspan="6" class="loading-row">Belum ada data.</td></tr>';
}
function clearPreview(wrap,img,meta){$(wrap).classList.add("hidden");$(img).removeAttribute("src");$(meta).textContent=""}
function showPreview(file,wrap,img,meta){if(!file){clearPreview(wrap,img,meta);return}const reader=new FileReader();reader.onload=()=>{$(img).src=reader.result;$(meta).innerHTML=`Sumber: File lokal<br>Nama file: ${file.name}<br>Ukuran: ${(file.size/(1024*1024)).toFixed(2)} MB`;$(wrap).classList.remove("hidden")};reader.readAsDataURL(file)}
function storageFileName(url){if(!url)return"";const clean=url.split(/[?#]/)[0],encoded=clean.slice(clean.lastIndexOf("/")+1);try{return decodeURIComponent(encoded)}catch(err){return encoded}}
function showStoredPreview(url,wrap,img,meta){if(!url){clearPreview(wrap,img,meta);return}$(img).src=url;const name=storageFileName(url);$(meta).innerHTML=`Sumber: Supabase Storage${name?`<br>Nama file: ${name}`:""}`;$(wrap).classList.remove("hidden")}
function validateFile(file){if(!file)return true;if(!["image/jpeg","image/png"].includes(file.type)){toast("File harus berformat JPG atau PNG.","error");return false}if(file.size>MAX_FILE_SIZE){toast("Ukuran file maksimal 5 MB.","error");return false}return true}
function openF(n){$("#"+n+"FormWrap").classList.remove("hidden");$("#"+n+"Form").reset();$("#"+n+"Id").value="";if(n==="kajian"){$("#posterLama").value="";clearPreview("#posterPreviewWrap","#posterPreview","#posterPreviewMeta")}if(n==="keuangan"){$("#keuanganImageLama").value="";clearPreview("#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta");updatePeriodPreview()}}
function closeF(n){$("#"+n+"FormWrap").classList.add("hidden");if(n==="kajian")clearPreview("#posterPreviewWrap","#posterPreview","#posterPreviewMeta");if(n==="keuangan")clearPreview("#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta")} window.closeF=closeF;
$("#addKajian").onclick=()=>openF("kajian");$("#addMedia").onclick=()=>openF("media");$("#addKeuangan").onclick=()=>openF("keuangan");
function safeName(n){return n.toLowerCase().replace(/[^a-z0-9._-]+/g,"-")}
function storagePath(url,bucket){if(!url)return"";const marker=`/storage/v1/object/public/${bucket}/`,i=url.indexOf(marker);return i>=0?decodeURIComponent(url.slice(i+marker.length)):""}
async function upload(bucket,file,prefix){const name=`${prefix}-${Date.now()}-${safeName(file.name)}`;const {error}=await db.storage.from(bucket).upload(name,file,{cacheControl:"3600",upsert:false,contentType:file.type});if(error)throw error;return db.storage.from(bucket).getPublicUrl(name).data.publicUrl}
async function removeFile(bucket,url){const p=storagePath(url,bucket);if(p){const {error}=await db.storage.from(bucket).remove([p]);if(error)throw error}}
function yid(u){const m=(u||"").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);return m?m[1]:""}

$("#posterFile").onchange=()=>{const file=$("#posterFile").files[0];if(validateFile(file))showPreview(file,"#posterPreviewWrap","#posterPreview","#posterPreviewMeta");else{$("#posterFile").value="";clearPreview("#posterPreviewWrap","#posterPreview","#posterPreviewMeta")}};
$("#keuanganImage").onchange=()=>{const file=$("#keuanganImage").files[0];if(validateFile(file))showPreview(file,"#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta");else{$("#keuanganImage").value="";clearPreview("#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta")}};
$("#kajianForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{
  const id=+$("#kajianId").value||null,file=$("#posterFile").files[0];if(!validateFile(file))return;let poster=$("#posterLama").value||null;
  if(file){const old=poster;poster=await upload("poster-kajian",file,"kajian");if(old)await removeFile("poster-kajian",old)}
  const payload={jenis:$("#jenis").value.trim(),judul:$("#judul").value.trim(),tema:$("#tema").value.trim()||null,penceramah:$("#penceramah").value.trim()||null,tanggal:$("#tanggal").value||null,waktu:$("#waktu").value.trim()||null,poster_url:poster,status:$("#kajianStatus").value};
  const {error}=id?await db.from("kajian").update(payload).eq("id",id):await db.from("kajian").insert(payload);if(error)throw error;closeF("kajian");toast(id?"Agenda berhasil diperbarui.":"Agenda berhasil ditambahkan.","success");await loadAll();
}catch(err){toast(err.message,"error")}finally{setBusy(form,false)}};
$("#mediaForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{const id=+$("#mediaId").value||null,url=$("#youtubeUrl").value.trim(),payload={judul:$("#mediaJudul").value.trim(),kategori:$("#mediaKategori").value.trim()||null,youtube_url:url,youtube_id:yid(url),tanggal:$("#mediaTanggal").value||null,status:$("#mediaStatus").value};const {error}=id?await db.from("media").update(payload).eq("id",id):await db.from("media").insert(payload);if(error)throw error;closeF("media");toast(id?"Video berhasil diperbarui.":"Video berhasil ditambahkan.","success");await loadAll()}catch(err){toast(err.message,"error")}finally{setBusy(form,false)}};
function updatePeriodPreview(){const a=$("#periodeAwal").value,b=$("#periodeAkhir").value;$("#periodPreview").textContent=a&&b?fmtPeriod(a,b):"Pilih periode awal dan periode akhir."}
$("#periodeAwal").onchange=()=>{const a=$("#periodeAwal").value;$("#periodeAkhir").min=a||"";if(a&&$("#periodeAkhir").value<a)$("#periodeAkhir").value=a;updatePeriodPreview()};$("#periodeAkhir").onchange=updatePeriodPreview;
$("#keuanganForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{
  const id=+$("#keuanganId").value||null,a=$("#periodeAwal").value,b=$("#periodeAkhir").value,file=$("#keuanganImage").files[0];if(b<a)throw new Error("Periode akhir tidak boleh lebih awal dari periode awal.");if(!id&&!file)throw new Error("File laporan wajib diupload.");if(!validateFile(file))return;let image=$("#keuanganImageLama").value||null;
  if(file){const old=image;image=await upload("laporan-keuangan",file,"laporan");if(old)await removeFile("laporan-keuangan",old)}
  const payload={periode_awal:a,periode_akhir:b,tanggal_publish:$("#publishDate").value,image_url:image,status:$("#keuanganStatus").value};const {error}=id?await db.from("keuangan").update(payload).eq("id",id):await db.from("keuangan").insert(payload);if(error)throw error;closeF("keuangan");toast(id?"Laporan berhasil diperbarui.":"Laporan berhasil ditambahkan.","success");await loadAll();
}catch(err){toast(err.message,"error")}finally{setBusy(form,false)}};
window.editK=id=>{const x=kajianData.find(x=>x.id===id);openF("kajian");$("#kajianId").value=x.id;$("#jenis").value=x.jenis||"";$("#judul").value=x.judul||"";$("#tema").value=x.tema||"";$("#penceramah").value=x.penceramah||"";$("#tanggal").value=x.tanggal||"";$("#waktu").value=x.waktu||"";$("#kajianStatus").value=x.status||"publish";$("#posterLama").value=x.poster_url||"";showStoredPreview(x.poster_url,"#posterPreviewWrap","#posterPreview","#posterPreviewMeta")};
window.editM=id=>{const x=mediaData.find(x=>x.id===id);openF("media");$("#mediaId").value=x.id;$("#mediaJudul").value=x.judul||"";$("#mediaKategori").value=x.kategori||"";$("#youtubeUrl").value=x.youtube_url||"";$("#mediaTanggal").value=x.tanggal||"";$("#mediaStatus").value=x.status||"publish"};
window.editF=id=>{const x=keuanganData.find(x=>x.id===id);openF("keuangan");$("#keuanganId").value=x.id;$("#periodeAwal").value=x.periode_awal||"";$("#periodeAkhir").value=x.periode_akhir||"";$("#publishDate").value=x.tanggal_publish||"";$("#keuanganStatus").value=x.status||"publish";$("#keuanganImageLama").value=x.image_url||"";showStoredPreview(x.image_url,"#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta");updatePeriodPreview()};
function askDelete(message){return new Promise(resolve=>{pendingDelete=resolve;$("#confirmMessage").textContent=message;$("#confirmModal").classList.remove("hidden")})}
function finishDelete(answer){$("#confirmModal").classList.add("hidden");if(pendingDelete){pendingDelete(answer);pendingDelete=null}}
$("#cancelDelete").onclick=()=>finishDelete(false);$("#confirmDelete").onclick=()=>finishDelete(true);
async function deleteRecord(kind,id,button){if(!await askDelete("Data ini akan dihapus dan tidak dapat dikembalikan."))return;try{if(button)button.disabled=true;let x,error;if(kind==="kajian"){x=kajianData.find(x=>x.id===id);({error}=await db.from("kajian").delete().eq("id",id))}else if(kind==="media"){({error}=await db.from("media").delete().eq("id",id))}else{x=keuanganData.find(x=>x.id===id);({error}=await db.from("keuangan").delete().eq("id",id))}if(error)throw error;if(kind==="kajian"&&x&&x.poster_url)await removeFile("poster-kajian",x.poster_url);if(kind==="keuangan"&&x&&x.image_url)await removeFile("laporan-keuangan",x.image_url);toast("Data berhasil dihapus.","success");await loadAll()}catch(err){toast(err.message,"error")}finally{if(button)button.disabled=false}}
window.deleteKajian=(id,button)=>deleteRecord("kajian",id,button);window.deleteMedia=(id,button)=>deleteRecord("media",id,button);window.deleteFinance=(id,button)=>deleteRecord("keuangan",id,button);
(async()=>{try{if(await requireAuth())await loadAll()}catch(err){toast(err.message,"error")}})();
