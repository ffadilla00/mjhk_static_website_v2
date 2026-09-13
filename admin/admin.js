const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const db=window.mjhkSupabase;
const MONTHS=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MAX_FILE_SIZE=5*1024*1024;
let kajianData=[],mediaData=[],keuanganData=[],monthlyFinanceData=[],yearlyFinanceData=[],monthlyCategoryData=[],yearlyCategoryData=[],financeDetailReportData=[],continuityData=[],periodicReportData=[],pendingDelete=null,pendingPeriodicReport=null,periodicPreviewUrl=null,openingBalanceTouched=false;


function escHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function setMetaLines(target,lines){
  target.replaceChildren();
  lines.filter(Boolean).forEach((line,index)=>{
    if(index)target.appendChild(document.createElement("br"));
    target.appendChild(document.createTextNode(String(line)));
  });
}

function fmtDate(s){if(!s)return"";const[y,m,d]=s.split("-").map(Number);return `${d} ${MONTHS[m-1]} ${y}`}
function fmtPeriod(a,b){if(!a||!b)return"";const[ya,ma,da]=a.split("-").map(Number),[yb,mb,db]=b.split("-").map(Number);if(ya===yb&&ma===mb)return `${da} sampai ${db} ${MONTHS[mb-1]} ${yb}`;if(ya===yb)return `${da} ${MONTHS[ma-1]} sampai ${db} ${MONTHS[mb-1]} ${yb}`;return `${da} ${MONTHS[ma-1]} ${ya} sampai ${db} ${MONTHS[mb-1]} ${yb}`}
function rupiah(v){const n=Number(v||0);return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n)}
function monthLabel(monthDate){
  if(!monthDate)return "";
  const [y,m]=String(monthDate).split("-").map(Number);
  return `${MONTHS[m-1]} ${y}`;
}
function agendaLabel(value){
  const map={
    kajian:"Kajian",
    kegiatan:"Kegiatan",
    dakwah:"Dakwah",
    seminar:"Seminar",
    pelatihan:"Pelatihan"
  };
  const key=String(value||"").trim().toLowerCase();
  return map[key]||value||"-";
}
function agendaCategoryClass(value){
  const key=String(value||"kajian").toLowerCase();
  return ["kajian","kegiatan","dakwah"].includes(key)?key:"kajian";
}
function agendaTypeClass(value){
  const key=String(value||"kajian").toLowerCase();
  return ["kajian","seminar","pelatihan"].includes(key)?key:"kajian";
}

function coverageLabel(start,end){
  if(!start||!end)return "-";
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}
function coverageBadge(status,covered,total){
  const complete=status==="complete";
  const label=complete?"Lengkap":"Parsial";
  const meta=(covered!=null&&total!=null)?` ${covered}/${total} hari`:"";
  return `<span class="coverage-badge ${complete?"complete":"partial"}">${label}${meta}</span>`;
}
function nullableRupiah(v){
  return v===null||v===undefined ? '<span class="muted-value">Belum tersedia</span>' : rupiah(v);
}

function addDays(dateString,days){
  if(!dateString)return "";
  const date=new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate()+days);
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function continuityLabel(row){
  if(!row)return '<span class="continuity-badge neutral">Belum dicek</span>';
  const map={
    baseline:["Baseline","baseline"],
    ok:["Konsisten","ok"],
    gap:["Ada jeda","warn"],
    overlap:["Overlap","danger"],
    balance_mismatch:["Saldo beda","danger"],
    gap_balance_mismatch:["Jeda + saldo beda","danger"]
  };
  const [label,cls]=map[row.continuity_status]||["Periksa","warn"];
  return `<span class="continuity-badge ${cls}">${label}</span>`;
}
function continuityById(id){
  return continuityData.find(x=>Number(x.id)===Number(id));
}

function periodicReportByKey(type,periodKey){
  return periodicReportData.find(x=>x.report_type===type&&x.period_key===periodKey);
}
function monthlyPeriodKey(year,month){
  return `${year}-${String(month).padStart(2,"0")}`;
}
function yearlyPeriodKey(year){
  return String(year);
}
function reportCoverageText(row){
  return row?.coverage_start&&row?.coverage_end
    ? `${fmtDate(row.coverage_start)} – ${fmtDate(row.coverage_end)}`
    : "-";
}
function reportStatusText(row){
  return row?.coverage_status==="complete"?"Lengkap":"Parsial";
}

function toast(message,type="info"){const node=document.createElement("div");node.className=`toast ${type}`;node.textContent=message;$("#toastRegion").appendChild(node);setTimeout(()=>node.remove(),4500)}
function setBusy(form,busy){const button=form.querySelector('button[type="submit"]');if(!button)return;if(busy){button.dataset.label=button.textContent;button.textContent="Memproses..."}else button.textContent=button.dataset.label||"Simpan";button.disabled=busy;form.querySelectorAll("button, input, select, textarea").forEach(control=>{if(control!==button)control.disabled=busy})}
function tab(t){$$(".view").forEach(v=>v.classList.add("hidden"));$("#view-"+t).classList.remove("hidden");$$(".menu button").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));$("#pageTitle").textContent={dashboard:"Dashboard",kajian:"Kegiatan, Kajian & Dakwah",media:"Media YouTube",keuangan:"Laporan Keuangan"}[t]}
$$(".menu button").forEach(b=>b.onclick=()=>{
  tab(b.dataset.tab);
  if(b.dataset.tab==="keuangan")setFinanceReportTab("weekly");
});

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
  kajianData=k.data||[];mediaData=m.data||[];keuanganData=f.data||[];
  await loadFinanceReports();
  refresh();
}
function refresh(){
  $("#statKajian").textContent=kajianData.length;$("#statMedia").textContent=mediaData.length;$("#statKeuangan").textContent=keuanganData.length;
  $("#kajianRows").innerHTML=kajianData.map(x=>{
    const kategori=x.kategori_utama||"kajian";
    const jenis=x.jenis_agenda||String(x.jenis||"kajian").toLowerCase();
    return `<tr>
      <td><span class="agenda-pill category-${agendaCategoryClass(kategori)}">${agendaLabel(kategori)}</span></td>
      <td><span class="agenda-pill type-${agendaTypeClass(jenis)}">${agendaLabel(jenis)}</span></td>
      <td><b>${escHTML(x.judul)}</b>${x.tema?`<br><span class="agenda-subtext">${escHTML(x.tema)}</span>`:""}</td>
      <td>${x.penceramah||"-"}</td>
      <td>${fmtDate(x.tanggal)}${x.waktu?`<br>${escHTML(x.waktu)}`:""}</td>
      <td>${x.lokasi||"-"}</td>
      <td><span class="status">${escHTML(x.status)}</span></td>
      <td><div class="actions"><button class="small edit" onclick="editK(${x.id})">Edit</button><button class="small delete" onclick="deleteKajian(${x.id},this)">Hapus</button></div></td>
    </tr>`;
  }).join("")||'<tr><td colspan="8" class="loading-row">Belum ada data.</td></tr>';
  $("#mediaRows").innerHTML=mediaData.map(x=>`<tr><td><b>${escHTML(x.judul)}</b></td><td>${escHTML(x.kategori)}</td><td>${escHTML(x.youtube_url)}</td><td>${fmtDate(x.tanggal)}</td><td><span class="status">${escHTML(x.status)}</span></td><td><div class="actions"><button class="small edit" onclick="editM(${x.id})">Edit</button><button class="small delete" onclick="deleteMedia(${x.id},this)">Hapus</button></div></td></tr>`).join("")||'<tr><td colspan="6" class="loading-row">Belum ada data.</td></tr>';
  $("#keuanganRows").innerHTML=keuanganData.map(x=>`<tr>
    <td><b>${fmtPeriod(x.periode_awal,x.periode_akhir)}</b></td>
    <td><span class="mode-pill ${x.data_mode==='structured'?'mode-structured':'mode-legacy'}">${x.data_mode||'legacy'}</span></td>
    <td>${fmtDate(x.tanggal_publish)}</td>
    <td><span class="status">${escHTML(x.status)}</span></td>
    <td>${x.data_mode==='structured'?continuityLabel(continuityById(x.id)):'<span class="muted-value">Legacy</span>'}</td>
    <td>${x.data_mode==='structured'?`Saldo akhir: <b>${rupiah(x.saldo_akhir||0)}</b><br>Total masuk: ${rupiah(x.total_pemasukan||0)}<br>Total keluar: ${rupiah(x.total_pengeluaran||0)}`:`Arsip gambar laporan`}</td>
    <td><div class="actions"><button class="small edit" onclick="editF(${x.id})">Edit</button><button class="small delete" onclick="deleteFinance(${x.id},this)">Hapus</button></div></td>
  </tr>`).join("")||'<tr><td colspan="6" class="loading-row">Belum ada data.</td></tr>';
}


