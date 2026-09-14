const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ADMIN_JS = path.join(ROOT, "admin", "admin.js");
const ADMIN_CSS = path.join(ROOT, "admin", "admin.css");
const GITIGNORE = path.join(ROOT, ".gitignore");

function requireFile(file) {
  if (!fs.existsSync(file)) throw new Error(`File tidak ditemukan: ${file}`);
}

function backupOnce(file) {
  const backup = `${file}.finance-typography-v2.bak`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(file, backup);
    console.log(`[BACKUP] ${path.relative(ROOT, backup)}`);
  }
}

requireFile(ADMIN_JS);
requireFile(ADMIN_CSS);

backupOnce(ADMIN_JS);
backupOnce(ADMIN_CSS);

const jsStartMarker = "// Phase Finance Typography v2.0 START";
const jsEndMarker = "// Phase Finance Typography v2.0 END";

const jsBlock = `// Phase Finance Typography v2.0 START
function fitPosterRowLabels(list){
  if(!list)return;

  const MAX_SIZE=15.5;
  const MIN_SIZE=13;
  const STEP=.5;

  list.querySelectorAll(".poster-row-label").forEach(node=>{
    node.style.fontSize="";

    if(node.clientWidth<=0)return;

    let size=MAX_SIZE;
    node.style.fontSize=\`\${size}px\`;

    while(node.scrollWidth>node.clientWidth&&size>MIN_SIZE){
      size=Math.max(MIN_SIZE,size-STEP);
      node.style.fontSize=\`\${size}px\`;
    }

    node.classList.toggle("poster-row-label-tight",size<MAX_SIZE);
  });
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
    return \`<div class="poster-row"><span class="poster-row-label" title="\${escHTML(label)}">\${i+1}. \${escHTML(label)}</span><strong>\${rupiah(x.nominal)}</strong></div>\`;
  }).join("");

  if(source.length>8){
    list.innerHTML+=\`<div class="poster-more">+ \${source.length-8} transaksi lainnya</div>\`;
  }

  fitPosterRowLabels(list);
}
// Phase Finance Typography v2.0 END

`;

let js = fs.readFileSync(ADMIN_JS, "utf8");

if (js.includes(jsStartMarker)) {
  const start = js.indexOf(jsStartMarker);
  const endMarkerPos = js.indexOf(jsEndMarker, start);
  if (endMarkerPos < 0) throw new Error("Marker JS Finance Typography v2.0 tidak lengkap.");
  const end = endMarkerPos + jsEndMarker.length;
  js = js.slice(0, start) + jsBlock.trimEnd() + js.slice(end);
  console.log("[PATCH] Existing Finance Typography v2.0 JS diperbarui.");
} else {
  const start = js.indexOf("function renderPosterList(kind,details){");
  const end = js.indexOf("function renderFinancePreview(){", start);

  if (start < 0 || end < 0) {
    throw new Error("Anchor renderPosterList/renderFinancePreview tidak ditemukan. Patch dibatalkan.");
  }

  js = js.slice(0, start) + jsBlock + js.slice(end);
  console.log("[PATCH] Adaptive weekly poster typography JS dipasang.");
}

fs.writeFileSync(ADMIN_JS, js, "utf8");

const cssStartMarker = "/* Finance Typography v2.0 START */";
const cssEndMarker = "/* Finance Typography v2.0 END */";

const cssBlock = `/* Finance Typography v2.0 START */
/* Weekly 16:9 poster readability optimization.
   Monthly/yearly PDF styles are intentionally untouched. */

.finance-poster{
  grid-template-columns:176px 1fr;
}

.poster-side{
  padding:18px 16px;
  gap:14px;
}

.poster-brand-logo{
  width:108px;
  height:108px;
  padding:7px;
  border-width:3px;
}

.poster-brand-title{
  font-size:22px;
  line-height:1.05;
}

.poster-brand-tagline{
  font-size:14px;
  line-height:1.35;
}

.poster-main{
  padding:16px 20px 14px;
  gap:9px;
}

.poster-header-row{
  gap:10px;
}

.poster-kicker{
  font-size:30px;
  line-height:1.02;
}

.poster-period-badge{
  margin-top:7px;
  padding:7px 14px;
  font-size:14.5px;
}

.poster-publish-box{
  min-width:148px;
  padding:9px 11px;
}

.poster-publish-box span{
  font-size:11.5px;
}

.poster-publish-box strong{
  margin-top:4px;
  font-size:15.5px;
}

.poster-top-stats{
  gap:8px;
}

.poster-stat-card{
  padding:9px 11px;
}

.poster-stat-card span{
  font-size:11.5px;
}

.poster-stat-card strong{
  margin-top:5px;
  font-size:20px;
}

.poster-columns{
  gap:10px;
  min-height:0;
}

.poster-box-head{
  padding:9px 12px;
  font-size:19px;
}

.poster-list{
  padding:8px 12px 9px;
  gap:0;
}

.poster-row{
  gap:12px;
  padding:4.5px 0;
  font-size:15.5px;
  line-height:1.15;
}

.poster-row .poster-row-label{
  flex:1 1 auto;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  letter-spacing:-.08px;
}

.poster-row .poster-row-label-tight{
  letter-spacing:-.16px;
}

.poster-row strong{
  flex:0 0 auto;
  margin-left:0;
  font-size:15.5px;
  line-height:1.15;
  white-space:nowrap;
}

.poster-more{
  margin-top:4px;
  font-size:11.5px;
}

.poster-footer-row{
  grid-template-columns:220px 1fr;
  gap:10px;
}

.poster-balance-box,
.poster-note-box{
  padding:9px 12px;
}

.poster-balance-box span{
  font-size:12.5px;
}

.poster-balance-box strong{
  margin-top:5px;
  font-size:25px;
}

.poster-note-title{
  font-size:13.5px;
  margin-bottom:4px;
}

.poster-note-box p{
  font-size:11.5px;
  line-height:1.3;
}
/* Finance Typography v2.0 END */
`;

let css = fs.readFileSync(ADMIN_CSS, "utf8");

if (css.includes(cssStartMarker)) {
  const start = css.indexOf(cssStartMarker);
  const endMarkerPos = css.indexOf(cssEndMarker, start);
  if (endMarkerPos < 0) throw new Error("Marker CSS Finance Typography v2.0 tidak lengkap.");
  const end = endMarkerPos + cssEndMarker.length;
  css = css.slice(0, start) + cssBlock.trimEnd() + css.slice(end);
  console.log("[PATCH] Existing Finance Typography v2.0 CSS diperbarui.");
} else {
  if (!css.endsWith("\n")) css += "\n";
  css += "\n" + cssBlock.trim() + "\n";
  console.log("[PATCH] Finance Typography v2.0 CSS dipasang.");
}

fs.writeFileSync(ADMIN_CSS, css, "utf8");

if (fs.existsSync(GITIGNORE)) {
  let gi = fs.readFileSync(GITIGNORE, "utf8");
  const rule = "*.finance-typography-v2.bak";
  if (!gi.split(/\r?\n/).some(line => line.trim() === rule)) {
    if (!gi.endsWith("\n")) gi += "\n";
    gi += rule + "\n";
    fs.writeFileSync(GITIGNORE, gi, "utf8");
    console.log("[PATCH] .gitignore: *.finance-typography-v2.bak");
  }
}

console.log("\n[OK] Finance Typography v2.0 terpasang.");
console.log("Perubahan hanya renderer JPG pekanan.");
console.log("NEXT:");
console.log("  node --check admin/admin.js");
console.log("  bash scripts/verify-finance-typography-v2.sh");
