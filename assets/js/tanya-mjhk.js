(() => {
  "use strict";

  const cfg = Object.assign(
    {
      apiUrl: "",
      useLocalFallback: true,
      maxQuestionLength: 300
    },
    window.MJHK_TANYA_CONFIG || {}
  );

  const db = window.mjhkSupabase;
  const $ = (s, root = document) => root.querySelector(s);

  const MONTHS = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];

  const MONTH_MAP = {
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

  const clean = value =>
    String(value ?? "").replace(/\s+/g, " ").trim();

  function stripMarkdown(value) {
    return String(value ?? "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#>*_`~|-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatDate(value) {
    if (!value) return "";

    const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    return Number.isNaN(d.getTime())
      ? ""
      : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatPeriod(a, b) {
    if (!a || !b) return "";

    const A = new Date(`${a}T00:00:00`);
    const B = new Date(`${b}T00:00:00`);

    if (Number.isNaN(A.getTime()) || Number.isNaN(B.getTime())) {
      return "";
    }

    if (
      A.getFullYear() === B.getFullYear() &&
      A.getMonth() === B.getMonth()
    ) {
      return `${A.getDate()}–${B.getDate()} ${MONTHS[B.getMonth()]} ${B.getFullYear()}`;
    }

    return `${formatDate(a)} – ${formatDate(b)}`;
  }

  function rupiah(value) {
    return `Rp ${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0
    }).format(Number(value || 0))}`;
  }


  function extractGreeting(question) {
    const input = clean(question);

    const pattern =
      /^\s*(assalamualaikum(?:\s+warahmatullahi(?:\s+wabarakatuh)?)?|assalamu\s*['’]?\s*alaikum(?:\s+warahmatullahi(?:\s+wabarakatuh)?)?|assalam|salam|halo|hai|hello|selamat\s+(?:pagi|siang|sore|malam)|pagi|siang|sore|malam)\b[\s,!.;:?\-]*/i;

    const match = input.match(pattern);

    if (!match) {
      return {
        matched: false,
        rest: input,
        reply: ""
      };
    }

    const greeting = clean(match[1]).toLowerCase();
    const rest = clean(input.slice(match[0].length));

    const islamic =
      greeting.startsWith("assalam") ||
      greeting === "salam";

    let reply = "Halo.";

    if (islamic) {
      reply = "Wa'alaikumussalam warahmatullahi wabarakatuh.";
    } else if (greeting.includes("pagi")) {
      reply = "Selamat pagi.";
    } else if (greeting.includes("siang")) {
      reply = "Selamat siang.";
    } else if (greeting.includes("sore")) {
      reply = "Selamat sore.";
    } else if (greeting.includes("malam")) {
      reply = "Selamat malam.";
    }

    return {
      matched: true,
      rest,
      reply
    };
  }

  function greetingOnlyAnswer(greeting) {
    return `${greeting.reply} Ada yang bisa saya bantu terkait informasi Masjid Jami' Harapan Kita?`;
  }

  function withGreeting(result, greeting) {
    if (!greeting.matched) return result;

    return Object.assign({}, result, {
      answer: `${greeting.reply} ${result.answer || ""}`.trim()
    });
  }

  function classify(question) {
    const q = question.toLowerCase();


    if (
      /(agenda|kegiatan|kajian|dakwah|seminar|pelatihan|training|ustadz|ustad|penceramah|narasumber|tafsir|bidayatul|sirah|fiqih|fiqh|al-azkar|mawarits|maulid)/.test(q)
    ) {
      return "agenda";
    }

    if (
      /(keuangan|kas|saldo|pemasukan|pengeluaran|arus kas|laporan|infak|infaq|sedekah|donatur|operasional|kafalah)/.test(q)
    ) {
      return "keuangan";
    }

    if (/(youtube|video|media|rekaman|tonton|stream)/.test(q)) {
      return "media";
    }

    if (
      /(sejarah|visi|misi|profile|profil|dkm|pengurus|ketua|struktur|program|fasilitas)/.test(q)
    ) {
      return "profile";
    }

    return "unknown";
  }

  function injectUI() {
    if ($("#tanyaMjhkPanel")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="tanya-mjhk-launcher" id="tanyaMjhkLauncher" aria-controls="tanyaMjhkPanel" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4v-4.5A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Zm2 4v2h12V8H6Zm0 4v2h8v-2H6Z"/></svg>
        <span>Tanya MJHK</span>
      </button>

      <section class="tanya-mjhk-panel" id="tanyaMjhkPanel" aria-label="Tanya MJHK">
        <div class="tanya-mjhk-head">
          <div>
            <strong>Tanya MJHK</strong>
            <span>Informasi resmi Masjid Jami' Harapan Kita</span>
          </div>
          <button type="button" class="tanya-mjhk-close" id="tanyaMjhkClose" aria-label="Tutup">×</button>
        </div>

        <div class="tanya-mjhk-body" id="tanyaMjhkBody">
          <div class="tanya-mjhk-message bot">
            Assalamu'alaikum. Saya dapat membantu mencari informasi agenda Kegiatan, Kajian & Dakwah, seminar, pelatihan, profile masjid, media, serta laporan keuangan MJHK termasuk nominal yang sudah terstruktur.
          </div>

          <div class="tanya-mjhk-suggestions">
            <button type="button" class="tanya-mjhk-chip" data-q="Agenda terdekat apa?">Agenda terdekat</button>
            <button type="button" class="tanya-mjhk-chip" data-q="Ada seminar terdekat?">Seminar</button>
            <button type="button" class="tanya-mjhk-chip" data-q="Ada pelatihan terdekat?">Pelatihan</button>
            <button type="button" class="tanya-mjhk-chip" data-q="Berapa saldo kas MJHK saat ini?">Saldo kas</button>
            <button type="button" class="tanya-mjhk-chip" data-q="Bagaimana keuangan bulan ini?">Keuangan bulanan</button>
            <button type="button" class="tanya-mjhk-chip" data-q="Video terbaru MJHK">Video terbaru</button>
          </div>
        </div>

        <div class="tanya-mjhk-foot">
          <form class="tanya-mjhk-form" id="tanyaMjhkForm">
            <input class="tanya-mjhk-input" id="tanyaMjhkInput" type="text" maxlength="${Number(cfg.maxQuestionLength) || 300}" autocomplete="off" placeholder="Tulis pertanyaan tentang MJHK..." aria-label="Pertanyaan">
            <button class="tanya-mjhk-send" id="tanyaMjhkSend" type="submit">Kirim</button>
          </form>
          <p class="tanya-mjhk-note">
            Jawaban dibatasi pada informasi MJHK yang tersedia dan dipublikasikan.
          </p>
        </div>
      </section>`
    );
  }

  function addMessage(role, text, link) {
    const body = $("#tanyaMjhkBody");
    if (!body) return null;

    const el = document.createElement("div");
    el.className = `tanya-mjhk-message ${role}`;
    el.textContent = text;

    if (link?.href && link?.label) {
      const a = document.createElement("a");
      a.className = "tanya-mjhk-link";
      a.href = link.href;
      a.textContent = link.label;
      el.appendChild(document.createElement("br"));
      el.appendChild(a);
    }

    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function setBusy(busy) {
    const input = $("#tanyaMjhkInput");
    const send = $("#tanyaMjhkSend");

    if (input) input.disabled = busy;
    if (send) send.disabled = busy;
  }

  function profileLink(slug) {
    return ({
      sejarah: "profile/sejarah.html",
      "visi-misi": "profile/visi-misi.html",
      "struktur-dkm": "profile/struktur-dkm.html",
      "program-fasilitas": "profile/program-fasilitas.html"
    })[slug] || "#profile";
  }

  function findUsefulProfileLine(markdown, question) {
    const lines = String(markdown || "")
      .split(/\r?\n/)
      .map(stripMarkdown)
      .filter(x => x.length >= 4);

    const tokens = clean(question)
      .toLowerCase()
      .split(/[^a-z0-9à-ÿ]+/i)
      .filter(
        x =>
          x.length >= 4 &&
          !["siapa","apakah","adalah","yang","dari","untuk","masjid","mjhk"].includes(x)
      );

    let best = "";
    let score = 0;

    for (const line of lines) {
      const low = line.toLowerCase();
      let current = 0;

      for (const token of tokens) {
        if (low.includes(token)) current += 2;
      }

      if (
        /\bketua\b/.test(question.toLowerCase()) &&
        low.includes("ketua")
      ) {
        current += 4;
      }

      if (current > score) {
        score = current;
        best = line;
      }
    }

    return score >= 2 ? best.slice(0, 280) : "";
  }

  async function localAgenda(question) {
    if (!db) throw new Error("Supabase client tidak tersedia.");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = today.toISOString().slice(0, 10);

    const { data, error } = await db
      .from("agenda_publik")
      .select("id,kategori_utama,jenis_agenda,judul,tema,penceramah,lokasi,tanggal,waktu")
      .gte("tanggal", iso)
      .order("tanggal", { ascending: true })
      .limit(30);

    if (error) throw error;

    let rows = data || [];

    const q = question.toLowerCase();

    if (/\bseminar\b/.test(q)) {
      rows = rows.filter(x => x.jenis_agenda === "seminar");
    } else if (/\b(pelatihan|training)\b/.test(q)) {
      rows = rows.filter(x => x.jenis_agenda === "pelatihan");
    } else if (/\bdakwah\b/.test(q)) {
      rows = rows.filter(x => x.kategori_utama === "dakwah");
    } else if (/\bkegiatan\b/.test(q)) {
      rows = rows.filter(x => x.kategori_utama === "kegiatan");
    }

    if (!rows.length) {
      return {
        answer: "Belum ada agenda mendatang yang sesuai dan sudah dipublikasikan.",
        link: { href: "#kajian", label: "Lihat Agenda" }
      };
    }

    const row = rows[0];

    return {
      answer: [
        `${clean(row.judul || "Agenda MJHK")}.`,
        row.tema ? `Tema: ${clean(row.tema)}.` : "",
        row.penceramah ? `Penceramah/Narasumber: ${clean(row.penceramah)}.` : "",
        row.tanggal ? `Tanggal: ${formatDate(row.tanggal)}.` : "",
        row.waktu ? `Waktu: ${clean(row.waktu)}.` : "",
        row.lokasi ? `Lokasi: ${clean(row.lokasi)}.` : ""
      ].filter(Boolean).join(" "),
      link: { href: "#kajian", label: "Lihat Agenda" }
    };
  }

  function monthFromQuestion(question) {
    const q = question.toLowerCase();

    for (const [name, month] of Object.entries(MONTH_MAP)) {
      if (new RegExp(`\\b${name}\\b`, "i").test(q)) return month;
    }

    if (/\bbulan ini\b/.test(q)) return new Date().getMonth() + 1;
    return null;
  }

  function yearFromQuestion(question) {
    const match = question.match(/\b(20\d{2})\b/);
    return match ? Number(match[1]) : new Date().getFullYear();
  }

  async function localKeuangan(question) {
    if (!db) throw new Error("Supabase client tidak tersedia.");

    const q = question.toLowerCase();
    const month = monthFromQuestion(question);

    if (month || /\b(bulanan|bulan ini|per bulan)\b/.test(q)) {
      const year = yearFromQuestion(question);

      const { data, error } = await db
        .from("keuangan_bulanan")
        .select("*")
        .eq("tahun", year)
        .eq("bulan_nomor", month || new Date().getMonth() + 1)
        .limit(1);

      if (error) throw error;

      const row = (data || [])[0];

      if (!row) {
        return {
          answer: "Rekap keuangan bulanan untuk periode tersebut belum tersedia.",
          link: { href: "#keuangan", label: "Lihat Keuangan" }
        };
      }

      const label = `${MONTHS[Number(row.bulan_nomor) - 1]} ${row.tahun}`;

      return {
        answer:
          `Rekap keuangan ${label}: saldo awal cakupan ${row.saldo_awal == null ? "belum tersedia" : rupiah(row.saldo_awal)}, pemasukan ${rupiah(row.total_pemasukan)}, pengeluaran ${rupiah(row.total_pengeluaran)}, arus kas bersih ${rupiah(row.arus_kas_bersih)}, dan saldo akhir cakupan ${row.saldo_akhir == null ? "belum tersedia" : rupiah(row.saldo_akhir)}.`,
        link: { href: "#keuangan", label: "Lihat Keuangan" }
      };
    }

    const { data, error } = await db
      .from("keuangan")
      .select("id,periode_awal,periode_akhir,saldo_awal,total_pemasukan,total_pengeluaran,saldo_akhir,status,data_mode")
      .eq("status", "publish")
      .eq("data_mode", "structured")
      .order("periode_akhir", { ascending: false })
      .limit(1);

    if (error) throw error;

    const row = (data || [])[0];

    if (!row) {
      return {
        answer: "Belum ada laporan keuangan structured yang dipublikasikan.",
        link: { href: "#keuangan", label: "Lihat Keuangan" }
      };
    }

    const period = formatPeriod(row.periode_awal, row.periode_akhir);

    if (/\bsaldo\b/.test(q)) {
      return {
        answer: `Saldo kas berdasarkan laporan structured terbaru periode ${period} adalah ${rupiah(row.saldo_akhir)}.`,
        link: { href: `#keuangan-${row.id}`, label: "Lihat Keuangan" }
      };
    }

    return {
      answer:
        `Laporan structured terbaru periode ${period}: saldo awal ${rupiah(row.saldo_awal)}, pemasukan ${rupiah(row.total_pemasukan)}, pengeluaran ${rupiah(row.total_pengeluaran)}, dan saldo akhir ${rupiah(row.saldo_akhir)}.`,
      link: { href: `#keuangan-${row.id}`, label: "Lihat Keuangan" }
    };
  }

  async function localMedia() {
    if (!db) throw new Error("Supabase client tidak tersedia.");

    const { data, error } = await db
      .from("media")
      .select("id,judul,kategori,tanggal,youtube_url,youtube_id,status")
      .eq("status", "publish")
      .order("tanggal", { ascending: false })
      .limit(1);

    if (error) throw error;

    const row = (data || [])[0];

    if (!row) {
      return {
        answer: "Belum ada video yang dipublikasikan.",
        link: { href: "#media", label: "Lihat Media" }
      };
    }

    return {
      answer:
        `Video terbaru yang tersedia: ${clean(row.judul || "Video MJHK")}${row.kategori ? ` (${clean(row.kategori)})` : ""}${row.tanggal ? `, untuk tanggal ${formatDate(row.tanggal)}` : ""}.`,
      link: { href: "#media", label: "Buka Media" }
    };
  }

  async function localProfile(question) {
    if (!db) throw new Error("Supabase client tidak tersedia.");

    const { data, error } = await db
      .from("profile_pages")
      .select("slug,judul,ringkasan,content_markdown,status,urutan")
      .eq("status", "publish")
      .order("urutan", { ascending: true });

    if (error) throw error;

    const rows = data || [];

    if (!rows.length) {
      return {
        answer: "Konten profile masjid belum dipublikasikan.",
        link: { href: "#profile", label: "Lihat Profile" }
      };
    }

    const q = question.toLowerCase();
    let target = null;

    if (/sejarah|perkembangan/.test(q)) {
      target = rows.find(x => x.slug === "sejarah");
    } else if (/visi|misi/.test(q)) {
      target = rows.find(x => x.slug === "visi-misi");
    } else if (/struktur|dkm|pengurus|ketua/.test(q)) {
      target = rows.find(x => x.slug === "struktur-dkm");
    } else if (/program|fasilitas/.test(q)) {
      target = rows.find(x => x.slug === "program-fasilitas");
    }

    if (target) {
      const exact = findUsefulProfileLine(
        target.content_markdown,
        question
      );

      const fallback =
        clean(target.ringkasan) ||
        stripMarkdown(target.content_markdown).slice(0, 260);

      return {
        answer:
          exact ||
          fallback ||
          `Informasi tersedia pada halaman ${clean(target.judul)}.`,
        link: {
          href: profileLink(target.slug),
          label: `Buka ${clean(target.judul)}`
        }
      };
    }

    return {
      answer:
        `Profile MJHK yang tersedia:\n${rows.map(x => `• ${clean(x.judul)}`).join("\n")}`,
      link: {
        href: "profile/sejarah.html",
        label: "Buka Profile"
      }
    };
  }

  async function localFallback(question) {
    const greeting = extractGreeting(question);
    const intentQuestion = greeting.matched ? greeting.rest : question;

    if (greeting.matched && !intentQuestion) {
      return {
        answer: greetingOnlyAnswer(greeting)
      };
    }

    const intent = classify(intentQuestion);
    let result;

    if (intent === "agenda") {
      result = await localAgenda(intentQuestion);
    } else if (intent === "keuangan") {
      result = await localKeuangan(intentQuestion);
    } else if (intent === "media") {
      result = await localMedia();
    } else if (intent === "profile") {
      result = await localProfile(intentQuestion);
    } else {
      result = {
        answer:
          "Maaf, Tanya MJHK hanya memberikan informasi resmi Masjid Jami' Harapan Kita. Coba tanyakan tentang agenda, seminar, pelatihan, kajian, dakwah, profile masjid, media, atau laporan keuangan."
      };
    }

    return withGreeting(result, greeting);
  }

  async function askApi(question) {
    const url = clean(cfg.apiUrl);

    if (!url) throw new Error("API belum dikonfigurasi.");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async function submitQuestion(question) {
    const q = clean(question);

    if (!q) return;

    if (q.length > cfg.maxQuestionLength) {
      addMessage(
        "bot",
        `Pertanyaan maksimal ${cfg.maxQuestionLength} karakter.`
      );
      return;
    }

    addMessage("user", q);

    const loading = addMessage(
      "bot",
      "Sedang mencari informasi MJHK..."
    );

    loading?.classList.add("is-loading");
    setBusy(true);

    try {
      let result;

      if (clean(cfg.apiUrl)) {
        try {
          result = await askApi(q);
        } catch (error) {
          console.warn("Tanya MJHK API:", error);

          if (!cfg.useLocalFallback) throw error;

          result = await localFallback(q);
        }
      } else {
        result = await localFallback(q);
      }

      loading?.remove();

      addMessage(
        "bot",
        result.answer || "Informasi belum tersedia.",
        result.link
      );
    } catch (error) {
      console.error("Tanya MJHK:", error);
      loading?.remove();

      addMessage(
        "bot",
        "Maaf, informasi belum dapat diambil saat ini. Silakan coba kembali."
      );
    } finally {
      setBusy(false);
      $("#tanyaMjhkInput")?.focus();
    }
  }

  function bind() {
    const panel = $("#tanyaMjhkPanel");
    const launcher = $("#tanyaMjhkLauncher");
    const input = $("#tanyaMjhkInput");

    launcher?.addEventListener("click", () => {
      const open = !panel?.classList.contains("open");
      panel?.classList.toggle("open", open);
      launcher.setAttribute("aria-expanded", String(open));

      if (open) {
        setTimeout(() => input?.focus(), 50);
      }
    });

    $("#tanyaMjhkClose")?.addEventListener("click", () => {
      panel?.classList.remove("open");
      launcher?.setAttribute("aria-expanded", "false");
    });

    $("#tanyaMjhkForm")?.addEventListener("submit", event => {
      event.preventDefault();

      const q = input?.value || "";

      if (input) input.value = "";
      submitQuestion(q);
    });

    document.addEventListener("click", event => {
      const chip = event.target.closest?.(".tanya-mjhk-chip");

      if (chip) {
        submitQuestion(
          chip.dataset.q || chip.textContent || ""
        );
      }
    });

    document.addEventListener("keydown", event => {
      if (
        event.key === "Escape" &&
        panel?.classList.contains("open")
      ) {
        panel.classList.remove("open");
        launcher?.setAttribute("aria-expanded", "false");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectUI();
    bind();
  });
})();