async function fetchAllFinanceDetailReport(){
  const pageSize=1000;
  let start=0;
  const all=[];

  while(true){
    const {data,error}=await db
      .from("keuangan_detail_report")
      .select("*")
      .order("tanggal_transaksi",{ascending:true})
      .order("jenis",{ascending:true})
      .order("kategori",{ascending:true})
      .order("urutan",{ascending:true})
      .range(start,start+pageSize-1);

    if(error)throw error;
    all.push(...(data||[]));

    if(!data||data.length<pageSize)break;
    start+=pageSize;
  }

  return all;
}

async function loadFinanceReports(){
  const [monthly,yearly,monthlyCategories,yearlyCategories,continuity,periodicReports]=await Promise.all([
    db.from("keuangan_bulanan").select("*").order("bulan",{ascending:false}),
    db.from("keuangan_tahunan").select("*").order("tahun",{ascending:false}),
    db.from("keuangan_kategori_bulanan").select("*").order("bulan",{ascending:false}).order("jenis",{ascending:true}).order("total_nominal",{ascending:false}),
    db.from("keuangan_kategori_tahunan").select("*").order("tahun",{ascending:false}).order("jenis",{ascending:true}).order("total_nominal",{ascending:false}),
    db.from("keuangan_continuity").select("*").order("periode_awal",{ascending:false}),
    db.from("keuangan_report_periodik").select("*").order("generated_at",{ascending:false})
  ]);

  if(monthly.error)console.error("Monthly finance report:",monthly.error);
  if(yearly.error)console.error("Yearly finance report:",yearly.error);
  if(monthlyCategories.error)console.error("Monthly category report:",monthlyCategories.error);
  if(yearlyCategories.error)console.error("Yearly category report:",yearlyCategories.error);
  if(continuity.error)console.error("Finance continuity:",continuity.error);
  if(periodicReports.error)console.error("Periodic finance reports:",periodicReports.error);

  monthlyFinanceData=monthly.error?[]:(monthly.data||[]);
  yearlyFinanceData=yearly.error?[]:(yearly.data||[]);
  monthlyCategoryData=monthlyCategories.error?[]:(monthlyCategories.data||[]);
  yearlyCategoryData=yearlyCategories.error?[]:(yearlyCategories.data||[]);
  continuityData=continuity.error?[]:(continuity.data||[]);
  periodicReportData=periodicReports.error?[]:(periodicReports.data||[]);

  try{
    financeDetailReportData=await fetchAllFinanceDetailReport();
  }catch(err){
    console.error("Finance detail report:",err);
    financeDetailReportData=[];
  }

  populateMonthlyYearFilter();
  populateMonthlyMonthFilter();
  populateYearlyYearFilter();
  renderMonthlyReport();
  renderYearlyReport();
  updateSavedReportLinks();
}

function populateMonthlyYearFilter(){
  const select=$("#monthlyYearFilter");
  if(!select)return;

  const years=[...new Set(monthlyFinanceData.map(x=>Number(x.tahun)).filter(Boolean))].sort((a,b)=>b-a);
  const current=Number(select.value);
  select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");

  if(years.length){
    select.value=years.includes(current)?String(current):String(years[0]);
  }else{
    select.innerHTML='<option value="">Belum ada data</option>';
  }
}


function populateMonthlyMonthFilter(){
  const select=$("#monthlyMonthFilter");
  if(!select)return;
  const selectedYear=Number($("#monthlyYearFilter")?.value||0);
  const current=select.value||"all";
  const months=[...new Set(
    monthlyFinanceData
      .filter(x=>!selectedYear||Number(x.tahun)===selectedYear)
      .map(x=>Number(x.bulan_nomor))
      .filter(Boolean)
  )].sort((a,b)=>a-b);

  select.innerHTML='<option value="all">Semua Bulan</option>'+months.map(m=>`<option value="${m}">${MONTHS[m-1]}</option>`).join("");
  select.value=(current==="all"||months.includes(Number(current)))?current:"all";
}

function populateYearlyYearFilter(){
  const select=$("#yearlyYearFilter");
  if(!select)return;
  const years=[...new Set(yearlyFinanceData.map(x=>Number(x.tahun)).filter(Boolean))].sort((a,b)=>b-a);
  const current=Number(select.value);
  select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");
  if(years.length)select.value=years.includes(current)?String(current):String(years[0]);
  else select.innerHTML='<option value="">Belum ada data</option>';
}

function aggregateCategories(data,jenis){
  const grouped=new Map();
  data.filter(x=>x.jenis===jenis).forEach(x=>{
    const key=(x.kategori||"Tanpa Kategori").trim();
    const prev=grouped.get(key)||{kategori:key,total_nominal:0,jumlah_transaksi:0};
    prev.total_nominal+=Number(x.total_nominal||0);
    prev.jumlah_transaksi+=Number(x.jumlah_transaksi||0);
    grouped.set(key,prev);
  });
  return [...grouped.values()].sort((a,b)=>b.total_nominal-a.total_nominal);
}

function renderCategoryTable(selector,rows){
  const tbody=$(selector);
  if(!tbody)return;
  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="3" class="loading-row">Belum ada transaksi pada kategori ini.</td></tr>';
    return;
  }
  tbody.innerHTML=rows.map(x=>`<tr><td><b>${escHTML(x.kategori)}</b></td><td>${rupiah(x.total_nominal)}</td><td>${x.jumlah_transaksi}</td></tr>`).join("");
}

function selectedMonthlyCategoryData(){
  const year=Number($("#monthlyYearFilter")?.value||0);
  const month=$("#monthlyMonthFilter")?.value||"all";
  return monthlyCategoryData.filter(x=>{
    const yearOk=!year||Number(x.tahun)===year;
    const monthOk=month==="all"||Number(x.bulan_nomor)===Number(month);
    return yearOk&&monthOk;
  });
}

function renderMonthlyCategories(){
  const data=selectedMonthlyCategoryData();
  renderCategoryTable("#monthlyIncomeCategoryRows",aggregateCategories(data,"pemasukan"));
  renderCategoryTable("#monthlyExpenseCategoryRows",aggregateCategories(data,"pengeluaran"));

  const year=$("#monthlyYearFilter")?.value||"-";
  const month=$("#monthlyMonthFilter")?.value||"all";
  const label=month==="all"?`Tahun ${year}`:`${MONTHS[Number(month)-1]} ${year}`;
  $("#monthlyIncomeCategoryPeriod").textContent=label;
  $("#monthlyExpenseCategoryPeriod").textContent=label;
}

function selectedYearlyCategoryData(){
  const year=Number($("#yearlyYearFilter")?.value||0);
  return yearlyCategoryData.filter(x=>!year||Number(x.tahun)===year);
}

function renderYearlyCategories(){
  const data=selectedYearlyCategoryData();
  renderCategoryTable("#yearlyIncomeCategoryRows",aggregateCategories(data,"pemasukan"));
  renderCategoryTable("#yearlyExpenseCategoryRows",aggregateCategories(data,"pengeluaran"));
  const year=$("#yearlyYearFilter")?.value||"-";
  $("#yearlyIncomeCategoryPeriod").textContent=`Tahun ${year}`;
  $("#yearlyExpenseCategoryPeriod").textContent=`Tahun ${year}`;
}

