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

  if (!request.body) {
    return {};
  }

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

function classify(question) {
  const q = question.toLowerCase();
  const intents = [];

  if (/(kajian|ustadz|ustad|penceramah|tafsir|bidayatul|sirah|fiqih|fiqh|al-azkar|mawarits|maulid)/.test(q)) {
    intents.push("kajian");
  }

  if (/(keuangan|kas|saldo|pemasukan|pengeluaran|laporan|infak|infaq|sedekah)/.test(q)) {
    intents.push("keuangan");
  }

  if (/(youtube|video|media|rekaman|tonton|stream)/.test(q)) {
    intents.push("media");
  }

  if (/(sejarah|visi|misi|profile|profil|dkm|pengurus|ketua|struktur|program|fasilitas|masjid)/.test(q)) {
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

function formatDate(value) {
  if (!value) return "";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
}

function formatPeriod(a, b) {
  if (!a || !b) return "";

  const A = new Date(`${a}T00:00:00+07:00`);
  const B = new Date(`${b}T00:00:00+07:00`);

  if (Number.isNaN(A.getTime()) || Number.isNaN(B.getTime())) return "";

  if (
    A.getFullYear() === B.getFullYear() &&
    A.getMonth() === B.getMonth()
  ) {
    const monthYear = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      month: "long",
      year: "numeric"
    }).format(B);

    return `${A.getDate()}–${B.getDate()} ${monthYear}`;
  }

  return `${formatDate(a)} – ${formatDate(b)}`;
}

async function retrieveContext(env, intents) {
  const tasks = [];

  if (intents.includes("kajian")) {
    tasks.push(
      supabaseGet(env, "kajian", {
        select: "id,jenis,judul,tema,penceramah,tanggal,waktu",
        status: "eq.publish",
        tanggal: `gte.${todayISOJakarta()}`,
        order: "tanggal.asc",
        limit: "12"
      }).then(data => ({ type: "kajian", data }))
    );
  }

  if (intents.includes("keuangan")) {
    tasks.push(
      supabaseGet(env, "keuangan", {
        select: "id,periode_awal,periode_akhir,tanggal_publish",
        status: "eq.publish",
        order: "periode_akhir.desc,tanggal_publish.desc",
        limit: "5"
      }).then(data => ({ type: "keuangan", data }))
    );
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
  if (intent === "kajian") {
    return { href: "#kajian", label: "Lihat Kajian" };
  }

  if (intent === "media") {
    return { href: "#media", label: "Lihat Media" };
  }

  if (intent === "keuangan") {
    const id = chunks.find(x => x.type === "keuangan")?.data?.[0]?.id;
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
    "terbaru","terdekat","paling","dekat","tolong","jelaskan","ceritakan"
  ]);

  return clean(question)
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ]+/i)
    .filter(x => x.length >= 4 && !stop.has(x));
}

function answerKajian(question, rows) {
  if (!rows.length) {
    return "Belum ada agenda kajian mendatang yang dipublikasikan.";
  }

  const q = question.toLowerCase();

  if (/(paling dekat|terdekat|kapan.*dekat|kajian.*dekat)/.test(q)) {
    const x = rows[0];
    return [
      `Kajian paling dekat adalah ${clean(x.judul || x.jenis || "kajian")}.`,
      x.penceramah ? `Penceramah: ${clean(x.penceramah)}.` : "",
      x.tanggal ? `Tanggal: ${formatDate(x.tanggal)}.` : "",
      x.waktu ? `Waktu: ${clean(x.waktu)}.` : ""
    ].filter(Boolean).join(" ");
  }

  const tokens = tokenize(question);

  if (tokens.length) {
    const ranked = rows
      .map(row => {
        const haystack = [
          row.jenis,
          row.judul,
          row.tema,
          row.penceramah,
          row.waktu
        ].map(clean).join(" ").toLowerCase();

        const score = tokens.reduce(
          (total, token) => total + (haystack.includes(token) ? 1 : 0),
          0
        );

        return { row, score };
      })
      .sort((a, b) => b.score - a.score);

    if (ranked[0]?.score > 0) {
      const x = ranked[0].row;
      return [
        `Ya, ada ${clean(x.judul || x.jenis || "kajian")} yang sesuai.`,
        x.tema ? `Tema: ${clean(x.tema)}.` : "",
        x.penceramah ? `Penceramah: ${clean(x.penceramah)}.` : "",
        x.tanggal ? `Tanggal: ${formatDate(x.tanggal)}.` : "",
        x.waktu ? `Waktu: ${clean(x.waktu)}.` : ""
      ].filter(Boolean).join(" ");
    }
  }

  const list = rows.slice(0, 3).map((x, i) => {
    const name = clean(x.judul || x.jenis || "Kajian");
    const date = formatDate(x.tanggal);
    const speaker = clean(x.penceramah);
    return `${i + 1}. ${name}${date ? ` — ${date}` : ""}${speaker ? ` — ${speaker}` : ""}`;
  });

  return `Agenda kajian terdekat yang tersedia:\n${list.join("\n")}`;
}

