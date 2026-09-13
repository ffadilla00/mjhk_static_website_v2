const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_QUESTION = 300;
const MAX_AI_CONTEXT = 9000;
const MAX_BODY_BYTES = 2048;

class PayloadTooLargeError extends Error {}
class RateLimitError extends Error {}

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "X-Robots-Tag": "noindex, nofollow, noarchive"
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(),
      ...extraHeaders
    }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  return configured.includes(origin) ? origin : "";
}

function corsHeaders(origin) {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      }
    : {};
}

function clean(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isJsonContentType(request) {
  const value = (request.headers.get("Content-Type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  return value === "application/json";
}

async function readJsonBodyLimited(request) {
  const declared = Number(request.headers.get("Content-Length") || "0");

  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError("Request body terlalu besar.");
  }

  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;

      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError("Request body terlalu besar.");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const bodyText = new TextDecoder().decode(bytes);

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new SyntaxError("Body JSON tidak valid.");
  }
}

function clientRateKey(request, origin) {
  const ip = request.headers.get("CF-Connecting-IP") || "local-dev";
  return `${origin || "no-origin"}|${ip}`;
}

async function enforceRateLimit(binding, key) {
  if (!binding || typeof binding.limit !== "function") {
    throw new Error("Rate limiter binding belum tersedia.");
  }

  const { success } = await binding.limit({ key });

  if (!success) {
    throw new RateLimitError("Rate limit exceeded.");
  }
}

function markdownToText(value) {
  return String(value ?? "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentences(value, maxSentences = 3, maxChars = 520) {
  const text = markdownToText(value);
  if (!text) return "";

  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  let out = "";

  for (const part of parts.slice(0, maxSentences)) {
    const next = `${out}${out ? " " : ""}${clean(part)}`.trim();
    if (next.length > maxChars) break;
    out = next;
  }

  return out || text.slice(0, maxChars).trim();
}

const MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];

const MONTH_ALIASES = {
  januari:1, jan:1,
  februari:2, feb:2,
  maret:3, mar:3,
  april:4, apr:4,
  mei:5,
  juni:6, jun:6,
  juli:7, jul:7,
  agustus:8, agu:8, agt:8,
  september:9, sep:9, sept:9,
  oktober:10, okt:10,
  november:11, nov:11,
  desember:12, des:12
};

function classify(question) {
  const q = question.toLowerCase();
  const intents = [];

  if (
    /(agenda|kegiatan|kajian|dakwah|seminar|pelatihan|training|ustadz|ustad|penceramah|narasumber|tafsir|bidayatul|sirah|fiqih|fiqh|al-azkar|mawarits|maulid)/.test(q)
  ) {
    intents.push("agenda");
  }

  if (
    /(keuangan|kas|saldo|pemasukan|pengeluaran|arus kas|laporan|infak|infaq|sedekah|donatur|operasional|kafalah)/.test(q)
  ) {
    intents.push("keuangan");
  }

  if (/(youtube|video|media|rekaman|tonton|stream)/.test(q)) {
    intents.push("media");
  }

  if (
    /(sejarah|visi|misi|profile|profil|dkm|pengurus|ketua|struktur|program|fasilitas)/.test(q)
  ) {
    intents.push("profile");
  }

  if (
    !intents.length &&
    /(assalamu|assalam|halo|hai|hello|pagi|siang|sore|malam)\b/.test(q)
  ) {
    return ["greeting"];
  }

  return [...new Set(intents)];
}

async function supabaseGet(env, table, params) {
  const url = new URL(
    `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`
  );

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Supabase ${table}: ${response.status} ${detail.slice(0, 240)}`
    );
  }

  return response.json();
}

function todayISOJakarta() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function currentJakartaParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map(x => [x.type, x.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  };
}

function parseISODateParts(value) {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) {
    return null;
  }

  return { year, month, day };
}

function formatDate(value) {
  const parts = parseISODateParts(value);
  if (!parts) return "";

  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

function formatPeriod(a, b) {
  const A = parseISODateParts(a);
  const B = parseISODateParts(b);

  if (!A || !B) return "";

  if (A.year === B.year && A.month === B.month) {
    return `${A.day}–${B.day} ${MONTHS[B.month - 1]} ${B.year}`;
  }

  return `${formatDate(a)} – ${formatDate(b)}`;
}

function rupiah(value) {
  const n = Number(value || 0);
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0
  }).format(n)}`;
}

function monthFromQuestion(question) {
  const q = question.toLowerCase();

  for (const [name, month] of Object.entries(MONTH_ALIASES)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(q)) return month;
  }

  if (/\bbulan ini\b/.test(q)) {
    return currentJakartaParts().month;
  }

  return null;
}