function renderMonthlyReport(){
  const tbody=$("#monthlyReportRows");
  if(!tbody)return;

  const selectedYear=Number($("#monthlyYearFilter")?.value||0);
  const selectedMonth=$("#monthlyMonthFilter")?.value||"all";
  const rows=monthlyFinanceData.filter(x=>{
    const yearOk=!selectedYear||Number(x.tahun)===selectedYear;
    const monthOk=selectedMonth==="all"||Number(x.bulan_nomor)===Number(selectedMonth);
    return yearOk&&monthOk;
  });

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="9" class="loading-row">Belum ada laporan structured yang dipublish untuk tahun ini.</td></tr>';
  }else{
    tbody.innerHTML=rows.map(x=>`<tr>
      <td><b>${monthLabel(x.bulan)}</b></td>
      <td>${coverageLabel(x.coverage_start,x.coverage_end)}</td>
      <td>${coverageBadge(x.coverage_status,Number(x.hari_tercakup||0),Number(x.hari_dalam_bulan||0))}</td>
      <td>${nullableRupiah(x.saldo_awal)}</td>
      <td>${rupiah(x.total_pemasukan||0)}</td>
      <td>${rupiah(x.total_pengeluaran||0)}</td>
      <td class="${Number(x.arus_kas_bersih||0)<0?"money-negative":"money-positive"}">${rupiah(x.arus_kas_bersih||0)}</td>
      <td>${nullableRupiah(x.saldo_akhir)}</td>
      <td>${Number(x.jumlah_transaksi||0)}</td>
    </tr>`).join("");
  }

  const income=rows.reduce((s,x)=>s+Number(x.total_pemasukan||0),0);
  const expense=rows.reduce((s,x)=>s+Number(x.total_pengeluaran||0),0);
  const transactions=rows.reduce((s,x)=>s+Number(x.jumlah_transaksi||0),0);

  $("#monthlyYearIncome").textContent=rupiah(income);
  $("#monthlyYearExpense").textContent=rupiah(expense);
  $("#monthlyYearNet").textContent=rupiah(income-expense);
  $("#monthlyYearTransactions").textContent=transactions;
  renderMonthlyCategories();
}

function renderYearlyReport(){
  const tbody=$("#yearlyReportRows");
  if(!tbody)return;

  const selectedYear=Number($("#yearlyYearFilter")?.value||0);
  const rows=yearlyFinanceData.filter(x=>!selectedYear||Number(x.tahun)===selectedYear);

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="9" class="loading-row">Belum ada laporan structured yang dipublish.</td></tr>';
    renderYearlyCategories();
    return;
  }

  tbody.innerHTML=rows.map(x=>`<tr>
    <td><b>${x.tahun}</b></td>
    <td>${coverageLabel(x.coverage_start,x.coverage_end)}</td>
    <td>${coverageBadge(x.coverage_status,Number(x.hari_tercakup||0),Number(x.hari_dalam_tahun||0))}</td>
    <td>${nullableRupiah(x.saldo_awal)}</td>
    <td>${rupiah(x.total_pemasukan||0)}</td>
    <td>${rupiah(x.total_pengeluaran||0)}</td>
    <td class="${Number(x.arus_kas_bersih||0)<0?"money-negative":"money-positive"}">${rupiah(x.arus_kas_bersih||0)}</td>
    <td>${nullableRupiah(x.saldo_akhir)}</td>
    <td>${Number(x.jumlah_transaksi||0)}</td>
  </tr>`).join("");
  renderYearlyCategories();
}


function updateSavedReportLinks(){
  const monthYear=Number($("#monthlyYearFilter")?.value||0);
  const month=$("#monthlyMonthFilter")?.value||"all";
  const monthlyLink=$("#monthlySavedReportLink");

  if(monthlyLink){
    if(monthYear&&month!=="all"){
      const saved=periodicReportByKey("bulanan",monthlyPeriodKey(monthYear,Number(month)));
      const savedUrl=saved?.file_url||saved?.image_url;
      if(savedUrl){
        monthlyLink.href=savedUrl;
        monthlyLink.classList.remove("hidden");
      }else{
        monthlyLink.removeAttribute("href");
        monthlyLink.classList.add("hidden");
      }
    }else{
      monthlyLink.removeAttribute("href");
      monthlyLink.classList.add("hidden");
    }
  }

  const yearlyYear=Number($("#yearlyYearFilter")?.value||0);
  const yearlyLink=$("#yearlySavedReportLink");
  if(yearlyLink){
    const saved=yearlyYear?periodicReportByKey("tahunan",yearlyPeriodKey(yearlyYear)):null;
    const savedUrl=saved?.file_url||saved?.image_url;
    if(savedUrl){
      yearlyLink.href=savedUrl;
      yearlyLink.classList.remove("hidden");
    }else{
      yearlyLink.removeAttribute("href");
      yearlyLink.classList.add("hidden");
    }
  }
}

function detailRowsForPeriod(type,year,month=null){
  return financeDetailReportData
    .filter(x=>{
      if(Number(x.tahun)!==Number(year))return false;
      if(type==="bulanan"&&Number(x.bulan_nomor)!==Number(month))return false;
      return true;
    })
    .sort((a,b)=>{
      const dateCmp=String(a.tanggal_transaksi).localeCompare(String(b.tanggal_transaksi));
      if(dateCmp)return dateCmp;
      const kindCmp=String(a.jenis).localeCompare(String(b.jenis));
      if(kindCmp)return kindCmp;
      const categoryCmp=String(a.kategori).localeCompare(String(b.kategori));
      if(categoryCmp)return categoryCmp;
      return Number(a.urutan||0)-Number(b.urutan||0);
    });
}

function groupDetailsByCategory(details,jenis){
  const map=new Map();

  details.filter(x=>x.jenis===jenis).forEach(row=>{
    const key=(row.kategori||"Tanpa Kategori").trim();
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(row);
  });

  return [...map.entries()]
    .map(([kategori,rows])=>({
      kategori,
      rows,
      subtotal:rows.reduce((sum,row)=>sum+Number(row.nominal||0),0)
    }))
    .sort((a,b)=>b.subtotal-a.subtotal);
}

function pdfMoney(value){
  const n=Number(value||0);
  return `Rp ${new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(n)}`;
}

function pdfDate(dateString){
  return dateString?fmtDate(dateString):"-";
}

function getMonthlyPdfPayload(){
  const year=Number($("#monthlyYearFilter").value||0);
  const monthValue=$("#monthlyMonthFilter").value||"all";

  if(!year||monthValue==="all"){
    throw new Error("Pilih satu bulan spesifik sebelum membuat PDF laporan bulanan.");
  }

  const month=Number(monthValue);
  const summary=monthlyFinanceData.find(x=>Number(x.tahun)===year&&Number(x.bulan_nomor)===month);
  if(!summary)throw new Error("Data rekap bulanan tidak ditemukan.");

  const details=detailRowsForPeriod("bulanan",year,month);

  return {
    type:"bulanan",
    year,
    month,
    periodKey:monthlyPeriodKey(year,month),
    periodLabel:`${MONTHS[month-1]} ${year}`,
    totalDays:Number(summary.hari_dalam_bulan||0),
    summary,
    details,
    incomeGroups:groupDetailsByCategory(details,"pemasukan"),
    expenseGroups:groupDetailsByCategory(details,"pengeluaran")
  };
}

function getYearlyPdfPayload(){
  const year=Number($("#yearlyYearFilter").value||0);
  if(!year)throw new Error("Pilih tahun sebelum membuat PDF laporan tahunan.");

  const summary=yearlyFinanceData.find(x=>Number(x.tahun)===year);
  if(!summary)throw new Error("Data rekap tahunan tidak ditemukan.");

  const details=detailRowsForPeriod("tahunan",year);

  return {
    type:"tahunan",
    year,
    month:null,
    periodKey:yearlyPeriodKey(year),
    periodLabel:`Tahun ${year}`,
    totalDays:Number(summary.hari_dalam_tahun||0),
    summary,
    details,
    incomeGroups:groupDetailsByCategory(details,"pemasukan"),
    expenseGroups:groupDetailsByCategory(details,"pengeluaran")
  };
}

async function loadPdfLogo(){
  try{
    const url=new URL("../assets/images/logo-mjhk.png",window.location.href).href;
    const response=await fetch(url);
    if(!response.ok)return null;
    const blob=await response.blob();
    return await new Promise(resolve=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>resolve(null);
      reader.readAsDataURL(blob);
    });
  }catch(err){
    console.warn("Logo PDF tidak dapat dimuat:",err);
    return null;
  }
}

function ensurePdfSpace(doc,currentY,needed=22){
  const pageHeight=doc.internal.pageSize.getHeight();
  if(currentY+needed>pageHeight-18){
    doc.addPage();
    return 20;
  }
  return currentY;
}

