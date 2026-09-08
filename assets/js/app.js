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
function esc(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function setState(target,message,type=""){
  if(target)target.innerHTML=`<p class="section-state ${type}">${esc(message)}</p>`;
}
function parseDate(value){
  if(!value)return null;
  const date=new Date(`${String(value).slice(0,10)}T00:00:00`);
  return Number.isNaN(date.getTime())?null:date;
}
function fmtDate(s){
  if(!s)return"";
  const M=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const date=parseDate(s);return date?`${date.getDate()} ${M[date.getMonth()]} ${date.getFullYear()}`:"";
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
  const grid=$("#kajianGrid"); if(!grid)return;
  if(!db){setState(grid,"Agenda kajian belum dapat dimuat.","is-error");return}
  const {data,error}=await db.from("kajian").select("*").eq("status","publish").order("tanggal",{ascending:true});
  if(error){console.error("Kajian:",error);setState(grid,"Agenda kajian belum dapat dimuat. Silakan coba lagi nanti.","is-error");return}
  const today=new Date();today.setHours(0,0,0,0);
  const rows=(data||[]).filter(x=>{const date=parseDate(x.tanggal);return date&&date>=today});
  if(!rows.length){setState(grid,"Belum ada agenda kajian yang dipublikasikan.","is-empty");return}
  grid.innerHTML=rows.map(x=>`<article class="card kajian-card">
    ${x.poster_url?`<img src="${esc(x.poster_url)}" alt="${esc(x.judul||"Kajian")}">`:`<div class="thumb"><strong>${esc(x.jenis||"Kajian")}</strong></div>`}
    <div class="card-pad"><h3>${esc(x.judul||"Kajian")}</h3>${x.tema?`<p>${esc(x.tema)}</p>`:""}<div class="meta"><span>${esc(x.penceramah||"")}</span><span>${esc(fmtDate(x.tanggal))}</span><span>${esc(x.waktu||"")}</span></div></div>
  </article>`).join("");
}

async function renderMedia(){
  const player=$("#mainPlayer"),title=$("#videoTitle"),grid=$("#videoGrid");
  if(!grid)return;
  setState(grid,"Memuat video...");
  if(!db){setState(grid,"Video belum dapat dimuat. Silakan coba lagi nanti.","is-error");return}
  const {data,error}=await db.from("media").select("*").eq("status","publish").order("tanggal",{ascending:false});
  if(error){console.error("Media:",error);setState(grid,"Video belum dapat dimuat. Silakan coba lagi nanti.","is-error");return}
  const rows=(data||[]).filter(x=>x.youtube_id||x.youtube_url);
  if(!rows.length){setState(grid,"Belum ada video yang dipublikasikan.","is-empty");return}
  if(player&&title){const id=rows[0].youtube_id||yid(rows[0].youtube_url);player.src=`https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0`;title.textContent=rows[0].judul||"Video Terbaru";$("#videoFeature").hidden=false}
  grid.innerHTML=rows.map(x=>{const id=x.youtube_id||yid(x.youtube_url);return `<button type="button" class="video-mini" data-video="${esc(id)}" data-title="${esc(x.judul||"Video")}"><img src="https://img.youtube.com/vi/${esc(id)}/hqdefault.jpg" alt=""><div><strong>${esc(x.judul||"Video")}</strong><span>${esc(x.kategori||"Media")} · ${esc(fmtDate(x.tanggal||x.tanggal_publish))}</span></div></button>`}).join("");
  $$(".video-mini").forEach(c=>c.addEventListener("click",()=>{if(!player||!title)return;player.src=`https://www.youtube.com/embed/${encodeURIComponent(c.dataset.video)}?rel=0`;title.textContent=c.dataset.title||"Video";$("#media").scrollIntoView({behavior:"smooth"})}));
}

async function renderKeuangan(){
  const latest=$("#financeLatest"),history=$("#financeHistory");
  if(!latest||!history)return;
  if(!db){setState(latest,"Laporan keuangan belum dapat dimuat. Silakan coba lagi nanti.","is-error");return}
  const {data,error}=await db.from("keuangan").select("*").eq("status","publish").order("periode_akhir",{ascending:false}).order("tanggal_publish",{ascending:false});
  if(error){console.error("Keuangan:",error);setState(latest,"Laporan keuangan belum dapat dimuat. Silakan coba lagi nanti.","is-error");return}
  const rows=data||[];
  if(!rows.length){setState(latest,"Belum ada laporan keuangan yang dipublikasikan.","is-empty");return}
  latest.innerHTML=`<div class="finance-feature"><img data-lightbox src="${esc(rows[0].image_url)}" alt="Laporan keuangan ${esc(fmtPeriod(rows[0].periode_awal,rows[0].periode_akhir))}"><div class="finance-caption"><div><span class="badge">Laporan Terbaru</span><br><strong>${esc(fmtPeriod(rows[0].periode_awal,rows[0].periode_akhir))}</strong></div><span>Dokumen</span></div></div>`;
  history.innerHTML=rows.slice(1).map(x=>`<div class="history-card"><img data-lightbox src="${esc(x.image_url)}" alt="Laporan keuangan ${esc(fmtPeriod(x.periode_awal,x.periode_akhir))}"><div><strong>${esc(fmtPeriod(x.periode_awal,x.periode_akhir))}</strong><span>Laporan keuangan</span></div></div>`).join("");
  bindLightbox();
}

document.addEventListener("DOMContentLoaded",async()=>{await Promise.all([renderKajian(),renderMedia(),renderKeuangan()]);bindLightbox()});