function yearFromQuestion(question) {
  const explicit = question.match(/\b(20\d{2})\b/);
  if (explicit) return Number(explicit[1]);

  if (/\b(tahun ini|bulan ini)\b/i.test(question)) {
    return currentJakartaParts().year;
  }

  return null;
}

function financeScope(question) {
  const q = question.toLowerCase();
  const month = monthFromQuestion(question);
  const year = yearFromQuestion(question);

  if (
    /\b(tahunan|setahun|per tahun|tahun ini)\b/.test(q) ||
    (/\btahun\b/.test(q) && year && !month)
  ) {
    return "yearly";
  }

  if (
    month ||
    /\b(bulanan|per bulan|bulan ini|bulan lalu)\b/.test(q)
  ) {
    return "monthly";
  }

  return "weekly";
}

function financeCategoryHint(question) {
  const q = question.toLowerCase();

  return /(infak|infaq|sedekah|donatur|tromol|yatim|dhuafa|operasional|kafalah|dakwah)/.test(q);
}

async function retrieveContext(env, intents, question) {
  const tasks = [];

  if (intents.includes("agenda")) {
    tasks.push(
      supabaseGet(env, "agenda_publik", {
        select: "id,kategori_utama,jenis_agenda,jenis_legacy,judul,tema,penceramah,lokasi,tanggal,waktu",
        tanggal: `gte.${todayISOJakarta()}`,
        order: "tanggal.asc",
        limit: "30"
      }).then(data => ({ type: "agenda", data }))
    );
  }

  if (intents.includes("keuangan")) {
    const scope = financeScope(question);

    tasks.push(
      supabaseGet(env, "keuangan", {
        select: "id,periode_awal,periode_akhir,tanggal_publish,data_mode,saldo_awal,total_pemasukan,total_pengeluaran,saldo_akhir",
        status: "eq.publish",
        data_mode: "eq.structured",
        order: "periode_akhir.desc,tanggal_publish.desc",
        limit: "12"
      }).then(data => ({ type: "keuangan_weekly", data }))
    );

    if (scope === "monthly" || financeCategoryHint(question)) {
      tasks.push(
        supabaseGet(env, "keuangan_bulanan", {
          select: "bulan,tahun,bulan_nomor,coverage_start,coverage_end,hari_tercakup,hari_dalam_bulan,coverage_status,saldo_awal,total_pemasukan,total_pengeluaran,arus_kas_bersih,saldo_akhir,jumlah_transaksi",
          order: "bulan.desc",
          limit: "36"
        }).then(data => ({ type: "keuangan_monthly", data }))
      );

      tasks.push(
        supabaseGet(env, "keuangan_kategori_bulanan", {
          select: "bulan,tahun,bulan_nomor,jenis,kategori,total_nominal,jumlah_transaksi",
          order: "bulan.desc,total_nominal.desc",
          limit: "200"
        }).then(data => ({ type: "keuangan_category_monthly", data }))
      );
    }

    if (scope === "yearly") {
      tasks.push(
        supabaseGet(env, "keuangan_tahunan", {
          select: "tahun,coverage_start,coverage_end,hari_tercakup,hari_dalam_tahun,coverage_status,saldo_awal,total_pemasukan,total_pengeluaran,arus_kas_bersih,saldo_akhir,jumlah_transaksi",
          order: "tahun.desc",
          limit: "12"
        }).then(data => ({ type: "keuangan_yearly", data }))
      );

      tasks.push(
        supabaseGet(env, "keuangan_kategori_tahunan", {
          select: "tahun,jenis,kategori,total_nominal,jumlah_transaksi",
          order: "tahun.desc,total_nominal.desc",
          limit: "200"
        }).then(data => ({ type: "keuangan_category_yearly", data }))
      );
    }
  }

  if (intents.includes("media")) {
    tasks.push(
      supabaseGet(env, "media", {
        select: "id,judul,kategori,tanggal",
        status: "eq.publish",
        order: "tanggal.desc",
        limit: "8"
      }).then(data => ({ type: "media", data }))
    );
  }

  if (intents.includes("profile")) {
    tasks.push(
      supabaseGet(env, "profile_pages", {
        select: "slug,judul,ringkasan,content_markdown,urutan",
        status: "eq.publish",
        order: "urutan.asc",
        limit: "10"
      }).then(data => ({ type: "profile", data }))
    );
  }

  return Promise.all(tasks);
}

