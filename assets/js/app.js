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

function shareIcon(){
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a2.8 2.8 0 0 0 0-1.39l7.05-4.12A2.99 2.99 0 1 0 15 5c0 .23.03.46.08.67L8.03 9.79a3 3 0 1 0 0 4.42l7.12 4.16c-.04.2-.07.41-.07.63a2.92 2.92 0 1 0 2.92-2.92Z"/></svg>`;
}

let currentShare={title:"",text:"",url:""};

function buildShareUrl(targetId){
  return `${location.origin}${location.pathname}#${encodeURIComponent(targetId)}`;
}

function openShareSheet(payload){
  currentShare=payload;
  const sheet=$("#shareSheet");
  if($("#shareText"))$("#shareText").textContent=payload.text;
  if($("#shareStatus"))$("#shareStatus").textContent="";
  if(sheet){
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden","false");
  }
}

function closeShareSheet(){
  const sheet=$("#shareSheet");
  if(sheet){
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden","true");
  }
}

async function nativeShare(){
  if(!navigator.share)return false;
  try{
    await navigator.share(currentShare);
    closeShareSheet();
    return true;
  }catch(err){
    return err?.name==="AbortError";
  }
}

async function copyShareLink(){
  try{
    await navigator.clipboard.writeText(currentShare.url);
    if($("#shareStatus"))$("#shareStatus").textContent="Link berhasil disalin.";
  }catch{
    if($("#shareStatus"))$("#shareStatus").textContent="Gagal menyalin link.";
  }
}

function openWhatsapp(){
  const message=`${currentShare.text}\n\n${currentShare.url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer");
}

function bindShareUI(){
  $("#shareClose")?.addEventListener("click",closeShareSheet);
  $("#shareBackdrop")?.addEventListener("click",closeShareSheet);
  $("#shareWhatsapp")?.addEventListener("click",openWhatsapp);
  $("#shareCopy")?.addEventListener("click",copyShareLink);
  $("#shareNative")?.addEventListener("click",async()=>{
    const ok=await nativeShare();
    if(!ok&&$("#shareStatus"))$("#shareStatus").textContent="Browser ini belum mendukung menu bagikan.";
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeShareSheet()});
}

function bindShareButtons(){
  $$("[data-share]").forEach(btn=>{
    if(btn.dataset.bound==="1")return;
    btn.dataset.bound="1";
    btn.addEventListener("click",async()=>{
      const payload={
        title:btn.dataset.shareTitle||"Masjid Jami' Harapan Kita",
        text:btn.dataset.shareText||"",
        url:buildShareUrl(btn.dataset.shareTarget)
      };
      if(window.matchMedia("(max-width: 768px)").matches&&navigator.share){
        currentShare=payload;
        const ok=await nativeShare();
        if(ok)return;
      }
      openShareSheet(payload);
    });
  });
}

function focusSharedTarget(){
  const raw=decodeURIComponent(location.hash.replace(/^#/,""));
  if(!raw)return;
  const target=document.getElementById(raw);
  if(!target)return;
  setTimeout(()=>{
    target.scrollIntoView({behavior:"smooth",block:"center"});
    target.classList.add("shared-target");
    setTimeout(()=>target.classList.remove("shared-target"),2300);
  },120);
}

async function renderKajian(){
  const grid=$("#kajianGrid"); if(!grid)return;
  if(!db){setState(grid,"Agenda kajian belum dapat dimuat.","is-error");return}
  const {data,error}=await db.from("kajian").select("*").eq("status","publish").order("tanggal",{ascending:true});
  if(error){console.error("Kajian:",error);setState(grid,"Agenda kajian belum dapat dimuat. Silakan coba lagi nanti.","is-error");return}
  const today=new Date();today.setHours(0,0,0,0);
  const rows=(data||[]).filter(x=>{const date=parseDate(x.tanggal);return date&&date>=today});
  if(!rows.length){setState(grid,"Belum ada agenda kajian yang dipublikasikan.","is-empty");return}
  grid.innerHTML=rows.map(x=>{
    const targetId=`kajian-${x.id}`;
    const shareText=[
      x.judul||"Kajian Masjid Jami' Harapan Kita",
      x.tema||"",
      x.penceramah||"",
      [fmtDate(x.tanggal),x.waktu||""].filter(Boolean).join(", "),
      "Masjid Jami' Harapan Kita"
    ].filter(Boolean).join("\n");

    return `<article class="card kajian-card" id="${esc(targetId)}">
      ${x.poster_url?`<img src="${esc(x.poster_url)}" alt="${esc(x.judul||"Kajian")}">`:`<div class="thumb"><strong>${esc(x.jenis||"Kajian")}</strong></div>`}
      <div class="card-pad">
        <h3>${esc(x.judul||"Kajian")}</h3>
        ${x.tema?`<p>${esc(x.tema)}</p>`:""}
        <div class="meta"><span>${esc(x.penceramah||"")}</span><span>${esc(fmtDate(x.tanggal))}</span><span>${esc(x.waktu||"")}</span></div>
        <div class="card-actions">
          <button type="button" class="share-btn" data-share data-share-target="${esc(targetId)}" data-share-title="${esc(x.judul||"Kajian MJHK")}" data-share-text="${esc(shareText)}">${shareIcon()}Bagikan</button>
        </div>
      </div>
    </article>`;
  }).join("");
  bindShareButtons();
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
  const latestRow=rows[0];
  const latestTarget=`keuangan-${latestRow.id}`;
  const latestPeriod=fmtPeriod(latestRow.periode_awal,latestRow.periode_akhir);
  const latestShareText=`Laporan Keuangan Pekanan\nPeriode ${latestPeriod}\nMasjid Jami' Harapan Kita`;

  latest.innerHTML=`<div class="finance-feature" id="${esc(latestTarget)}">
    <img data-lightbox src="${esc(latestRow.image_url)}" alt="Laporan keuangan ${esc(latestPeriod)}">
    <div class="finance-caption">
      <div><span class="badge">Laporan Terbaru</span><br><strong>${esc(latestPeriod)}</strong></div>
      <div class="finance-actions">
        <button type="button" class="share-btn" data-share data-share-target="${esc(latestTarget)}" data-share-title="Laporan Keuangan MJHK" data-share-text="${esc(latestShareText)}">${shareIcon()}Bagikan</button>
      </div>
    </div>
  </div>`;

  history.innerHTML=rows.slice(1).map(x=>{
    const targetId=`keuangan-${x.id}`;
    const period=fmtPeriod(x.periode_awal,x.periode_akhir);
    const shareText=`Laporan Keuangan Pekanan\nPeriode ${period}\nMasjid Jami' Harapan Kita`;
    return `<div class="history-card" id="${esc(targetId)}">
      <img data-lightbox src="${esc(x.image_url)}" alt="Laporan keuangan ${esc(period)}">
      <div>
        <strong>${esc(period)}</strong>
        <span>Laporan keuangan</span>
        <div class="finance-actions">
          <button type="button" class="share-btn" data-share data-share-target="${esc(targetId)}" data-share-title="Laporan Keuangan MJHK" data-share-text="${esc(shareText)}">${shareIcon()}Bagikan</button>
        </div>
      </div>
    </div>`;
  }).join("");

  bindLightbox();
  bindShareButtons();
}

document.addEventListener("DOMContentLoaded",async()=>{
  bindShareUI();
  await Promise.all([renderKajian(),renderMedia(),renderKeuangan()]);
  bindLightbox();
  bindShareButtons();
  focusSharedTarget();
});

window.addEventListener("hashchange",focusSharedTarget);