function answerKeuangan(question, rows) {
  if (!rows.length) {
    return "Belum ada laporan keuangan yang dipublikasikan.";
  }

  const latest = rows[0];
  const period = formatPeriod(latest.periode_awal, latest.periode_akhir);
  const q = question.toLowerCase();

  if (/(saldo|pemasukan|pengeluaran|jumlah uang|berapa.*kas|berapa.*keuangan)/.test(q)) {
    return `Nominal saldo, pemasukan, dan pengeluaran belum disimpan sebagai angka terstruktur di Tanya MJHK. Laporan terbaru tersedia untuk periode ${period}. Silakan buka laporan resminya untuk melihat nominal.`;
  }

  return `Laporan keuangan terbaru yang tersedia adalah periode ${period}.`;
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
      answer: body || clean(target.ringkasan) || `Silakan buka halaman ${clean(target.judul)}.`,
      confident: true
    };
  }

  if (/visi|misi|program|fasilitas/.test(q)) {
    const body = firstSentences(target.content_markdown, 4, 620);
    return {
      answer: body || clean(target.ringkasan) || `Silakan buka halaman ${clean(target.judul)}.`,
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

  if (!text) return "Informasi tersebut belum tersedia di Tanya MJHK.";

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
    content_markdown: String(target?.content_markdown || "").slice(0, MAX_AI_CONTEXT)
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
    (typeof result?.result?.response === "string" && result.result.response) ||
    "";

  return sanitizeAIAnswer(raw);
}

async function answerByIntent(env, question, intents, chunks, rateKey) {
  if (intents.length !== 1) {
    return {
      answer:
        "Silakan tanyakan satu topik MJHK dalam satu pertanyaan agar jawabannya lebih tepat, misalnya kajian, profile, media, atau keuangan.",
      link: null
    };
  }

  const intent = intents[0];
  const data = chunks.find(x => x.type === intent)?.data || [];

  if (intent === "kajian") {
    return {
      answer: answerKajian(question, data),
      link: sourceLink(intent, chunks)
    };
  }

  if (intent === "keuangan") {
    return {
      answer: answerKeuangan(question, data),
      link: sourceLink(intent, chunks)
    };
  }

  if (intent === "media") {
    return {
      answer: answerMedia(data),
      link: sourceLink(intent, chunks)
    };
  }

  if (intent === "profile") {
    const direct = answerProfile(question, data);

    if (direct.confident) {
      return {
        answer: direct.answer,
        link: sourceLink(intent, chunks)
      };
    }

    return {
      answer: await generateProfileFallback(env, question, direct.target, rateKey),
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
        { ok: true, service: "tanya-mjhk", status: "active" },
        200,
        cors
      );
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(
        { ok: true, service: "tanya-mjhk", version: "1.2" },
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
          { error: "Terlalu banyak pertanyaan. Silakan coba lagi sebentar." },
          429,
          { ...cors, "Retry-After": "60" }
        );
      }

      console.error("ASK rate limiter error:", error?.message || error);
      return json(
        { error: "Layanan Tanya MJHK belum dapat digunakan saat ini." },
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
          { error: `Request body maksimal ${MAX_BODY_BYTES} byte.` },
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
        { error: `Pertanyaan maksimal ${MAX_QUESTION} karakter.` },
        400,
        cors
      );
    }

    const intents = classify(question);

    if (intents.includes("greeting")) {
      return json(
        {
          answer:
            "Wa'alaikumussalam. Silakan tanyakan informasi tentang kajian, profile masjid, media YouTube, atau laporan keuangan MJHK."
        },
        200,
        cors
      );
    }

    if (!intents.length) {
      return json(
        {
          answer:
            "Maaf, Tanya MJHK hanya memberikan informasi yang tersedia mengenai Masjid Jami' Harapan Kita. Coba tanyakan tentang kajian, profile masjid, media, atau laporan keuangan."
        },
        200,
        cors
      );
    }

    try {
      const chunks = await retrieveContext(env, intents);
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
        { error: "Informasi MJHK belum dapat diproses saat ini." },
        500,
        cors
      );
    }
  }
};