function sourceLink(intent, chunks) {
  if (intent === "agenda") {
    return { href: "#kajian", label: "Lihat Agenda" };
  }

  if (intent === "media") {
    return { href: "#media", label: "Lihat Media" };
  }

  if (intent === "keuangan") {
    const id = chunks.find(x => x.type === "keuangan_weekly")?.data?.[0]?.id;

    return {
      href: id ? `#keuangan-${id}` : "#keuangan",
      label: "Lihat Keuangan"
    };
  }

  if (intent === "profile") {
    return { href: "profile/sejarah.html", label: "Lihat Profile" };
  }

  return null;
}

function tokenize(question) {
  const stop = new Set([
    "yang","dan","atau","untuk","dengan","dari","pada","apa","siapa","kapan",
    "ada","apakah","mjhk","masjid","jami","harapan","kita","tentang","berapa",
    "terbaru","terdekat","paling","dekat","tolong","jelaskan","ceritakan",
    "agenda","kegiatan","kajian","dakwah","seminar","pelatihan","laporan"
  ]);

  return clean(question)
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ]+/i)
    .filter(x => x.length >= 3 && !stop.has(x));
}

function agendaTypeLabel(value) {
  const key = clean(value).toLowerCase();

  return ({
    kajian: "Kajian",
    seminar: "Seminar",
    pelatihan: "Pelatihan"
  })[key] || clean(value) || "Agenda";
}

function agendaCategoryLabel(value) {
  const key = clean(value).toLowerCase();

  return ({
    kajian: "Kajian",
    kegiatan: "Kegiatan",
    dakwah: "Dakwah"
  })[key] || clean(value) || "Agenda";
}

function agendaSpecificFilter(question, rows) {
  const q = question.toLowerCase();

  if (/\bseminar\b/.test(q)) {
    return rows.filter(x => clean(x.jenis_agenda).toLowerCase() === "seminar");
  }

  if (/\b(pelatihan|training)\b/.test(q)) {
    return rows.filter(x => clean(x.jenis_agenda).toLowerCase() === "pelatihan");
  }

  if (/\bdakwah\b/.test(q)) {
    return rows.filter(x => clean(x.kategori_utama).toLowerCase() === "dakwah");
  }

  if (/\bkegiatan\b/.test(q)) {
    return rows.filter(x => clean(x.kategori_utama).toLowerCase() === "kegiatan");
  }

  if (/\bkajian\b/.test(q)) {
    return rows.filter(x => {
      const fields = [
        x.kategori_utama,
        x.jenis_agenda,
        x.judul,
        x.tema
      ].map(clean).join(" ").toLowerCase();

      return fields.includes("kajian");
    });
  }

  return rows;
}

function cleanAgendaTheme(value) {
  return clean(value)
    .replace(/^(tema|materi)\s*:\s*/i, "")
    .trim();
}

function agendaDescription(x) {
  return [
    `${agendaCategoryLabel(x.kategori_utama)} • ${agendaTypeLabel(x.jenis_agenda)}: ${clean(x.judul || "Agenda MJHK")}.`,
    x.tema ? `Tema/Materi: ${cleanAgendaTheme(x.tema)}.` : "",
    x.penceramah ? `Penceramah/Narasumber: ${clean(x.penceramah).replace(/[.!?]+$/,"")}.` : "",
    x.tanggal ? `Tanggal: ${formatDate(x.tanggal)}.` : "",
    x.waktu ? `Waktu: ${clean(x.waktu)}.` : "",
    x.lokasi ? `Lokasi: ${clean(x.lokasi)}.` : ""
  ].filter(Boolean).join(" ");
}

