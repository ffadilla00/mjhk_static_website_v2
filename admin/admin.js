
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const db=window.mjhkSupabase;
const MONTHS=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
let kajianData=[],mediaData=[],keuanganData=[];

function fmtDate(s){if(!s)return"";const[y,m,d]=s.split("-").map(Number);return `${d} ${MONTHS[m-1]} ${y}`}
function fmtPeriod(a,b){if(!a||!b)return"";const[ya,ma,da]=a.split("-").map(Number),[yb,mb,dbb]=b.split("-").map(Number);if(ya===yb&&ma===mb)return `${da} sampai ${dbb} ${MONTHS[mb-1]} ${yb}`;if(ya===yb)return `${da} ${MONTHS[ma-1]} sampai ${dbb} ${MONTHS[mb-1]} ${yb}`;return `${da} ${MONTHS[ma-1]} ${ya} sampai ${dbb} ${MONTHS[mb-1]} ${yb}`}
function tab(t){$$(".view").forEach(v=>v.classList.add("hidden"));$("#view-"+t).classList.remove("hidden");$$(".menu button").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));$("#pageTitle").textContent={dashboard:"Dashboard",kajian:"Kajian & Kegiatan",media:"Media YouTube",keuangan:"Laporan Keuangan"}[t]}
$$(".menu button").forEach(b=>b.onclick=()=>tab(b.dataset.tab));

async function requireAuth(){const {data:{session}}=await db.auth.getSession();if(!session){location.href="login.html";return false}$("#adminIdentity").textContent=`Login sebagai ${session.user.email}`;return true}
$("#logoutBtn").onclick=async()=>{await db.auth.signOut();location.href="login.html"};

async function loadAll(){
 const[k,m,f]=await Promise.all([
  db.from("kajian").select("*").order("tanggal",{ascending:false}),
  db.from("media").select("*").order("tanggal",{ascending:false}),
  db.from("keuangan").select("*").order("periode_akhir",{ascending:false}).order("tanggal_publish",{ascending:false})
 ]);
 if(k.error||m.error||f.error){alert((k.error||m.error||f.error).message);return}
 kajianData=k.data||[];mediaData=m.data||[];keuanganData=f.data||[];refresh();
}
function refresh(){
 $("#statKajian").textContent=kajianData.length;$("#statMedia").textContent=mediaData.length;$("#statKeuangan").textContent=keuanganData.length;
 $("#kajianRows").innerHTML=kajianData.map(x=>`<tr><td>${x.jenis||""}</td><td><b>${x.judul||""}</b><br>${x.tema||""}</td><td>${x.penceramah||""}</td><td>${fmtDate(x.tanggal)}<br>${x.waktu||""}</td><td><span class="status">${x.status}</span></td><td><div class="actions"><button class="small edit" onclick="editK(${x.id})">Edit</button><button class="small delete" onclick="deleteKajian(${x.id})">Hapus</button></div></td></tr>`).join("");
 $("#mediaRows").innerHTML=mediaData.map(x=>`<tr><td><b>${x.judul||""}</b></td><td>${x.kategori||""}</td><td>${x.youtube_url||""}</td><td>${fmtDate(x.tanggal)}</td><td><span class="status">${x.status}</span></td><td><div class="actions"><button class="small edit" onclick="editM(${x.id})">Edit</button><button class="small delete" onclick="deleteMedia(${x.id})">Hapus</button></div></td></tr>`).join("");
 $("#keuanganRows").innerHTML=keuanganData.map(x=>`<tr><td><b>${fmtPeriod(x.periode_awal,x.periode_akhir)}</b></td><td>${fmtDate(x.periode_awal)}</td><td>${fmtDate(x.periode_akhir)}</td><td>${fmtDate(x.tanggal_publish)}</td><td><span class="status">${x.status}</span></td><td><div class="actions"><button class="small edit" onclick="editF(${x.id})">Edit</button><button class="small delete" onclick="deleteFinance(${x.id})">Hapus</button></div></td></tr>`).join("");
}
function openF(n){$("#"+n+"FormWrap").classList.remove("hidden");$("#"+n+"Form").reset();$("#"+n+"Id").value="";if(n==="kajian")$("#posterLama").value="";if(n==="keuangan"){$("#keuanganImageLama").value="";updatePeriodPreview()}}
function closeF(n){$("#"+n+"FormWrap").classList.add("hidden")} window.closeF=closeF;
$("#addKajian").onclick=()=>openF("kajian");$("#addMedia").onclick=()=>openF("media");$("#addKeuangan").onclick=()=>openF("keuangan");

function safeName(n){return n.toLowerCase().replace(/[^a-z0-9._-]+/g,"-")}
function storagePath(url,bucket){if(!url)return"";const marker=`/storage/v1/object/public/${bucket}/`,i=url.indexOf(marker);return i>=0?decodeURIComponent(url.slice(i+marker.length)):""}
async function upload(bucket,file,prefix){const name=`${prefix}-${Date.now()}-${safeName(file.name)}`;const {error}=await db.storage.from(bucket).upload(name,file,{cacheControl:"3600",upsert:false,contentType:file.type});if(error)throw error;return db.storage.from(bucket).getPublicUrl(name).data.publicUrl}
async function removeFile(bucket,url){const p=storagePath(url,bucket);if(p)await db.storage.from(bucket).remove([p])}
function yid(u){const m=(u||"").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);return m?m[1]:""}

