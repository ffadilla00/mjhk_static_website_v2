(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const db = window.mjhkSupabase;

  const CATEGORY_LABELS = {
    kegiatan: "Kegiatan",
    kajian: "Kajian",
    dakwah: "Dakwah"
  };

  const TYPE_LABELS = {
    seminar: "Seminar",
    kajian: "Kajian",
    pelatihan: "Pelatihan"
  };

  let allAgenda = [];
  let activeCategory = "semua";
  let observer = null;
  let rendering = false;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fmtDate(value) {
    const MONTHS = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const date = parseDate(value);
    if (!date) return "";
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function labelCategory(value) {
    const key = String(value || "kajian").toLowerCase();
    return CATEGORY_LABELS[key] || value || "Kajian";
  }

  function labelType(value) {
    const key = String(value || "kajian").toLowerCase();
    return TYPE_LABELS[key] || value || "Kajian";
  }

  function loadStylesheet() {
    if (document.querySelector('link[data-mjhk-agenda-public="1"]')) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/css/agenda-public.css";
    link.dataset.mjhkAgendaPublic = "1";
    document.head.appendChild(link);
  }

  function patchStaticLabels() {
    const navAgenda = $('.nav-links a[href="#kajian"]');
    if (navAgenda) navAgenda.textContent = "Agenda";

    const heroAgenda = $('.hero-actions a[href="#kajian"]');
    if (heroAgenda) heroAgenda.textContent = "Lihat Agenda";

    const infoCards = $$(".grid-3 .card.card-pad");
    if (infoCards[0]) {
      const title = $("h3", infoCards[0]);
      const text = $("p", infoCards[0]);
      if (title) title.textContent = "Kegiatan, Kajian & Dakwah";
      if (text) {
        text.textContent = "Informasi seminar, kajian, pelatihan, dan agenda dakwah Masjid Jami' Harapan Kita.";
      }
    }

    const section = $("#kajian");
    if (!section) return;

    const badge = $(".section-head .badge", section);
    const title = $(".section-head h2", section);
    const text = $(".section-head p", section);

    if (badge) badge.textContent = "Agenda MJHK";
    if (title) title.textContent = "Kegiatan, Kajian & Dakwah";
    if (text) {
      text.textContent = "Temukan agenda resmi yang telah dipublikasikan, mulai dari kegiatan, kajian, hingga dakwah.";
    }
  }

  function ensureFilterBar() {
    const grid = $("#kajianGrid");
    if (!grid || $("#agendaPublicFilters")) return;

    const wrap = document.createElement("div");
    wrap.id = "agendaPublicFilters";
    wrap.className = "agenda-filter-bar";
    wrap.setAttribute("aria-label", "Filter agenda MJHK");

    const filters = [
      ["semua", "Semua"],
      ["kegiatan", "Kegiatan"],
      ["kajian", "Kajian"],
      ["dakwah", "Dakwah"]
    ];

    wrap.innerHTML = filters.map(([value, label]) => `
      <button
        type="button"
        class="agenda-filter-btn ${value === activeCategory ? "active" : ""}"
        data-agenda-filter="${value}"
      >${label}</button>
    `).join("");

    grid.parentNode.insertBefore(wrap, grid);

    $$(".agenda-filter-btn", wrap).forEach(button => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.agendaFilter || "semua";

        $$(".agenda-filter-btn", wrap).forEach(item => {
          item.classList.toggle("active", item === button);
        });

        renderCachedAgenda();
      });
    });
  }

  function metaSpan(value, extraClass = "") {
    if (!value) return "";
    return `<span class="${extraClass}">${esc(value)}</span>`;
  }

  function renderCachedAgenda() {
    const grid = $("#kajianGrid");
    if (!grid || rendering) return;

    rendering = true;

    try {
      const rows = activeCategory === "semua"
        ? allAgenda
        : allAgenda.filter(row => String(row.kategori_utama || "kajian").toLowerCase() === activeCategory);

      if (!rows.length) {
        grid.innerHTML = `
          <p class="section-state is-empty" data-agenda-public-state="1">
            Belum ada agenda ${activeCategory === "semua" ? "" : labelCategory(activeCategory).toLowerCase() + " "}
            yang dipublikasikan untuk tanggal mendatang.
          </p>
        `;
        return;
      }

      grid.innerHTML = rows.map(row => {
        const category = String(row.kategori_utama || "kajian").toLowerCase();
        const type = String(row.jenis_agenda || row.jenis_legacy || "kajian").toLowerCase();
        const targetId = `kajian-${row.id}`;

        const poster = row.poster_url
          ? `<img src="${esc(row.poster_url)}" alt="${esc(row.judul || "Agenda MJHK")}">`
          : `<div class="thumb"><strong>${esc(labelType(type))}</strong></div>`;

        const meta = [
          metaSpan(row.penceramah || ""),
          metaSpan(fmtDate(row.tanggal)),
          metaSpan(row.waktu || ""),
          metaSpan(row.lokasi || "", "agenda-location")
        ].join("");

        return `
          <article
            class="card kajian-card agenda-public-card"
            id="${esc(targetId)}"
            data-agenda-public="1"
            data-agenda-category="${esc(category)}"
          >
            ${poster}
            <div class="card-pad">
              <div class="agenda-card-badges">
                <span class="agenda-category-pill category-${esc(category)}">${esc(labelCategory(category))}</span>
                <span class="agenda-type-pill type-${esc(type)}">${esc(labelType(type))}</span>
              </div>

              <h3>${esc(row.judul || "Agenda MJHK")}</h3>
              ${row.tema ? `<p>${esc(row.tema)}</p>` : ""}

              <div class="meta">${meta}</div>
            </div>
          </article>
        `;
      }).join("");
    } finally {
      rendering = false;
    }
  }

  async function fetchAgenda() {
    const grid = $("#kajianGrid");
    if (!grid || !db) return false;

    const { data, error } = await db
      .from("agenda_publik")
      .select("*")
      .order("tanggal", { ascending: true });

    if (error) {
      console.error("Agenda publik:", error);
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    allAgenda = (data || []).filter(row => {
      const date = parseDate(row.tanggal);
      return date && date >= today;
    });

    renderCachedAgenda();
    return true;
  }

  function watchForLegacyOverwrite() {
    const grid = $("#kajianGrid");
    if (!grid || observer) return;

    observer = new MutationObserver(() => {
      if (rendering || !allAgenda.length) return;

      const cards = $$(".kajian-card", grid);
      const hasLegacyOverwrite = cards.length > 0 && cards.some(card => card.dataset.agendaPublic !== "1");

      if (hasLegacyOverwrite) {
        requestAnimationFrame(renderCachedAgenda);
      }
    });

    observer.observe(grid, {
      childList: true,
      subtree: true
    });
  }

  async function init() {
    loadStylesheet();
    patchStaticLabels();
    ensureFilterBar();
    watchForLegacyOverwrite();

    const ok = await fetchAgenda();

    if (ok) {
      setTimeout(renderCachedAgenda, 450);
      setTimeout(renderCachedAgenda, 1400);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