function answerAgenda(question, rows) {
  if (!rows.length) {
    return "Belum ada agenda mendatang yang dipublikasikan.";
  }

  const q = question.toLowerCase();
  const filtered = agendaSpecificFilter(question, rows);

  if (
    (/\b(paling dekat|terdekat|kapan)\b/.test(q) ||
      /\b(berikutnya|selanjutnya)\b/.test(q)) &&
    filtered.length
  ) {
    return `Agenda terdekat yang sesuai: ${agendaDescription(filtered[0])}`;
  }

  const tokens = tokenize(question);
  const pool = filtered.length ? filtered : rows;

  if (tokens.length) {
    const ranked = pool
      .map(row => {
        const haystack = [
          row.kategori_utama,
          row.jenis_agenda,
          row.jenis_legacy,
          row.judul,
          row.tema,
          row.penceramah,
          row.lokasi,
          row.waktu
        ].map(clean).join(" ").toLowerCase();

        const score = tokens.reduce(
          (total, token) => total + (haystack.includes(token) ? 1 : 0),
          0
        );

        return { row, score };
      })
      .sort((a, b) =>
        b.score - a.score ||
        String(a.row.tanggal).localeCompare(String(b.row.tanggal))
      );

    if (ranked[0]?.score > 0) {
      return `Ya, ada agenda yang sesuai. ${agendaDescription(ranked[0].row)}`;
    }
  }

  if (filtered.length === 1) {
    return agendaDescription(filtered[0]);
  }

  const list = (filtered.length ? filtered : rows).slice(0, 4).map((x, i) => {
    const category = agendaCategoryLabel(x.kategori_utama);
    const type = agendaTypeLabel(x.jenis_agenda);
    const title = clean(x.judul || "Agenda MJHK");
    const date = formatDate(x.tanggal);

    return `${i + 1}. ${category} • ${type} — ${title}${date ? ` — ${date}` : ""}`;
  });

  return `Agenda mendatang yang tersedia:\n${list.join("\n")}`;
}

function coverageNote(row, totalField) {
  if (!row) return "";

  if (row.coverage_status === "complete") {
    return "Cakupan data lengkap.";
  }

  const total = Number(row[totalField] || 0);
  const covered = Number(row.hari_tercakup || 0);

  return `Cakupan data masih parsial (${covered}/${total} hari), yaitu ${formatPeriod(row.coverage_start, row.coverage_end)}.`;
}

function financeFieldAnswer(question, row, scopeLabel) {
  const q = question.toLowerCase();
  const period = scopeLabel;

  if (/\bsaldo awal\b/.test(q)) {
    return row.saldo_awal == null
      ? `Saldo awal ${period} belum tersedia.`
      : `Saldo awal ${period} adalah ${rupiah(row.saldo_awal)}.`;
  }

  if (
    /\b(saldo akhir|saldo kas|saldo sekarang|saldo saat ini|berapa saldo)\b/.test(q)
  ) {
    return row.saldo_akhir == null
      ? `Saldo akhir ${period} belum tersedia.`
      : `Saldo akhir ${period} adalah ${rupiah(row.saldo_akhir)}.`;
  }

  if (/\b(total )?pemasukan\b/.test(q)) {
    return `Total pemasukan ${period} adalah ${rupiah(row.total_pemasukan)}.`;
  }

  if (/\b(total )?pengeluaran\b/.test(q)) {
    return `Total pengeluaran ${period} adalah ${rupiah(row.total_pengeluaran)}.`;
  }

  if (/\b(arus kas|arus bersih|net cash|selisih)\b/.test(q)) {
    const value = row.arus_kas_bersih != null
      ? row.arus_kas_bersih
      : Number(row.total_pemasukan || 0) - Number(row.total_pengeluaran || 0);

    return `Arus kas bersih ${period} adalah ${rupiah(value)}.`;
  }

  return "";
}

