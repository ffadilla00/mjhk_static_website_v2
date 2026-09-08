#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

const BUCKET = "laporan-keuangan";
const ARCHIVE_FOLDER = "archive";

const FILES = {
  kajian: path.join(ROOT, "assets", "data", "kajian.json"),
  media: path.join(ROOT, "assets", "data", "media.json"),
  keuangan: path.join(ROOT, "assets", "data", "keuangan.json"),
};

const MONTHS = {
  januari:1,februari:2,maret:3,april:4,mei:5,juni:6,
  juli:7,agustus:8,september:9,oktober:10,november:11,desember:12
};

const summary = {
  source:{kajian:0,media:0,keuangan:0,total:0},
  inserted:{kajian:0,media:0,keuangan:0,total:0},
  skipped:{kajian:0,media:0,keuangan:0,total:0},
  failed:{kajian:0,media:0,keuangan:0,total:0},
  filesUploaded:0,
  filesSkipped:0,
  rollbacks:0
};

function die(msg){ console.error("ERROR:",msg); process.exit(1); }
function clean(v){ return v==null ? "" : String(v).trim(); }
function nullable(v){ const x=clean(v); return x || null; }
function readJson(file){
  if(!fs.existsSync(file)) die(`File tidak ditemukan: ${file}`);
  const data = JSON.parse(fs.readFileSync(file,"utf8"));
  if(!Array.isArray(data)) die(`JSON harus berupa array: ${file}`);
  return data;
}
function iso(y,m,d){ return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
function encodePath(p){ return p.split("/").map(encodeURIComponent).join("/"); }
function publicUrl(bucket,p){ return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodePath(p)}`; }
function ctype(file){
  const e=path.extname(file).toLowerCase();
  return e===".png" ? "image/png" : "image/jpeg";
}
async function api(url,options={}){
  const headers={
    apikey:SUPABASE_SECRET_KEY,
    Authorization:`Bearer ${SUPABASE_SECRET_KEY}`,
    ...(options.headers||{})
  };
  const r=await fetch(url,{...options,headers});
  if(!r.ok){
    const t=await r.text().catch(()=> "");
    throw new Error(`${r.status} ${r.statusText}${t?` - ${t}`:""}`);
  }
  return r;
}
async function selectAll(table){
  return (await api(`${SUPABASE_URL}/rest/v1/${table}?select=*`)).json();
}
async function insertRow(table,payload){
  return (await api(`${SUPABASE_URL}/rest/v1/${table}`,{
    method:"POST",
    headers:{"Content-Type":"application/json",Prefer:"return=representation"},
    body:JSON.stringify(payload)
  })).json();
}
async function storageExists(bucket,p){
  const r=await fetch(publicUrl(bucket,p),{method:"HEAD"});
  return r.ok;
}
async function uploadFile(bucket,p,local){
  const body=fs.readFileSync(local);
  await api(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(p)}`,{
    method:"POST",
    headers:{"Content-Type":ctype(local),"x-upsert":"false"},
    body
  });
  return publicUrl(bucket,p);
}
async function deleteFile(bucket,p){
  await api(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}`,{
    method:"DELETE",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({prefixes:[p]})
  });
}
function parsePeriod(text){
  const s=clean(text).replace(/\bs\/d\b/gi,"sampai").replace(/\s+/g," ");
  let m=s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+sampai\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
  if(m){
    const m1=MONTHS[m[2].toLowerCase()],m2=MONTHS[m[4].toLowerCase()];
    if(m1&&m2) return {start:iso(+m[5],m1,+m[1]),end:iso(+m[5],m2,+m[3])};
  }
  m=s.match(/^(\d{1,2})\s+sampai\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
  if(m){
    const mm=MONTHS[m[3].toLowerCase()];
    if(mm) return {start:iso(+m[4],mm,+m[1]),end:iso(+m[4],mm,+m[2])};
  }
  m=s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+sampai\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
  if(m){
    const m1=MONTHS[m[2].toLowerCase()],m2=MONTHS[m[5].toLowerCase()];
    if(m1&&m2) return {start:iso(+m[3],m1,+m[1]),end:iso(+m[6],m2,+m[4])};
  }
  throw new Error(`Format periode tidak dikenali: ${text}`);
}
function youtubeId(item){
  if(clean(item.youtube_id)) return clean(item.youtube_id);
  const m=clean(item.youtube_url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return m?m[1]:null;
}
function safeName(file){ return path.basename(file).replace(/[^A-Za-z0-9._-]+/g,"-"); }

async function migrateKajian(src){
  const existing=await selectAll("kajian");
  for(const item of src){
    try{
      const payload={
        jenis:nullable(item.jenis),
        judul:clean(item.judul),
        tema:nullable(item.tema),
        penceramah:nullable(item.penceramah),
        tanggal:nullable(item.tanggal),
        waktu:nullable(item.waktu),
        poster_url:nullable(item.poster_url),
        status:clean(item.status)||"draft"
      };
      const dup=existing.some(x=>clean(x.judul)===payload.judul && clean(x.tanggal)===clean(payload.tanggal) && clean(x.penceramah)===clean(payload.penceramah));
      if(dup){ summary.skipped.kajian++; console.log("[KAJIAN] SKIP DUPLICATE",payload.judul); continue; }
      if(DRY_RUN){ console.log("[KAJIAN] WOULD INSERT",payload); continue; }
      await insertRow("kajian",payload);
      existing.push(payload);
      summary.inserted.kajian++;
      console.log("[KAJIAN] INSERTED",payload.judul);
    }catch(e){ summary.failed.kajian++; console.error("[KAJIAN] FAILED",item.judul,e.message); }
  }
}

async function migrateMedia(src){
  const existing=await selectAll("media");
  for(const item of src){
    try{
      const yid=youtubeId(item);
      const payload={
        judul:clean(item.judul),
        kategori:nullable(item.kategori),
        youtube_url:clean(item.youtube_url),
        youtube_id:yid,
        tanggal:nullable(item.tanggal),
        status:clean(item.status)||"draft"
      };
      const dup=existing.some(x=>(yid&&clean(x.youtube_id)===yid)||clean(x.youtube_url)===payload.youtube_url);
      if(dup){ summary.skipped.media++; console.log("[MEDIA] SKIP DUPLICATE",payload.judul); continue; }
      if(DRY_RUN){ console.log("[MEDIA] WOULD INSERT",payload); continue; }
      await insertRow("media",payload);
      existing.push(payload);
      summary.inserted.media++;
      console.log("[MEDIA] INSERTED",payload.judul);
    }catch(e){ summary.failed.media++; console.error("[MEDIA] FAILED",item.judul,e.message); }
  }
}

async function migrateKeuangan(src){
  const existing=await selectAll("keuangan");
  for(const item of src){
    let newUploaded=false, storagePath=null;
    try{
      const period=item.periode_awal&&item.periode_akhir ? {start:item.periode_awal,end:item.periode_akhir} : parsePeriod(item.periode);
      const dup=existing.some(x=>clean(x.periode_awal)===period.start && clean(x.periode_akhir)===period.end);
      if(dup){ summary.skipped.keuangan++; summary.filesSkipped++; console.log("[KEUANGAN] SKIP DUPLICATE",period); continue; }

      const rel=clean(item.image);
      const local=path.resolve(ROOT,rel);
      if(!rel||!fs.existsSync(local)) throw new Error(`File gambar tidak ditemukan: ${rel||"(kosong)"}`);

      storagePath=`${ARCHIVE_FOLDER}/${safeName(local)}`;
      const imgUrl=publicUrl(BUCKET,storagePath);
      const payload={
        periode_awal:period.start,
        periode_akhir:period.end,
        tanggal_publish:clean(item.tanggal_publish),
        image_url:imgUrl,
        status:clean(item.status)||"draft"
      };

      const exists=await storageExists(BUCKET,storagePath);

      if(DRY_RUN){
        console.log("[KEUANGAN] SOURCE FILE",rel);
        console.log("[KEUANGAN] STORAGE TARGET",`${BUCKET}/${storagePath}`,exists?"EXISTS":"NEW");
        console.log("[KEUANGAN] DATABASE PAYLOAD",payload);
        console.log("[KEUANGAN] WOULD INSERT",period);
        continue;
      }

      if(exists){ summary.filesSkipped++; console.log("[STORAGE] SKIP EXISTING",storagePath); }
      else{
        await uploadFile(BUCKET,storagePath,local);
        newUploaded=true;
        summary.filesUploaded++;
        console.log("[STORAGE] UPLOADED",storagePath);
      }

      try{
        await insertRow("keuangan",payload);
      }catch(dbErr){
        if(newUploaded){
          try{ await deleteFile(BUCKET,storagePath); summary.rollbacks++; console.log("[ROLLBACK] DELETED",storagePath); }catch(_){}
        }
        throw dbErr;
      }

      existing.push(payload);
      summary.inserted.keuangan++;
      console.log("[KEUANGAN] INSERTED",period);
    }catch(e){ summary.failed.keuangan++; console.error("[KEUANGAN] FAILED",item.periode,e.message); }
  }
}

function printSummary(){
  summary.source.total=summary.source.kajian+summary.source.media+summary.source.keuangan;
  summary.inserted.total=summary.inserted.kajian+summary.inserted.media+summary.inserted.keuangan;
  summary.skipped.total=summary.skipped.kajian+summary.skipped.media+summary.skipped.keuangan;
  summary.failed.total=summary.failed.kajian+summary.failed.media+summary.failed.keuangan;
  console.log("\n=== SUMMARY ===");
  console.log("MODE:",DRY_RUN?"DRY RUN":"MIGRATION");
  console.log("SOURCE:",summary.source.total);
  console.log("INSERTED:",summary.inserted.total);
  console.log("SKIPPED:",summary.skipped.total);
  console.log("FAILED:",summary.failed.total);
  console.log("FILES UPLOADED:",summary.filesUploaded);
  console.log("FILES SKIPPED:",summary.filesSkipped);
  console.log("ROLLBACKS:",summary.rollbacks);
}

(async()=>{
  if(!SUPABASE_URL) die("SUPABASE_URL belum di-set.");
  if(!SUPABASE_SECRET_KEY) die("SUPABASE_SECRET_KEY belum di-set.");

  const kajian=readJson(FILES.kajian);
  const media=readJson(FILES.media);
  const keuangan=readJson(FILES.keuangan);

  summary.source.kajian=kajian.length;
  summary.source.media=media.length;
  summary.source.keuangan=keuangan.length;

  await migrateKajian(kajian);
  await migrateMedia(media);
  await migrateKeuangan(keuangan);

  printSummary();
  if(summary.failed.total>0) process.exitCode=1;
})().catch(e=>{ console.error(e); process.exit(1); });