function drawPdfSummary(doc,payload,startY){
  const pageWidth=doc.internal.pageSize.getWidth();
  const margin=14;
  const gap=4;
  const usable=pageWidth-(margin*2);
  const boxWidth=(usable-gap*3)/4;

  const boxes=[
    ["Saldo Awal Cakupan",payload.summary.saldo_awal==null?"Belum tersedia":pdfMoney(payload.summary.saldo_awal)],
    ["Total Pemasukan",pdfMoney(payload.summary.total_pemasukan)],
    ["Total Pengeluaran",pdfMoney(payload.summary.total_pengeluaran)],
    ["Saldo Akhir Cakupan",payload.summary.saldo_akhir==null?"Belum tersedia":pdfMoney(payload.summary.saldo_akhir)]
  ];

  boxes.forEach((box,index)=>{
    const x=margin+(boxWidth+gap)*index;
    doc.setDrawColor(205,185,130);
    doc.setFillColor(251,249,243);
    doc.roundedRect(x,startY,boxWidth,17,2,2,"FD");
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.5);
    doc.setTextColor(95,105,100);
    doc.text(box[0],x+3,startY+5);
    doc.setFont("helvetica","bold");
    doc.setFontSize(11);
    doc.setTextColor(11,79,58);
    doc.text(String(box[1]),x+3,startY+12);
  });

  return startY+22;
}