function categoryMatchesQuestion(question, rows) {
  const tokens = tokenize(question);

  return rows
    .map(row => {
      const hay = `${clean(row.kategori)} ${clean(row.jenis)}`.toLowerCase();
      let score = 0;

      for (const token of tokens) {
        if (hay.includes(token)) score += 2;
      }

      if (/\binfa?k\b/.test(question.toLowerCase()) && hay.includes("infaq")) score += 5;
      if (/\bsedekah\b/.test(question.toLowerCase()) && hay.includes("sedekah")) score += 5;
      if (/\boperasional\b/.test(question.toLowerCase()) && hay.includes("operasional")) score += 5;

      return { row, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function findMonthlyRow(question, rows) {
  if (!rows.length) return null;

  const month = monthFromQuestion(question);
  const year = yearFromQuestion(question);

  if (month) {
    const targetYear = year || currentJakartaParts().year;

    return rows.find(
      x => Number(x.bulan_nomor) === month && Number(x.tahun) === targetYear
    ) || null;
  }

  if (year) {
    return rows.find(x => Number(x.tahun) === year) || null;
  }

  return rows[0];
}

function findYearlyRow(question, rows) {
  if (!rows.length) return null;

  const year = yearFromQuestion(question) || currentJakartaParts().year;

  return rows.find(x => Number(x.tahun) === year) || rows[0];
}

function answerMonthlyFinance(question, monthlyRows, categoryRows) {
  const row = findMonthlyRow(question, monthlyRows);

  if (!row) {
    return "Rekap keuangan bulanan untuk periode yang ditanyakan belum tersedia.";
  }

  const periodLabel = `${MONTHS[Number(row.bulan_nomor) - 1]} ${row.tahun}`;
  const q = question.toLowerCase();

  const categories = categoryRows.filter(
    x =>
      Number(x.tahun) === Number(row.tahun) &&
      Number(x.bulan_nomor) === Number(row.bulan_nomor)
  );

  if (financeCategoryHint(question) && categories.length) {
    const matches = categoryMatchesQuestion(question, categories);

    if (matches.length) {
      const x = matches[0].row;
      const kind = x.jenis === "pengeluaran" ? "pengeluaran" : "pemasukan";

      return `${clean(x.kategori)} tercatat sebagai ${kind} sebesar ${rupiah(x.total_nominal)} pada ${periodLabel}, dari ${Number(x.jumlah_transaksi || 0)} transaksi. ${coverageNote(row, "hari_dalam_bulan")}`;
    }
  }

  const field = financeFieldAnswer(question, row, periodLabel);

  if (field) {
    return `${field} ${coverageNote(row, "hari_dalam_bulan")}`.trim();
  }

  return [
    `Rekap keuangan ${periodLabel}:`,
    `saldo awal cakupan ${row.saldo_awal == null ? "belum tersedia" : rupiah(row.saldo_awal)},`,
    `pemasukan ${rupiah(row.total_pemasukan)},`,
    `pengeluaran ${rupiah(row.total_pengeluaran)},`,
    `arus kas bersih ${rupiah(row.arus_kas_bersih)},`,
    `dan saldo akhir cakupan ${row.saldo_akhir == null ? "belum tersedia" : rupiah(row.saldo_akhir)}.`,
    coverageNote(row, "hari_dalam_bulan")
  ].join(" ");
}

function answerYearlyFinance(question, yearlyRows, categoryRows) {
  const row = findYearlyRow(question, yearlyRows);

  if (!row) {
    return "Rekap keuangan tahunan untuk tahun yang ditanyakan belum tersedia.";
  }

  const periodLabel = `tahun ${row.tahun}`;

  const categories = categoryRows.filter(
    x => Number(x.tahun) === Number(row.tahun)
  );

  if (financeCategoryHint(question) && categories.length) {
    const matches = categoryMatchesQuestion(question, categories);

    if (matches.length) {
      const x = matches[0].row;
      const kind = x.jenis === "pengeluaran" ? "pengeluaran" : "pemasukan";

      return `${clean(x.kategori)} tercatat sebagai ${kind} sebesar ${rupiah(x.total_nominal)} pada tahun ${row.tahun}, dari ${Number(x.jumlah_transaksi || 0)} transaksi. ${coverageNote(row, "hari_dalam_tahun")}`;
    }
  }

  const field = financeFieldAnswer(question, row, periodLabel);

  if (field) {
    return `${field} ${coverageNote(row, "hari_dalam_tahun")}`.trim();
  }

  return [
    `Rekap keuangan tahun ${row.tahun}:`,
    `saldo awal cakupan ${row.saldo_awal == null ? "belum tersedia" : rupiah(row.saldo_awal)},`,
    `pemasukan ${rupiah(row.total_pemasukan)},`,
    `pengeluaran ${rupiah(row.total_pengeluaran)},`,
    `arus kas bersih ${rupiah(row.arus_kas_bersih)},`,
    `dan saldo akhir cakupan ${row.saldo_akhir == null ? "belum tersedia" : rupiah(row.saldo_akhir)}.`,
    coverageNote(row, "hari_dalam_tahun")
  ].join(" ");
}

function answerWeeklyFinance(question, rows) {
  if (!rows.length) {
    return "Belum ada laporan keuangan structured yang dipublikasikan.";
  }

  const row = rows[0];
  const period = formatPeriod(row.periode_awal, row.periode_akhir);
  const scopeLabel = `periode ${period}`;

  const field = financeFieldAnswer(question, row, scopeLabel);

  if (field) return field;

  return `Laporan keuangan structured terbaru adalah periode ${period}. Saldo awal ${rupiah(row.saldo_awal)}, pemasukan ${rupiah(row.total_pemasukan)}, pengeluaran ${rupiah(row.total_pengeluaran)}, dan saldo akhir ${rupiah(row.saldo_akhir)}.`;
}

function answerKeuangan(question, chunks) {
  const scope = financeScope(question);

  if (scope === "monthly") {
    return answerMonthlyFinance(
      question,
      chunks.find(x => x.type === "keuangan_monthly")?.data || [],
      chunks.find(x => x.type === "keuangan_category_monthly")?.data || []
    );
  }

  if (scope === "yearly") {
    return answerYearlyFinance(
      question,
      chunks.find(x => x.type === "keuangan_yearly")?.data || [],
      chunks.find(x => x.type === "keuangan_category_yearly")?.data || []
    );
  }

  return answerWeeklyFinance(
    question,
    chunks.find(x => x.type === "keuangan_weekly")?.data || []
  );
}

function answerMedia(rows) {
  if (!rows.length) {
    return "Belum ada video yang dipublikasikan.";
  }

  const x = rows[0];

  return [
    `Video terbaru yang tercatat adalah “${clean(x.judul || "Video MJHK")}”.`,
    x.kategori ? `Kategori: ${clean(x.kategori)}.` : "",
    x.tanggal ? `Tanggal data: ${formatDate(x.tanggal)}.` : ""
  ].filter(Boolean).join(" ");
}

function findProfileTarget(question, rows) {
  const q = question.toLowerCase();

  if (/sejarah|perkembangan/.test(q)) {
    return rows.find(x => x.slug === "sejarah");
  }

  if (/visi|misi/.test(q)) {
    return rows.find(x => x.slug === "visi-misi");
  }

  if (/struktur|dkm|pengurus|ketua/.test(q)) {
    return rows.find(x => x.slug === "struktur-dkm");
  }

  if (/program|fasilitas/.test(q)) {
    return rows.find(x => x.slug === "program-fasilitas");
  }

  return null;
}

function findMatchingProfileLine(markdown, question) {
  const q = question.toLowerCase();

  const lines = String(markdown || "")
    .split(/\r?\n/)
    .map(line => markdownToText(line))
    .filter(line => line.length >= 3);

  const priorityWords = [];

  if (q.includes("ketua")) priorityWords.push("ketua");
  if (q.includes("sekretaris")) priorityWords.push("sekretaris");
  if (q.includes("bendahara")) priorityWords.push("bendahara");

  const tokens = tokenize(question);

  const ranked = lines
    .map(line => {
      const low = line.toLowerCase();
      let score = 0;

      for (const word of priorityWords) {
        if (low.includes(word)) score += 5;
      }

      for (const token of tokens) {
        if (low.includes(token)) score += 2;
      }

      return { line, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score >= 2 ? ranked[0].line : "";
}

function answerProfile(question, rows) {
  if (!rows.length) {
    return {
      answer: "Konten profile masjid belum dipublikasikan.",
      confident: true
    };
  }

  const target = findProfileTarget(question, rows);

  if (!target) {
    return {
      answer: `Profile MJHK yang tersedia:\n${rows.map(x => `• ${clean(x.judul)}`).join("\n")}`,
      confident: true
    };
  }

  const q = question.toLowerCase();

  if (/ketua|sekretaris|bendahara|pengurus|struktur/.test(q)) {
    const exact = findMatchingProfileLine(target.content_markdown, question);

    if (exact) {
      return {
        answer: exact,
        confident: true
      };
    }

    return {
      answer: `Informasi yang ditanyakan belum tersedia pada halaman ${clean(target.judul)} yang sudah dipublikasikan.`,
      confident: true
    };
  }

  if (/sejarah|perkembangan/.test(q)) {
    const body = firstSentences(target.content_markdown, 3, 520);

    return {
      answer:
        body ||
        clean(target.ringkasan) ||
        `Silakan buka halaman ${clean(target.judul)}.`,
      confident: true
    };
  }

  if (/visi|misi|program|fasilitas/.test(q)) {
    const body = firstSentences(target.content_markdown, 4, 620);

    return {
      answer:
        body ||
        clean(target.ringkasan) ||
        `Silakan buka halaman ${clean(target.judul)}.`,
      confident: true
    };
  }

  return {
    answer: "",
    confident: false,
    target
  };
}

function sanitizeAIAnswer(value) {
  let text = typeof value === "string" ? value : "";

  text = text
    .replace(/^JAWABAN\s*:\s*/i, "")
    .split(/\n\s*---+\s*\n/)[0]
    .split(/Anda adalah Tanya MJHK/i)[0]
    .split(/DATA RESMI\s*:/i)[0]
    .split(/PERTANYAAN JAMAAH\s*:/i)[0]
    .split(/Berikut adalah contoh/i)[0]
    .split(/Jika Anda ingin/i)[0]
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return "Informasi tersebut belum tersedia di Tanya MJHK.";
  }

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const unique = [];
  const seen = new Set();

  for (const sentence of sentences) {
    const normalized = clean(sentence).toLowerCase();

    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    unique.push(clean(sentence));

    if (unique.join(" ").length >= 650) break;
  }

  return unique.join(" ").slice(0, 700).trim();
}

async function generateProfileFallback(env, question, target, rateKey) {
  await enforceRateLimit(env.AI_RATE_LIMITER, `ai:${rateKey}`);

  const context = JSON.stringify({
    judul: target?.judul || "",
    ringkasan: target?.ringkasan || "",
    content_markdown: String(target?.content_markdown || "").slice(
      0,
      MAX_AI_CONTEXT
    )
  });

  const result = await env.AI.run(env.AI_MODEL || DEFAULT_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "Anda adalah Tanya MJHK. Jawab HANYA berdasarkan data profile MJHK yang diberikan. " +
          "Jawaban harus satu paragraf, singkat, maksimal 90 kata, tanpa label JAWABAN, tanpa link, " +
          "tanpa mengulang instruksi, tanpa membuat pertanyaan baru, dan tanpa menambah fakta dari luar data. " +
          "Jika data tidak cukup, jawab: Informasi tersebut belum tersedia di Tanya MJHK."
      },
      {
        role: "user",
        content: `DATA PROFILE MJHK:\n${context}\n\nPERTANYAAN:\n${question}`
      }
    ],
    max_tokens: 140,
    temperature: 0
  });

  const raw =
    (typeof result?.response === "string" && result.response) ||
    (typeof result?.result?.response === "string" &&
      result.result.response) ||
    "";

  return sanitizeAIAnswer(raw);
}

async function answerByIntent(env, question, intents, chunks, rateKey) {
  if (intents.length !== 1) {
    return {
      answer:
        "Silakan tanyakan satu topik MJHK dalam satu pertanyaan agar jawabannya lebih tepat, misalnya agenda, profile, media, atau keuangan.",
      link: null
    };
  }

  const intent = intents[0];

  if (intent === "agenda") {
    return {
      answer: answerAgenda(
        question,
        chunks.find(x => x.type === "agenda")?.data || []
      ),
      link: sourceLink(intent, chunks)
    };
  }

  if (intent === "keuangan") {
    return {
      answer: answerKeuangan(question, chunks),
      link: sourceLink(intent, chunks)
    };
  }

  if (intent === "media") {
    return {
      answer: answerMedia(
        chunks.find(x => x.type === "media")?.data || []
      ),
      link: sourceLink(intent, chunks)
    };
  }

  if (intent === "profile") {
    const direct = answerProfile(
      question,
      chunks.find(x => x.type === "profile")?.data || []
    );

    if (direct.confident) {
      return {
        answer: direct.answer,
        link: sourceLink(intent, chunks)
      };
    }

    return {
      answer: await generateProfileFallback(
        env,
        question,
        direct.target,
        rateKey
      ),
      link: sourceLink(intent, chunks)
    };
  }

  return {
    answer: "Informasi tersebut belum tersedia di Tanya MJHK.",
    link: null
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originHeader = request.headers.get("Origin") || "";
    const origin = allowedOrigin(request, env);
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      if (!originHeader || !origin) {
        return json({ error: "Origin tidak diizinkan." }, 403);
      }

      return new Response(null, {
        status: 204,
        headers: {
          ...securityHeaders(),
          ...cors
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          ok: true,
          service: "tanya-mjhk",
          status: "active",
          version: "1.3.1"
        },
        200,
        cors
      );
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(
        {
          ok: true,
          service: "tanya-mjhk",
          version: "1.3.1",
          capabilities: ["agenda-structured", "keuangan-structured"]
        },
        200,
        cors
      );
    }

    if (request.method !== "POST" || url.pathname !== "/ask") {
      return json({ error: "Not found" }, 404, cors);
    }

    if (originHeader && !origin) {
      return json({ error: "Origin tidak diizinkan." }, 403);
    }

    if (!isJsonContentType(request)) {
      return json(
        { error: "Content-Type harus application/json." },
        415,
        cors
      );
    }

    const rateKey = clientRateKey(request, origin);

    try {
      await enforceRateLimit(env.ASK_RATE_LIMITER, `ask:${rateKey}`);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return json(
          {
            error:
              "Terlalu banyak pertanyaan. Silakan coba lagi sebentar."
          },
          429,
          { ...cors, "Retry-After": "60" }
        );
      }

      console.error("ASK rate limiter error:", error?.message || error);

      return json(
        {
          error:
            "Layanan Tanya MJHK belum dapat digunakan saat ini."
        },
        503,
        cors
      );
    }

    let body;

    try {
      body = await readJsonBodyLimited(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return json(
          {
            error:
              `Request body maksimal ${MAX_BODY_BYTES} byte.`
          },
          413,
          cors
        );
      }

      return json({ error: "Body JSON tidak valid." }, 400, cors);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.question !== "string"
    ) {
      return json(
        { error: "Field question wajib berupa teks." },
        400,
        cors
      );
    }

    const question = clean(body.question);

    if (!question) {
      return json({ error: "Pertanyaan kosong." }, 400, cors);
    }

    if (question.length > MAX_QUESTION) {
      return json(
        {
          error:
            `Pertanyaan maksimal ${MAX_QUESTION} karakter.`
        },
        400,
        cors
      );
    }

    const intents = classify(question);

    if (intents.includes("greeting")) {
      return json(
        {
          answer:
            "Wa'alaikumussalam. Silakan tanyakan agenda Kegiatan, Kajian & Dakwah, seminar, pelatihan, profile masjid, media YouTube, atau laporan keuangan MJHK termasuk nominal yang sudah terstruktur."
        },
        200,
        cors
      );
    }

    if (!intents.length) {
      return json(
        {
          answer:
            "Maaf, Tanya MJHK hanya memberikan informasi resmi Masjid Jami' Harapan Kita. Coba tanyakan tentang agenda, seminar, pelatihan, kajian, dakwah, profile masjid, media, atau laporan keuangan."
        },
        200,
        cors
      );
    }

    try {
      const chunks = await retrieveContext(env, intents, question);

      const result = await answerByIntent(
        env,
        question,
        intents,
        chunks,
        rateKey
      );

      return json(result, 200, cors);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return json(
          {
            error:
              "Batas penggunaan AI sementara tercapai. Silakan coba lagi dalam satu menit."
          },
          429,
          { ...cors, "Retry-After": "60" }
        );
      }

      console.error(
        "Tanya MJHK request failed:",
        error?.name || "Error",
        error?.message || "Unknown error"
      );

      return json(
        {
          error:
            "Informasi MJHK belum dapat diproses saat ini."
        },
        500,
        cors
      );
    }
  }
};
