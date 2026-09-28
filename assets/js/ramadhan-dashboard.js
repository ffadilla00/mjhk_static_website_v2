(() => {
  "use strict";

  const db = window.mjhkSupabase;
  const refreshButton = document.getElementById("refreshDashboard");
  const alertBox = document.getElementById("dashboardAlert");

  if (!refreshButton) return;

  const programLabels = {
    pra_ramadhan:"Pra Ramadhan",tarawih_witir:"Tarawih dan Witir",kultum_kajian:"Kultum dan Kajian",
    tadarus:"Tadarus Al-Qur'an",ifthar_tajil:"Ifthar atau Ta'jil",pesantren_anak:"Pesantren Anak",
    itikaf_10_malam:"I'tikaf dan 10 Malam Terakhir",santunan_ziswaf:"Santunan dan ZISWAF",
    takbir_idul_fitri:"Malam Takbir dan Idul Fitri",halal_bihalal:"Halal bi Halal",lainnya:"Lainnya"
  };
  const improvementLabels = {
    kenyamanan_ibadah:"Kenyamanan Ibadah",kualitas_kajian:"Kualitas Kajian",anak_remaja:"Anak dan Remaja",
    tajil_buka_puasa:"Ta'jil atau Buka Puasa",kebersihan_fasilitas:"Kebersihan dan Fasilitas",
    informasi_kegiatan:"Informasi Kegiatan",pengelolaan_ziswaf:"Pengelolaan ZISWAF",
    sepuluh_malam_terakhir:"Sepuluh Malam Terakhir",tidak_ada:"Tidak Ada",lainnya:"Lainnya"
  };
  const participationLabels = {
    relawan:"Relawan",donatur:"Donatur",relawan_dan_donatur:"Relawan dan Donatur",
    mungkin:"Mungkin Berpartisipasi",belum:"Belum Dapat Berpartisipasi"
  };

  function formatDate(value) {
    if (!value) return "Waktu tidak tersedia";
    return new Intl.DateTimeFormat("id-ID", {
      timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"
    }).format(new Date(value)).replace(" pukul ", ", ");
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value ?? 0);
  }

  function renderRanking(containerId, items, labels) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    const rows = asArray(items);
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Belum ada data.";
      container.append(empty);
      return;
    }
    const maximum = Math.max(...rows.map(item => Number(item.count) || 0), 1);
    rows.forEach(item => {
      const row = document.createElement("div");
      row.className = "ranking-row";
      const name = document.createElement("strong");
      name.textContent = labels[item.key] || item.key || "Lainnya";
      const count = document.createElement("span");
      count.className = "ranking-count";
      count.textContent = `${Number(item.count) || 0} pilihan`;
      const track = document.createElement("div");
      track.className = "ranking-track";
      const fill = document.createElement("div");
      fill.className = "ranking-fill";
      fill.style.width = `${Math.max(5, ((Number(item.count) || 0) / maximum) * 100)}%`;
      track.append(fill);
      row.append(name, count, track);
      container.append(row);
    });
  }

  function renderParticipation(items) {
    const container = document.getElementById("participationRanking");
    container.replaceChildren();
    const rows = asArray(items);
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Belum ada data.";
      container.append(empty);
      return;
    }
    rows.forEach(item => {
      const card = document.createElement("div");
      card.className = "participation-item";
      const label = document.createElement("span");
      label.textContent = participationLabels[item.key] || item.key || "Lainnya";
      const count = document.createElement("strong");
      count.textContent = String(Number(item.count) || 0);
      card.append(label, count);
      container.append(card);
    });
  }

  function addPills(container, values, labels, extraClass = "") {
    asArray(values).forEach(value => {
      const pill = document.createElement("span");
      pill.className = `pill${extraClass ? ` ${extraClass}` : ""}`;
      pill.textContent = labels[value] || value;
      container.append(pill);
    });
  }

  function renderSuggestions(items) {
    const container = document.getElementById("suggestionList");
    container.replaceChildren();
    const suggestions = asArray(items);
    if (!suggestions.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Belum ada usulan kegiatan baru.";
      container.append(empty);
      return;
    }
    suggestions.forEach(item => {
      const card = document.createElement("article");
      card.className = "suggestion-card";
      const meta = document.createElement("div");
      meta.className = "suggestion-meta";
      const anonymous = document.createElement("span");
      anonymous.className = "anonymous-badge";
      anonymous.textContent = item.pengirim || "Anonim";
      const date = document.createElement("time");
      date.dateTime = item.created_at || "";
      date.textContent = formatDate(item.created_at);
      meta.append(anonymous, date);
      const text = document.createElement("p");
      text.textContent = item.usulan || "Usulan tidak tersedia.";
      const pills = document.createElement("div");
      pills.className = "pill-list";
      addPills(pills, item.program_prioritas, programLabels);
      addPills(pills, item.area_peningkatan, improvementLabels, "improvement");
      card.append(meta, text, pills);
      container.append(card);
    });
  }

  function render(payload) {
    setText("totalAspirasi", payload.total_aspirasi);
    setText("masukHariIni", payload.masuk_hari_ini);
    setText("bersediaBerpartisipasi", payload.bersedia_berpartisipasi);
    setText("totalUsulanBaru", payload.total_usulan_baru);
    document.getElementById("lastUpdated").textContent = payload.terakhir_diperbarui
      ? `Data terakhir masuk ${formatDate(payload.terakhir_diperbarui)} WIB`
      : "Belum ada aspirasi yang masuk.";
    renderRanking("programRanking", payload.prioritas_program, programLabels);
    renderRanking("improvementRanking", payload.area_peningkatan, improvementLabels);
    renderParticipation(payload.partisipasi);
    renderSuggestions(payload.usulan_baru);
  }

  async function loadDashboard() {
    alertBox.hidden = true;
    refreshButton.disabled = true;
    refreshButton.textContent = "Memperbarui...";
    try {
      if (!db) throw new Error("Supabase client tidak tersedia");
      const { data, error } = await db.rpc("get_ramadhan_public_dashboard");
      if (error) throw error;
      const payload = typeof data === "string" ? JSON.parse(data) : data;
      if (!payload || typeof payload !== "object") throw new Error("Payload dashboard tidak valid");
      render(payload);
    } catch (error) {
      console.error("Public Ramadhan dashboard failed:", error);
      alertBox.textContent = "Data belum dapat dimuat. Silakan coba kembali beberapa saat lagi.";
      alertBox.hidden = false;
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "Perbarui Data";
    }
  }

  refreshButton.addEventListener("click", loadDashboard);
  loadDashboard();
})();