$("#kajianForm").onsubmit=async e=>{e.preventDefault();try{
 const id=+$("#kajianId").value||null,file=$("#posterFile").files[0];let poster=$("#posterLama").value||null;
 if(file){const old=poster;poster=await upload("poster-kajian",file,"kajian");if(old)await removeFile("poster-kajian",old)}
 const payload={jenis:$("#jenis").value.trim(),judul:$("#judul").value.trim(),tema:$("#tema").value.trim()||null,penceramah:$("#penceramah").value.trim()||null,tanggal:$("#tanggal").value||null,waktu:$("#waktu").value.trim()||null,poster_url:poster,status:$("#kajianStatus").value};
 const {error}=id?await db.from("kajian").update(payload).eq("id",id):await db.from("kajian").insert(payload);if(error)throw error;closeF("kajian");await loadAll();
}catch(err){alert(err.message)}};

$("#mediaForm").onsubmit=async e=>{e.preventDefault();const id=+$("#mediaId").value||null,url=$("#youtubeUrl").value.trim(),payload={judul:$("#mediaJudul").value.trim(),kategori:$("#mediaKategori").value.trim()||null,youtube_url:url,youtube_id:yid(url),tanggal:$("#mediaTanggal").value||null,status:$("#mediaStatus").value};const {error}=id?await db.from("media").update(payload).eq("id",id):await db.from("media").insert(payload);if(error){alert(error.message);return}closeF("media");await loadAll()};

function updatePeriodPreview(){const a=$("#periodeAwal").value,b=$("#periodeAkhir").value;$("#periodPreview").textContent=a&&b?fmtPeriod(a,b):"Pilih periode awal dan periode akhir."}
$("#periodeAwal").onchange=()=>{const a=$("#periodeAwal").value;$("#periodeAkhir").min=a||"";if(a&&$("#periodeAkhir").value<a)$("#periodeAkhir").value=a;updatePeriodPreview()};
$("#periodeAkhir").onchange=updatePeriodPreview;

$("#keuanganForm").onsubmit=async e=>{e.preventDefault();try{
 const id=+$("#keuanganId").value||null,a=$("#periodeAwal").value,b=$("#periodeAkhir").value,file=$("#keuanganImage").files[0];let image=$("#keuanganImageLama").value||null;
 if(b<a){alert("Periode akhir tidak boleh lebih awal dari periode awal.");return}
 if(!id&&!file){alert("File laporan wajib diupload.");return}
 if(file){const old=image;image=await upload("laporan-keuangan",file,"laporan");if(old)await removeFile("laporan-keuangan",old)}
 const payload={periode_awal:a,periode_akhir:b,tanggal_publish:$("#publishDate").value,image_url:image,status:$("#keuanganStatus").value};
 const {error}=id?await db.from("keuangan").update(payload).eq("id",id):await db.from("keuangan").insert(payload);if(error)throw error;closeF("keuangan");await loadAll();
}catch(err){alert(err.message)}};

window.editK=id=>{const x=kajianData.find(x=>x.id===id);openF("kajian");$("#kajianId").value=x.id;$("#jenis").value=x.jenis||"";$("#judul").value=x.judul||"";$("#tema").value=x.tema||"";$("#penceramah").value=x.penceramah||"";$("#tanggal").value=x.tanggal||"";$("#waktu").value=x.waktu||"";$("#kajianStatus").value=x.status||"publish";$("#posterLama").value=x.poster_url||""};
window.editM=id=>{const x=mediaData.find(x=>x.id===id);openF("media");$("#mediaId").value=x.id;$("#mediaJudul").value=x.judul||"";$("#mediaKategori").value=x.kategori||"";$("#youtubeUrl").value=x.youtube_url||"";$("#mediaTanggal").value=x.tanggal||"";$("#mediaStatus").value=x.status||"publish"};
window.editF=id=>{const x=keuanganData.find(x=>x.id===id);openF("keuangan");$("#keuanganId").value=x.id;$("#periodeAwal").value=x.periode_awal||"";$("#periodeAkhir").value=x.periode_akhir||"";$("#publishDate").value=x.tanggal_publish||"";$("#keuanganStatus").value=x.status||"publish";$("#keuanganImageLama").value=x.image_url||"";updatePeriodPreview()};

window.deleteKajian=async id=>{if(!confirm("Hapus agenda ini?"))return;const x=kajianData.find(x=>x.id===id);const {error}=await db.from("kajian").delete().eq("id",id);if(error){alert(error.message);return}if(x?.poster_url)await removeFile("poster-kajian",x.poster_url);await loadAll()};
window.deleteMedia=async id=>{if(!confirm("Hapus video ini?"))return;const {error}=await db.from("media").delete().eq("id",id);if(error){alert(error.message);return}await loadAll()};
window.deleteFinance=async id=>{if(!confirm("Hapus laporan ini?"))return;const x=keuanganData.find(x=>x.id===id);const {error}=await db.from("keuangan").delete().eq("id",id);if(error){alert(error.message);return}if(x?.image_url)await removeFile("laporan-keuangan",x.image_url);await loadAll()};

(async()=>{if(await requireAuth())await loadAll()})();
