const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const db=window.mjhkSupabase;

const menuBtn=$("#menuBtn");
const navLinks=$("#navLinks");
if(menuBtn&&navLinks) menuBtn.addEventListener("click",()=>navLinks.classList.toggle("open"));
$$(".nav-links a").forEach(a=>a.addEventListener("click",()=>{if(navLinks)navLinks.classList.remove("open")}));

const modal=$("#imageModal"),modalImg=$("#modalImg"),closeModal=$("#closeModal");
function bindLightbox(){
  $$("[data-lightbox]").forEach(img=>img.addEventListener("click",()=>{
    if(!modal||!modalImg)return;
    modalImg.src=img.src;modal.classList.add("open");
  }));
}
if(closeModal) closeModal.addEventListener("click",()=>{if(modal)modal.classList.remove("open")});
if(modal) modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});

function yid(u){
  const m=(u||"").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return m?m[1]:u;
}
function fmtDate(s){
  if(!s)return"";
  const M=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const[y,m,d]=s.split("-").map(Number);return `${d} ${M[m-1]} ${y}`;
}
function fmtPeriod(a,b){
  if(!a||!b)return"";
  const M=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const[ya,ma,da]=a.split("-").map(Number),[yb,mb,dbb]=b.split("-").map(Number);
  if(ya===yb&&ma===mb)return `${da} sampai ${dbb} ${M[mb-1]} ${yb}`;
  if(ya===yb)return `${da} ${M[ma-1]} sampai ${dbb} ${M[mb-1]} ${yb}`;
  return `${da} ${M[ma-1]} ${ya} sampai ${dbb} ${M[mb-1]} ${yb}`;
}

async function renderKajian(){
  const {data,error}=await db.from("kajian").select("*").eq("status","publish").order("tanggal",{ascending:true});
  if(error){console.error("Kajian:",error);return}
  const grid=$("#kajianGrid"); if(!grid)return;
  grid.innerHTML=(data||[]).map(x=>`<article class="card kajian-card">
    ${x.poster_url?`<img src="${x.poster_url}" alt="${x.judul||"Kajian"}" style="width:100%;aspect-ratio:16/9;object-fit:cover">`:`<div class="thumb"><strong>${x.jenis||"Kajian"}</strong></div>`}
    <div class="card-pad"><h3>${x.judul||""}</h3><p>${x.tema||""}</p><div class="meta"><span>${x.penceramah||""}</span><span>${fmtDate(x.tanggal)}</span><span>${x.waktu||""}</span></div></div>
  </article>`).join("");
}

async function renderMedia(){
  const {data,error}=await db.from("media").select("*").eq("status","publish").order("tanggal",{ascending:false});
  if(error){console.error("Media:",error);return}
  const rows=data||[],player=$("#mainPlayer"),title=$("#videoTitle"),grid=$("#videoGrid");
  if(rows.length&&player&&title){const id=rows[0].youtube_id||yid(rows[0].youtube_url);player.src=`https://www.youtube.com/embed/${id}?rel=0`;title.textContent=rows[0].judul||"Video Kajian Terbaru"}
  if(!grid)return;
  grid.innerHTML=rows.map(x=>{const id=x.youtube_id||yid(x.youtube_url);return `<div class="video-mini" data-video="${id}" data-title="${x.judul||""}"><img src="https://img.youtube.com/vi/${id}/hqdefault.jpg"><div><strong>${x.judul||""}</strong><span>${x.kategori||"Media MJHK"}</span></div></div>`}).join("");
  $$(".video-mini").forEach(c=>c.addEventListener("click",()=>{if(!player||!title)return;player.src=`https://www.youtube.com/embed/${c.dataset.video}?rel=0`;title.textContent=c.dataset.title||"Video Kajian";$("#media")?.scrollIntoView({behavior:"smooth"})}));
}

async function renderKeuangan(){
  const {data,error}=await db.from("keuangan").select("*").eq("status","publish").order("periode_akhir",{ascending:false}).order("tanggal_publish",{ascending:false});
  if(error){console.error("Keuangan:",error);return}
  const rows=data||[],latest=$("#financeLatest"),history=$("#financeHistory");
  if(!rows.length||!latest||!history)return;
  latest.innerHTML=`<div class="finance-feature"><img data-lightbox src="${rows[0].image_url}"><div class="finance-caption"><div><span class="badge">Laporan Terbaru</span><br><strong>${fmtPeriod(rows[0].periode_awal,rows[0].periode_akhir)}</strong></div><span>JPG 16:9</span></div></div>`;
  history.innerHTML=rows.slice(1).map(x=>`<div class="history-card"><img data-lightbox src="${x.image_url}"><div><strong>${fmtPeriod(x.periode_awal,x.periode_akhir)}</strong><span>Laporan pekanan</span></div></div>`).join("");
  bindLightbox();
}

document.addEventListener("DOMContentLoaded",async()=>{await Promise.all([renderKajian(),renderMedia(),renderKeuangan()]);bindLightbox()});