function drawPdfSection(doc,title,groups,startY){
  let y=ensurePdfSpace(doc,startY,22);

  doc.setFillColor(11,79,58);
  doc.roundedRect(14,y,269,9,1.5,1.5,"F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.text(title,18,y+6);
  y+=13;

  if(!groups.length){
    doc.setTextColor(110,120,115);
    doc.setFont("helvetica","italic");
    doc.setFontSize(9);
    doc.text("Belum ada transaksi.",18,y+5);
    return y+12;
  }

  groups.forEach((group,index)=>{
    y=ensurePdfSpace(doc,y,28);

    doc.setTextColor(11,79,58);
    doc.setFont("helvetica","bold");
    doc.setFontSize(9.5);
    doc.text(`${index+1}. ${escHTML(group.kategori)}`,16,y+4);

    doc.setFontSize(8.5);
    doc.text(`Subtotal: ${pdfMoney(group.subtotal)}`,280,y+4,{align:"right"});
    y+=7;

    const body=group.rows.map((row,i)=>[
      String(i+1),
      pdfDate(row.tanggal_transaksi),
      row.uraian||"-",
      pdfMoney(row.nominal)
    ]);

    doc.autoTable({
      startY:y,
      margin:{left:16,right:16},
      head:[["No","Tanggal","Uraian","Nominal"]],
      body,
      theme:"grid",
      styles:{
        font:"helvetica",
        fontSize:8,
        cellPadding:2.2,
        textColor:[35,45,40],
        lineColor:[225,226,222],
        lineWidth:0.15,
        overflow:"linebreak",
        valign:"middle"
      },
      headStyles:{
        fillColor:[236,242,238],
        textColor:[11,79,58],
        fontStyle:"bold"
      },
      columnStyles:{
        0:{cellWidth:12,halign:"center"},
        1:{cellWidth:34},
        2:{cellWidth:"auto"},
        3:{cellWidth:42,halign:"right",fontStyle:"bold"}
      },
      didDrawPage:()=>{
        doc.setTextColor(140,145,142);
        doc.setFontSize(7);
      }
    });

    y=doc.lastAutoTable.finalY+6;
  });

  return y;
}

function addPdfFooters(doc,payload){
  const pages=doc.getNumberOfPages();

  for(let i=1;i<=pages;i++){
    doc.setPage(i);
    const width=doc.internal.pageSize.getWidth();
    const height=doc.internal.pageSize.getHeight();

    doc.setDrawColor(220,222,219);
    doc.line(14,height-12,width-14,height-12);

    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    doc.setTextColor(100,108,104);
    doc.text(
      `Masjid Jami' Harapan Kita - Laporan Keuangan ${payload.type==="bulanan"?"Bulanan":"Tahunan"} - ${payload.periodLabel}`,
      14,
      height-7
    );
    doc.text(`Halaman ${i} dari ${pages}`,width-14,height-7,{align:"right"});
  }
}

async function buildPeriodicPdf(payload){
  if(!window.jspdf?.jsPDF)throw new Error("Library jsPDF belum termuat. Refresh halaman dan coba kembali.");

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({
    orientation:"landscape",
    unit:"mm",
    format:"a4",
    compress:true
  });

  const logo=await loadPdfLogo();
  const pageWidth=doc.internal.pageSize.getWidth();

  if(logo){
    try{doc.addImage(logo,"PNG",14,12,22,22)}catch(err){console.warn("Logo PDF gagal ditambahkan:",err)}
  }

  doc.setTextColor(11,79,58);
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text("MASJID JAMI' HARAPAN KITA",logo?41:14,17);

  doc.setFontSize(15);
  doc.text(
    payload.type==="bulanan"?"LAPORAN KEUANGAN BULANAN":"LAPORAN KEUANGAN TAHUNAN",
    logo?41:14,
    25
  );

  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.setTextColor(85,95,90);
  doc.text(`Periode: ${payload.periodLabel}`,logo?41:14,31);
  doc.text(`Cakupan data: ${reportCoverageText(payload.summary)}`,logo?41:14,36);

  const status=reportStatusText(payload.summary);
  doc.setFillColor(payload.summary.coverage_status==="complete"?225:255,payload.summary.coverage_status==="complete"?243:242,payload.summary.coverage_status==="complete"?231:207);
  doc.setDrawColor(210,195,150);
  doc.roundedRect(pageWidth-65,12,51,25,2,2,"FD");
  doc.setTextColor(100,100,90);
  doc.setFontSize(7.5);
  doc.text("Status Cakupan",pageWidth-18,18,{align:"right"});
  doc.setTextColor(11,79,58);
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text(status,pageWidth-18,25,{align:"right"});
  doc.setFont("helvetica","normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90,100,95);
  doc.text(`${payload.summary.hari_tercakup||0}/${payload.totalDays||0} hari`,pageWidth-18,31,{align:"right"});

  let y=44;
  y=drawPdfSummary(doc,payload,y);

  doc.setFont("helvetica","normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70,80,75);
  doc.text(`Arus Kas Bersih: ${pdfMoney(payload.summary.arus_kas_bersih||0)}`,14,y);
  doc.text(`Jumlah Transaksi: ${payload.summary.jumlah_transaksi||0}`,90,y);

  if(payload.summary.coverage_status!=="complete"){
    doc.setTextColor(140,95,20);
    doc.text(
      `Catatan: laporan bersifat parsial dan hanya mencakup ${reportCoverageText(payload.summary)}.`,
      150,
      y
    );
  }
  y+=7;

  y=drawPdfSection(doc,"RINCIAN PEMASUKAN",payload.incomeGroups,y);
  y=drawPdfSection(doc,"RINCIAN PENGELUARAN",payload.expenseGroups,y+2);

  y=ensurePdfSpace(doc,y,18);
  doc.setDrawColor(205,185,130);
  doc.setFillColor(251,249,243);
  doc.roundedRect(14,y,269,13,2,2,"FD");
  doc.setTextColor(11,79,58);
  doc.setFont("helvetica","bold");
  doc.setFontSize(9);
  doc.text(`TOTAL PEMASUKAN: ${pdfMoney(payload.summary.total_pemasukan||0)}`,19,y+5);
  doc.text(`TOTAL PENGELUARAN: ${pdfMoney(payload.summary.total_pengeluaran||0)}`,105,y+5);
  doc.text(`SALDO AKHIR CAKUPAN: ${payload.summary.saldo_akhir==null?"Belum tersedia":pdfMoney(payload.summary.saldo_akhir)}`,196,y+5);

  doc.setFont("helvetica","normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90,98,94);
  doc.text("Dokumen ini dihasilkan dari data transaksi structured yang telah dipublikasikan pada sistem MJHK.",19,y+10);

  addPdfFooters(doc,payload);

  return doc.output("blob");
}

async function openPeriodicReportPreview(payload){
  pendingPeriodicReport=payload;

  $("#reportPreviewTitle").textContent=payload.type==="bulanan"
    ?"Preview Laporan Keuangan Bulanan"
    :"Preview Laporan Keuangan Tahunan";

  $("#reportPreviewSubtitle").textContent=`${payload.periodLabel} - PDF A4 Landscape`;

  const iframe=$("#periodicPdfPreview");
  iframe.removeAttribute("src");

  if(periodicPreviewUrl){
    URL.revokeObjectURL(periodicPreviewUrl);
    periodicPreviewUrl=null;
  }

  const modal=$("#reportPreviewModal");
  modal.classList.remove("hidden");

  const button=$("#savePeriodicReport");
  button.disabled=true;
  button.textContent="Membuat PDF...";

  try{
    const blob=await buildPeriodicPdf(payload);
    payload.pdfBlob=blob;
    periodicPreviewUrl=URL.createObjectURL(blob);
    iframe.src=periodicPreviewUrl;
    button.disabled=false;
    button.textContent="Simpan PDF ke Supabase";
  }catch(err){
    closePeriodicReportPreview();
    throw err;
  }
}

function closePeriodicReportPreview(){
  $("#reportPreviewModal").classList.add("hidden");
  $("#periodicPdfPreview").removeAttribute("src");

  if(periodicPreviewUrl){
    URL.revokeObjectURL(periodicPreviewUrl);
    periodicPreviewUrl=null;
  }

  pendingPeriodicReport=null;
}

async function savePeriodicReport(){
  if(!pendingPeriodicReport)return;

  const button=$("#savePeriodicReport");
  button.disabled=true;
  const original=button.textContent;
  button.textContent="Menyimpan PDF...";

  try{
    const payload=pendingPeriodicReport;
    const blob=payload.pdfBlob||await buildPeriodicPdf(payload);
    if(!blob)throw new Error("Gagal membuat PDF laporan.");

    const folder=payload.type==="bulanan"?"monthly-pdf":"yearly-pdf";
    const filename=payload.type==="bulanan"
      ?`generated/${folder}/${payload.periodKey}/laporan-bulanan-${payload.periodKey}-${Date.now()}.pdf`
      :`generated/${folder}/${payload.periodKey}/laporan-tahunan-${payload.periodKey}-${Date.now()}.pdf`;

    const old=periodicReportByKey(payload.type,payload.periodKey);
    const oldUrl=old?.file_url||old?.image_url||null;
    const fileUrl=await uploadBinaryBlob("laporan-keuangan",blob,filename,"application/pdf");

    const record={
      report_type:payload.type,
      period_key:payload.periodKey,
      tahun:payload.year,
      bulan:payload.month,
      coverage_start:payload.summary.coverage_start,
      coverage_end:payload.summary.coverage_end,
      coverage_status:payload.summary.coverage_status,
      hari_tercakup:Number(payload.summary.hari_tercakup||0),
      hari_total:payload.totalDays,
      saldo_awal:payload.summary.saldo_awal,
      total_pemasukan:Number(payload.summary.total_pemasukan||0),
      total_pengeluaran:Number(payload.summary.total_pengeluaran||0),
      arus_kas_bersih:Number(payload.summary.arus_kas_bersih||0),
      saldo_akhir:payload.summary.saldo_akhir,
      jumlah_transaksi:Number(payload.summary.jumlah_transaksi||0),
      file_url:fileUrl,
      file_format:"pdf",
      image_url:null,
      status:"publish",
      generated_at:new Date().toISOString()
    };

    const {error}=await db.from("keuangan_report_periodik").upsert(record,{
      onConflict:"report_type,period_key"
    });
    if(error)throw error;

    if(oldUrl&&oldUrl!==fileUrl){
      await removeFile("laporan-keuangan",oldUrl).catch(()=>null);
    }

    closePeriodicReportPreview();
    await loadFinanceReports();
    toast(`PDF laporan ${payload.type} berhasil digenerate dan disimpan.`,"success");
  }catch(err){
    toast(err.message,"error");
  }finally{
    button.disabled=false;
    button.textContent=original;
  }
}

$("#generateMonthlyReport").onclick=async()=>{
  try{
    await openPeriodicReportPreview(getMonthlyPdfPayload());
  }catch(err){
    toast(err.message,"error");
  }
};

$("#generateYearlyReport").onclick=async()=>{
  try{
    await openPeriodicReportPreview(getYearlyPdfPayload());
  }catch(err){
    toast(err.message,"error");
  }
};

$("#closeReportPreview").onclick=closePeriodicReportPreview;
$("#cancelReportSave").onclick=closePeriodicReportPreview;
$("#savePeriodicReport").onclick=savePeriodicReport;

function setFinanceReportTab(name){
  $$(".finance-report-view").forEach(v=>v.classList.add("hidden"));
  const target={
    weekly:"#financeWeeklyView",
    monthly:"#financeMonthlyView",
    yearly:"#financeYearlyView"
  }[name];

  if(target)$(target).classList.remove("hidden");

  $$(".finance-report-tab").forEach(btn=>btn.classList.toggle("active",btn.dataset.financeReport===name));

  $("#addKeuangan").classList.toggle("hidden",name!=="weekly");

  if(name!=="weekly"){
    $("#keuanganFormWrap").classList.add("hidden");
  }

  if(name==="monthly")renderMonthlyReport();
  if(name==="yearly")renderYearlyReport();
}

$$(".finance-report-tab").forEach(btn=>{
  btn.onclick=()=>setFinanceReportTab(btn.dataset.financeReport);
});
$("#monthlyYearFilter").onchange=()=>{
  populateMonthlyMonthFilter();
  renderMonthlyReport();
  updateSavedReportLinks();
};
$("#monthlyMonthFilter").onchange=()=>{
  renderMonthlyReport();
  updateSavedReportLinks();
};
$("#yearlyYearFilter").onchange=()=>{
  renderYearlyReport();
  updateSavedReportLinks();
};
$("#refreshFinanceReports").onclick=async()=>{
  const btn=$("#refreshFinanceReports");
  btn.disabled=true;
  btn.textContent="Memuat...";
  try{
    await loadFinanceReports();
    toast("Rekap keuangan diperbarui.","success");
  }catch(err){
    toast(err.message,"error");
  }finally{
    btn.disabled=false;
    btn.textContent="Refresh Rekap";
  }
};

function clearPreview(wrap,img,meta){$(wrap).classList.add("hidden");$(img).removeAttribute("src");$(meta).textContent=""}
function showPreview(file,wrap,img,meta){if(!file){clearPreview(wrap,img,meta);return}const reader=new FileReader();reader.onload=()=>{$(img).src=reader.result;setMetaLines($(meta),["Sumber: File lokal",`Nama file: ${file.name}`,`Ukuran: ${(file.size/(1024*1024)).toFixed(2)} MB`]);$(wrap).classList.remove("hidden")};reader.readAsDataURL(file)}
function storageFileName(url){if(!url)return"";const clean=url.split(/[?#]/)[0],encoded=clean.slice(clean.lastIndexOf("/")+1);try{return decodeURIComponent(encoded)}catch(err){return encoded}}
function showStoredPreview(url,wrap,img,meta){if(!url){clearPreview(wrap,img,meta);return}$(img).src=url;const name=storageFileName(url);setMetaLines($(meta),["Sumber: Supabase Storage",...(name?[`Nama file: ${name}`]:[])]);$(wrap).classList.remove("hidden")}
function validateFile(file){if(!file)return true;if(!["image/jpeg","image/png"].includes(file.type)){toast("File harus berformat JPG atau PNG.","error");return false}if(file.size>MAX_FILE_SIZE){toast("Ukuran file maksimal 5 MB.","error");return false}return true}
function safeName(n){return n.toLowerCase().replace(/[^a-z0-9._-]+/g,"-")}
function storagePath(url,bucket){if(!url)return"";const marker=`/storage/v1/object/public/${bucket}/`,i=url.indexOf(marker);return i>=0?decodeURIComponent(url.slice(i+marker.length)):""}
async function upload(bucket,file,prefix){const name=`${prefix}-${Date.now()}-${safeName(file.name)}`;const {error}=await db.storage.from(bucket).upload(name,file,{cacheControl:"3600",upsert:false,contentType:file.type});if(error)throw error;return db.storage.from(bucket).getPublicUrl(name).data.publicUrl}
async function uploadBlob(bucket,blob,fileName){const {error}=await db.storage.from(bucket).upload(fileName,blob,{cacheControl:"3600",upsert:false,contentType:"image/jpeg"});if(error)throw error;return db.storage.from(bucket).getPublicUrl(fileName).data.publicUrl}
async function uploadBinaryBlob(bucket,blob,fileName,contentType){
  const {error}=await db.storage.from(bucket).upload(fileName,blob,{
    cacheControl:"3600",
    upsert:false,
    contentType
  });
  if(error)throw error;
  return db.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
}
async function removeFile(bucket,url){const p=storagePath(url,bucket);if(p){const {error}=await db.storage.from(bucket).remove([p]);if(error)throw error}}
function yid(u){const m=(u||"").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);return m?m[1]:""}

function updatePeriodPreview(){const a=$("#periodeAwal").value,b=$("#periodeAkhir").value;$("#periodPreview").textContent=a&&b?fmtPeriod(a,b):"Pilih periode awal dan periode akhir.";renderFinancePreview();updateContinuityCheck()}
$("#periodeAwal").onchange=()=>{
  const a=$("#periodeAwal").value;
  $("#periodeAkhir").min=a||"";
  setDefaultDetailDates(a);
  if(a&&$("#periodeAkhir").value<a)$("#periodeAkhir").value=a;
  autoFillOpeningBalance();
  updatePeriodPreview();
};
$("#periodeAkhir").onchange=updatePeriodPreview;
$("#publishDate").onchange=renderFinancePreview;
$("#saldoAwal").oninput=()=>{
  openingBalanceTouched=true;
  updateFinanceTotals();
  renderFinancePreview();
};
$("#keuanganCatatan").oninput=renderFinancePreview;
$("#dataMode").onchange=toggleFinanceMode;
$("#refreshFinancePreview").onclick=renderFinancePreview;
$("#posterFile").onchange=()=>{const file=$("#posterFile").files[0];if(validateFile(file))showPreview(file,"#posterPreviewWrap","#posterPreview","#posterPreviewMeta");else{$("#posterFile").value="";clearPreview("#posterPreviewWrap","#posterPreview","#posterPreviewMeta")}};
$("#keuanganImage").onchange=()=>{const file=$("#keuanganImage").files[0];if(validateFile(file))showPreview(file,"#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta");else{$("#keuanganImage").value="";clearPreview("#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta")}};



function autoFillOpeningBalance(){
  if($("#dataMode").value!=="structured")return;
  if(Number($("#keuanganId").value||0))return;
  if(openingBalanceTouched)return;

  const start=$("#periodeAwal").value;
  if(!start)return;

  const previous=keuanganData
    .filter(x=>x.data_mode==="structured"&&x.status==="publish"&&x.periode_akhir<start)
    .sort((a,b)=>String(b.periode_akhir).localeCompare(String(a.periode_akhir)))[0];

  if(!previous)return;

  const expectedStart=addDays(previous.periode_akhir,1);
  if(start!==expectedStart)return;

  $("#saldoAwal").value=Number(previous.saldo_akhir||0);
  updateFinanceTotals();
  renderFinancePreview();
  toast(`Saldo awal otomatis mengikuti saldo akhir laporan sebelumnya: ${rupiah(previous.saldo_akhir||0)}.`,"success");
}

function getFinanceContinuityState(){
  if($("#dataMode").value!=="structured")return {kind:"hidden",messages:[]};

  const currentId=Number($("#keuanganId").value||0);
  const start=$("#periodeAwal").value;
  const end=$("#periodeAkhir").value;
  const opening=Number($("#saldoAwal").value||0);
  const totals=calcTotalsFromDetails(safeCollectDetails());
  const closing=totals.balance;

  if(!start)return {kind:"info",messages:["Pilih Periode Awal untuk memeriksa kesinambungan ledger."]};

  const structured=keuanganData
    .filter(x=>x.data_mode==="structured"&&x.status==="publish"&&Number(x.id)!==currentId)
    .sort((a,b)=>String(a.periode_awal).localeCompare(String(b.periode_awal)));

  const previous=[...structured].filter(x=>x.periode_awal<start).sort((a,b)=>String(b.periode_awal).localeCompare(String(a.periode_awal)))[0];
  const next=[...structured].filter(x=>x.periode_awal>start).sort((a,b)=>String(a.periode_awal).localeCompare(String(b.periode_awal)))[0];

  const messages=[];
  let kind="ok";

  if(!previous){
    messages.push("Ini menjadi baseline structured pertama. Pastikan saldo awal sudah sesuai saldo kas terakhir sebelum periode ini.");
    kind="baseline";
  }else{
    const expectedStart=addDays(previous.periode_akhir,1);
    if(start!==expectedStart){
      kind="danger";
      if(start<=previous.periode_akhir)messages.push(`Periode overlap dengan laporan sebelumnya yang berakhir ${fmtDate(previous.periode_akhir)}.`);
      else messages.push(`Ada jeda periode. Seharusnya periode berikutnya mulai ${fmtDate(expectedStart)}.`);
    }

    if(Math.abs(opening-Number(previous.saldo_akhir||0))>0.009){
      kind="danger";
      messages.push(`Saldo awal ${rupiah(opening)} tidak sama dengan saldo akhir laporan sebelumnya ${rupiah(previous.saldo_akhir||0)}.`);
    }else{
      messages.push(`Saldo awal cocok dengan saldo akhir laporan sebelumnya: ${rupiah(previous.saldo_akhir||0)}.`);
    }
  }

  if(next&&end){
    const expectedNextStart=addDays(end,1);
    if(next.periode_awal!==expectedNextStart){
      kind="danger";
      messages.push(`Laporan berikutnya mulai ${fmtDate(next.periode_awal)}; setelah periode ini seharusnya ${fmtDate(expectedNextStart)}.`);
    }
    if(Math.abs(Number(next.saldo_awal||0)-closing)>0.009){
      kind="danger";
      messages.push(`Saldo akhir hasil input ${rupiah(closing)} belum cocok dengan saldo awal laporan berikutnya ${rupiah(next.saldo_awal||0)}.`);
    }
  }

  return {kind,messages};
}

function updateContinuityCheck(){
  const card=$("#continuityCheck");
  if(!card)return;

  if($("#dataMode").value!=="structured"){
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");
  const state=getFinanceContinuityState();
  card.className=`continuity-card ${state.kind==="danger"?"danger":state.kind==="ok"?"ok":state.kind==="baseline"?"baseline":"info"}`;
  const title=state.kind==="danger"?"Perlu diperiksa":state.kind==="ok"?"Kontinuitas sesuai":state.kind==="baseline"?"Baseline structured":"Kontinuitas ledger";
  card.innerHTML=`<div class="continuity-icon">${state.kind==="danger"?"!":state.kind==="ok"?"✓":"i"}</div><div><strong>${title}</strong><ul>${state.messages.map(m=>`<li>${m}</li>`).join("")}</ul></div>`;
}

function openF(n){
  $("#"+n+"FormWrap").classList.remove("hidden");
  $("#"+n+"Form").reset();
  $("#"+n+"Id").value="";

  if(n==="keuangan")openingBalanceTouched=false;

  if(n==="kajian"){
    $("#posterLama").value="";
    $("#kategoriUtama").value="kajian";
    $("#jenisAgenda").value="kajian";
    $("#kajianStatus").value="publish";
    clearPreview("#posterPreviewWrap","#posterPreview","#posterPreviewMeta");
  }

  if(n==="keuangan"){
    resetFinanceForm();
    $("#publishDate").value=new Date().toISOString().slice(0,10);
    toggleFinanceMode();
    updateFinanceTotals();
    updatePeriodPreview();
    renderFinancePreview();
  }
}
function closeF(n){$("#"+n+"FormWrap").classList.add("hidden");if(n==="kajian")clearPreview("#posterPreviewWrap","#posterPreview","#posterPreviewMeta");if(n==="keuangan"){clearPreview("#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta");resetFinanceForm()}} window.closeF=closeF;
$("#addKajian").onclick=()=>openF("kajian");$("#addMedia").onclick=()=>openF("media");$("#addKeuangan").onclick=()=>openF("keuangan");

function toggleFinanceMode(){const mode=$("#dataMode").value;$("#structuredFields").classList.toggle("hidden",mode!=="structured");$("#legacyFields").classList.toggle("hidden",mode!=="legacy");$("#saldoAwal").closest(".field").classList.toggle("hidden",mode!=="structured");$("#keuanganCatatan").closest(".field").classList.toggle("hidden",mode!=="structured");updateContinuityCheck()}
function resetFinanceForm(){
  $("#keuanganImageLama").value="";
  $("#dataMode").value="structured";
  $("#incomeRows").innerHTML="";
  $("#expenseRows").innerHTML="";
  addDetailRow("pemasukan");
  addDetailRow("pengeluaran");
  clearPreview("#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta");
}
function setDefaultDetailDates(dateValue){[...document.querySelectorAll(".detail-date")].forEach(input=>{if(!input.value)input.value=dateValue||""})}
function addDetailRow(jenis,data={}){
  const tbody=$(jenis==="pemasukan"?"#incomeRows":"#expenseRows");
  const tr=document.createElement("tr");
  tr.className="detail-row";
  tr.dataset.jenis=jenis;
  tr.innerHTML=`
    <td><input type="date" class="detail-date" value="${data.tanggal_transaksi||$("#periodeAwal").value||""}"></td>
    <td><input type="text" class="detail-kategori" placeholder="Contoh: Infaq Tromol Jumat" value="${escHTML(data.kategori)}"></td>
    <td><input type="text" class="detail-uraian" placeholder="Uraian singkat" value="${escHTML(data.uraian)}"></td>
    <td><input type="number" class="detail-nominal" min="0" step="0.01" placeholder="0" value="${data.nominal??""}"></td>
    <td><input type="number" class="detail-urutan" min="1" step="1" value="${data.urutan||tbody.children.length+1}"></td>
    <td><button type="button" class="small delete-row">Hapus</button></td>`;
  tbody.appendChild(tr);
  tr.querySelectorAll("input").forEach(el=>{el.addEventListener("input",()=>{updateFinanceTotals();renderFinancePreview()});el.addEventListener("change",()=>{updateFinanceTotals();renderFinancePreview()})});
  tr.querySelector(".delete-row").onclick=()=>{tr.remove();updateFinanceTotals();renderFinancePreview()};
}
$("#addIncomeRow").onclick=()=>addDetailRow("pemasukan");
$("#addExpenseRow").onclick=()=>addDetailRow("pengeluaran");

function getRowData(tr,jenis,index){
  const tanggal=tr.querySelector(".detail-date").value;
  const kategori=tr.querySelector(".detail-kategori").value.trim();
  const uraian=tr.querySelector(".detail-uraian").value.trim();
  const nominalValue=tr.querySelector(".detail-nominal").value;
  const urutanValue=tr.querySelector(".detail-urutan").value;
  const hasAny=[tanggal,kategori,uraian,nominalValue,urutanValue].some(Boolean);
  if(!hasAny)return null;
  if(!tanggal||!kategori||!uraian||!nominalValue)throw new Error(`Lengkapi semua field rincian ${jenis} pada baris ${index+1}.`);
  const nominal=Number(nominalValue||0),urutan=Number(urutanValue||index+1);
  if(!Number.isFinite(nominal)||nominal<=0)throw new Error(`Nominal ${jenis} pada baris ${index+1} harus lebih besar dari nol.`);
  return {tanggal_transaksi:tanggal,jenis,kategori,uraian,nominal,urutan};
}
function collectFinanceDetails(){
  const result=[];
  ["pemasukan","pengeluaran"].forEach(jenis=>{
    const rows=[...document.querySelectorAll((jenis==="pemasukan"?"#incomeRows":"#expenseRows")+" .detail-row")];
    rows.forEach((tr,index)=>{const row=getRowData(tr,jenis,index);if(row)result.push(row)});
  });
  return result;
}
function calcTotalsFromDetails(details){
  const income=details.filter(x=>x.jenis==="pemasukan").reduce((s,x)=>s+Number(x.nominal||0),0);
  const expense=details.filter(x=>x.jenis==="pengeluaran").reduce((s,x)=>s+Number(x.nominal||0),0);
  const saldoAwal=Number($("#saldoAwal").value||0);
  const balance=saldoAwal+income-expense;
  return {income,expense,saldoAwal,balance};
}
function safeCollectDetails(){try{return collectFinanceDetails()}catch(err){return []}}
function updateFinanceTotals(){
  const details=safeCollectDetails();
  const {income,expense,balance}=calcTotalsFromDetails(details);
  $("#summaryIncome").textContent=rupiah(income);
  $("#summaryExpense").textContent=rupiah(expense);
  $("#summaryBalance").textContent=rupiah(balance);
  $("#incomeTotalText").textContent=rupiah(income);
  $("#expenseTotalText").textContent=rupiah(expense);
  updateContinuityCheck();
}
function renderPosterList(kind,details){
  const list=$(kind==="pemasukan"?"#previewIncomeList":"#previewExpenseList");
  const source=details
    .filter(x=>x.jenis===kind)
    .sort((a,b)=>(a.urutan||0)-(b.urutan||0));

  const items=source.slice(0,8);

  if(!items.length){
    list.innerHTML='<div class="poster-row empty"><span>Belum ada data</span><strong>-</strong></div>';
    return;
  }

  list.innerHTML=items.map((x,i)=>{
    const label=(x.uraian||x.kategori||"Transaksi").trim();
    return `<div class="poster-row"><span>${i+1}. ${label}</span><strong>${rupiah(x.nominal)}</strong></div>`;
  }).join("");

  if(source.length>8){
    list.innerHTML+=`<div class="poster-more">+ ${source.length-8} transaksi lainnya</div>`;
  }
}
function renderFinancePreview(){
  if($("#dataMode").value!=="structured")return;
  const details=safeCollectDetails();
  const {income,expense,saldoAwal,balance}=calcTotalsFromDetails(details);
  $("#previewPeriodText").textContent=$("#periodeAwal").value&&$("#periodeAkhir").value?`Periode: ${fmtPeriod($("#periodeAwal").value,$("#periodeAkhir").value)}`:"Periode belum dipilih";
  $("#previewPublishDate").textContent=$("#publishDate").value?fmtDate($("#publishDate").value):"-";
  $("#previewSaldoAwal").textContent=rupiah(saldoAwal);
  $("#previewIncomeTotal").textContent=rupiah(income);
  $("#previewExpenseTotal").textContent=rupiah(expense);
  $("#previewFinalBalance").textContent=rupiah(balance);
  $("#previewCatatan").textContent=$("#keuanganCatatan").value.trim()||"Belum ada catatan tambahan.";
  renderPosterList("pemasukan",details);
  renderPosterList("pengeluaran",details);
}
async function buildFinancePosterBlob(){
  renderFinancePreview();
  const node=$("#financePosterPreview");
  const canvas=await window.html2canvas(node,{backgroundColor:"#f7f2e7",scale:2,useCORS:true,width:960,height:540});
  const finalCanvas=document.createElement("canvas");
  finalCanvas.width=1920;finalCanvas.height=1080;
  const ctx=finalCanvas.getContext("2d");
  ctx.drawImage(canvas,0,0,1920,1080);
  return await new Promise(resolve=>finalCanvas.toBlob(resolve,"image/jpeg",0.92));
}
function makeFinancePosterName(){
  const a=$("#periodeAwal").value||"tanpa-awal",b=$("#periodeAkhir").value||"tanpa-akhir";
  return `generated/laporan-structured-${a}-${b}-${Date.now()}.jpg`;
}

$("#kajianForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{
  const id=+$("#kajianId").value||null,file=$("#posterFile").files[0];
  if(!validateFile(file))return;

  let poster=$("#posterLama").value||null;
  if(file){
    const old=poster;
    poster=await upload("poster-kajian",file,"agenda");
    if(old)await removeFile("poster-kajian",old);
  }

  const kategoriUtama=$("#kategoriUtama").value;
  const jenisAgenda=$("#jenisAgenda").value;

  const payload={
    kategori_utama:kategoriUtama,
    jenis_agenda:jenisAgenda,

    // Kolom legacy "jenis" tetap diisi agar public website lama
    // tetap kompatibel sampai Phase public migration berikutnya.
    jenis:agendaLabel(jenisAgenda),

    judul:$("#judul").value.trim(),
    tema:$("#tema").value.trim()||null,
    penceramah:$("#penceramah").value.trim()||null,
    lokasi:$("#lokasi").value.trim()||null,
    tanggal:$("#tanggal").value||null,
    waktu:$("#waktu").value.trim()||null,
    poster_url:poster,
    status:$("#kajianStatus").value
  };

  const {error}=id
    ?await db.from("kajian").update(payload).eq("id",id)
    :await db.from("kajian").insert(payload);

  if(error)throw error;

  closeF("kajian");
  toast(id?"Agenda berhasil diperbarui.":"Agenda berhasil ditambahkan.","success");
  await loadAll();
}catch(err){
  toast(err.message,"error");
}finally{
  setBusy(form,false);
}};
$("#mediaForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{const id=+$("#mediaId").value||null,url=$("#youtubeUrl").value.trim(),payload={judul:$("#mediaJudul").value.trim(),kategori:$("#mediaKategori").value.trim()||null,youtube_url:url,youtube_id:yid(url),tanggal:$("#mediaTanggal").value||null,status:$("#mediaStatus").value};const {error}=id?await db.from("media").update(payload).eq("id",id):await db.from("media").insert(payload);if(error)throw error;closeF("media");toast(id?"Video berhasil diperbarui.":"Video berhasil ditambahkan.","success");await loadAll()}catch(err){toast(err.message,"error")}finally{setBusy(form,false)}};

async function saveLegacyFinance(id){
  const a=$("#periodeAwal").value,b=$("#periodeAkhir").value,file=$("#keuanganImage").files[0];
  if(b<a)throw new Error("Periode akhir tidak boleh lebih awal dari periode awal.");
  if(!id&&!file)throw new Error("File laporan wajib diupload.");
  if(!validateFile(file))return;
  let image=$("#keuanganImageLama").value||null;
  if(file){image=await upload("laporan-keuangan",file,"laporan")}
  const payload={periode_awal:a,periode_akhir:b,tanggal_publish:$("#publishDate").value,image_url:image,status:$("#keuanganStatus").value,data_mode:"legacy",saldo_awal:null,total_pemasukan:null,total_pengeluaran:null,saldo_akhir:null,catatan:null};
  const {error}=id?await db.from("keuangan").update(payload).eq("id",id):await db.from("keuangan").insert(payload);if(error)throw error;
  if(file&&id){const old=$("#keuanganImageLama").value||null;if(old&&old!==image)await removeFile("laporan-keuangan",old)}
}
async function saveStructuredFinance(id){
  const a=$("#periodeAwal").value,b=$("#periodeAkhir").value;
  if(b<a)throw new Error("Periode akhir tidak boleh lebih awal dari periode awal.");
  const details=collectFinanceDetails();
  if(!details.length)throw new Error("Minimal isi satu rincian pemasukan atau pengeluaran.");
  details.forEach((x,i)=>{if(x.tanggal_transaksi<a||x.tanggal_transaksi>b)throw new Error(`Tanggal transaksi pada baris ${i+1} berada di luar periode laporan.`)});
  const totals=calcTotalsFromDetails(details);
  if(totals.balance<0)throw new Error("Saldo akhir tidak boleh negatif.");
  const oldImage=$("#keuanganImageLama").value||null;
  const posterBlob=await buildFinancePosterBlob();
  if(!posterBlob)throw new Error("Gagal membuat preview JPG laporan.");
  let newImage;
  try{
    newImage=await uploadBlob("laporan-keuangan",posterBlob,makeFinancePosterName());
  }catch(err){
    if(String(err?.message||"").toLowerCase().includes("row-level security")){
      throw new Error("Upload poster ditolak oleh Storage RLS. Jalankan SQL hotfix Phase 2.1 lalu coba simpan kembali.");
    }
    throw err;
  }
  const payload={
    periode_awal:a,
    periode_akhir:b,
    tanggal_publish:$("#publishDate").value,
    image_url:newImage,
    status:$("#keuanganStatus").value,
    data_mode:"structured",
    saldo_awal:totals.saldoAwal,
    total_pemasukan:totals.income,
    total_pengeluaran:totals.expense,
    saldo_akhir:totals.balance,
    catatan:$("#keuanganCatatan").value.trim()||null
  };
  let headerId=id;
  if(id){
    const {error}=await db.from("keuangan").update(payload).eq("id",id);if(error)throw error;
    const {error:delError}=await db.from("keuangan_detail").delete().eq("keuangan_id",id);if(delError)throw delError;
  }else{
    const {data,error}=await db.from("keuangan").insert(payload).select("id").single();if(error)throw error;headerId=data.id;
  }
  const insertDetails=details.map((x,index)=>({keuangan_id:headerId,tanggal_transaksi:x.tanggal_transaksi,jenis:x.jenis,kategori:x.kategori,uraian:x.uraian,nominal:x.nominal,urutan:x.urutan||index+1}));
  const {error:insError}=await db.from("keuangan_detail").insert(insertDetails);if(insError)throw insError;
  if(id&&oldImage&&oldImage!==newImage)await removeFile("laporan-keuangan",oldImage).catch(()=>null);
}

$("#keuanganForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{
  const id=+$("#keuanganId").value||null;
  if($("#dataMode").value==="structured")await saveStructuredFinance(id);else await saveLegacyFinance(id);
  closeF("keuangan");toast(id?"Laporan berhasil diperbarui.":"Laporan berhasil ditambahkan.","success");await loadAll();
}catch(err){toast(err.message,"error")}finally{setBusy(form,false)}};

window.editK=id=>{
  const x=kajianData.find(x=>x.id===id);
  openF("kajian");
  $("#kajianId").value=x.id;
  $("#kategoriUtama").value=x.kategori_utama||"kajian";
  $("#jenisAgenda").value=x.jenis_agenda||"kajian";
  $("#judul").value=x.judul||"";
  $("#tema").value=x.tema||"";
  $("#penceramah").value=x.penceramah||"";
  $("#lokasi").value=x.lokasi||"";
  $("#tanggal").value=x.tanggal||"";
  $("#waktu").value=x.waktu||"";
  $("#kajianStatus").value=x.status||"publish";
  $("#posterLama").value=x.poster_url||"";
  showStoredPreview(x.poster_url,"#posterPreviewWrap","#posterPreview","#posterPreviewMeta");
};
window.editM=id=>{const x=mediaData.find(x=>x.id===id);openF("media");$("#mediaId").value=x.id;$("#mediaJudul").value=x.judul||"";$("#mediaKategori").value=x.kategori||"";$("#youtubeUrl").value=x.youtube_url||"";$("#mediaTanggal").value=x.tanggal||"";$("#mediaStatus").value=x.status||"publish"};
window.editF=async id=>{const x=keuanganData.find(x=>x.id===id);openF("keuangan");openingBalanceTouched=true;$("#keuanganId").value=x.id;$("#periodeAwal").value=x.periode_awal||"";$("#periodeAkhir").value=x.periode_akhir||"";$("#publishDate").value=x.tanggal_publish||"";$("#keuanganStatus").value=x.status||"publish";$("#keuanganImageLama").value=x.image_url||"";$("#dataMode").value=x.data_mode||"legacy";toggleFinanceMode();
  if((x.data_mode||"legacy")==="structured"){
    $("#saldoAwal").value=x.saldo_awal??"";$("#keuanganCatatan").value=x.catatan||"";$("#incomeRows").innerHTML="";$("#expenseRows").innerHTML="";
    const {data,error}=await db.from("keuangan_detail").select("*").eq("keuangan_id",x.id).order("jenis",{ascending:true}).order("urutan",{ascending:true}).order("tanggal_transaksi",{ascending:true});
    if(error)throw error;
    (data||[]).forEach(row=>addDetailRow(row.jenis,row));
    if(!data||!data.length){addDetailRow("pemasukan");addDetailRow("pengeluaran")}
    updateFinanceTotals();renderFinancePreview();
  }else{
    showStoredPreview(x.image_url,"#keuanganPreviewWrap","#keuanganPreview","#keuanganPreviewMeta");
  }
  updatePeriodPreview();
};
function askDelete(message){return new Promise(resolve=>{pendingDelete=resolve;$("#confirmMessage").textContent=message;$("#confirmModal").classList.remove("hidden")})}
function finishDelete(answer){$("#confirmModal").classList.add("hidden");if(pendingDelete){pendingDelete(answer);pendingDelete=null}}
$("#cancelDelete").onclick=()=>finishDelete(false);$("#confirmDelete").onclick=()=>finishDelete(true);
async function deleteRecord(kind,id,button){if(!await askDelete("Data ini akan dihapus dan tidak dapat dikembalikan."))return;try{if(button)button.disabled=true;let x,error;if(kind==="kajian"){x=kajianData.find(x=>x.id===id);({error}=await db.from("kajian").delete().eq("id",id))}else if(kind==="media"){({error}=await db.from("media").delete().eq("id",id))}else{x=keuanganData.find(x=>x.id===id);({error}=await db.from("keuangan").delete().eq("id",id))}if(error)throw error;if(kind==="kajian"&&x&&x.poster_url)await removeFile("poster-kajian",x.poster_url);if(kind==="keuangan"&&x&&x.image_url)await removeFile("laporan-keuangan",x.image_url);toast("Data berhasil dihapus.","success");await loadAll()}catch(err){toast(err.message,"error")}finally{if(button)button.disabled=false}}
window.deleteKajian=(id,button)=>deleteRecord("kajian",id,button);window.deleteMedia=(id,button)=>deleteRecord("media",id,button);window.deleteFinance=(id,button)=>deleteRecord("keuangan",id,button);

(async()=>{try{if(await requireAuth()){toggleFinanceMode();resetFinanceForm();updateFinanceTotals();renderFinancePreview();await loadAll()}}catch(err){toast(err.message,"error")}})();
