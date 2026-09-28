(() => {
  "use strict";

  const db = window.mjhkSupabase;
  const menuButton = document.querySelector('[data-tab="ramadhan"]');
  const rows = document.getElementById("ramadhanRows");
  if (!db || !menuButton || !rows) return;

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
    mungkin:"Mungkin",belum:"Belum Dapat Berpartisipasi"
  };
  const statusLabels = {baru:"Baru",dibaca:"Dibaca",ditindaklanjuti:"Ditindaklanjuti",selesai:"Selesai"};
  let data = [];
  let loaded = false;

  const state = document.getElementById("ramadhanAdminState");
  const statusFilter = document.getElementById("ramadhanStatusFilter");
  const participationFilter = document.getElementById("ramadhanPartisipasiFilter");
  const searchInput = document.getElementById("ramadhanSearch");
  const modal = document.getElementById("ramadhanReviewModal");

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(value));
  }

  function setState(message, error = false) {
    state.textContent = message;
    state.classList.toggle("error", error);
  }

  function labels(values, dictionary, otherText) {
    return (values || []).map(value => value === "lainnya" && otherText ? `Lainnya: ${otherText}` : (dictionary[value] || value));
  }

  function addPills(cell, values) {
    const wrap = document.createElement("div");
    wrap.className = "ramadhan-pill-list";
    values.forEach(value => {
      const pill = document.createElement("span");
      pill.className = "ramadhan-pill";
      pill.textContent = value;
      wrap.appendChild(pill);
    });
    cell.appendChild(wrap);
  }

  function filteredData() {
    const status = statusFilter.value;
    const participation = participationFilter.value;
    const query = searchInput.value.trim().toLowerCase();
    return data.filter(item => {
      if (status && item.status !== status) return false;
      if (participation && item.partisipasi !== participation) return false;
      if (!query) return true;
      const searchable = [item.nama,item.whatsapp,item.program_dipertahankan,item.usulan_baru,item.saran_lain,item.program_lainnya,item.peningkatan_lainnya]
        .concat(labels(item.program_prioritas, programLabels, item.program_lainnya))
        .concat(labels(item.area_peningkatan, improvementLabels, item.peningkatan_lainnya))
        .join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }

  function updateStats() {
    const today = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Jakarta"}).format(new Date());
    document.getElementById("statAspirasi").textContent = data.length;
    document.getElementById("ramadhanTotal").textContent = data.length;
    document.getElementById("ramadhanBaru").textContent = data.filter(item => item.status === "baru").length;
    document.getElementById("ramadhanPartisipan").textContent = data.filter(item => ["relawan","donatur","relawan_dan_donatur","mungkin"].includes(item.partisipasi)).length;
    document.getElementById("ramadhanHariIni").textContent = data.filter(item => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Jakarta"}).format(new Date(item.created_at)) === today).length;
  }

  function render() {
    const visible = filteredData();
    rows.replaceChildren();
    if (!visible.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "loading-row";
      cell.textContent = data.length ? "Tidak ada aspirasi yang cocok dengan filter." : "Belum ada aspirasi yang masuk.";
      row.appendChild(cell);
      rows.appendChild(row);
    }

    visible.forEach(item => {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      dateCell.textContent = formatDate(item.created_at);
      row.appendChild(dateCell);

      const programsCell = document.createElement("td");
      addPills(programsCell, labels(item.program_prioritas, programLabels, item.program_lainnya));
      row.appendChild(programsCell);

      const improvementsCell = document.createElement("td");
      addPills(improvementsCell, labels(item.area_peningkatan, improvementLabels, item.peningkatan_lainnya));
      row.appendChild(improvementsCell);

      const participationCell = document.createElement("td");
      participationCell.textContent = participationLabels[item.partisipasi] || item.partisipasi || "-";
      row.appendChild(participationCell);

      const contactCell = document.createElement("td");
      const contactLines = [item.nama, item.whatsapp].filter(Boolean);
      contactCell.textContent = contactLines.length ? contactLines.join("\n") : "Anonim";
      contactCell.style.whiteSpace = "pre-line";
      row.appendChild(contactCell);

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `ramadhan-status ${item.status}`;
      badge.textContent = statusLabels[item.status] || item.status;
      statusCell.appendChild(badge);
      row.appendChild(statusCell);

      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "small edit";
      button.textContent = "Tinjau";
      button.addEventListener("click", () => openReview(item.id));
      actionCell.appendChild(button);
      row.appendChild(actionCell);
      rows.appendChild(row);
    });
    setState(`${visible.length} dari ${data.length} aspirasi ditampilkan.`);
  }

  async function load() {
    setState("Memuat aspirasi...");
    rows.innerHTML = '<tr><td colspan="7" class="loading-row">Memuat data...</td></tr>';
    const { data: result, error } = await db.from("aspirasi_ramadhan").select("*").order("created_at", {ascending:false}).limit(1000);
    if (error) {
      rows.innerHTML = '<tr><td colspan="7" class="loading-row">Data belum dapat dimuat.</td></tr>';
      setState("Data aspirasi belum tersedia. Pastikan SQL modul Ramadhan sudah dijalankan di Supabase.", true);
      throw error;
    }
    data = result || [];
    loaded = true;
    updateStats();
    render();
  }

  function reviewItem(title, value) {
    const item = document.createElement("div");
    item.className = "ramadhan-review-item";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = value || "Tidak ada jawaban.";
    item.append(heading, paragraph);
    return item;
  }

  function openReview(id) {
    const item = data.find(entry => Number(entry.id) === Number(id));
    if (!item) return;
    document.getElementById("ramadhanReviewId").value = item.id;
    document.getElementById("ramadhanReviewStatus").value = item.status || "baru";
    document.getElementById("ramadhanReviewNote").value = item.catatan_internal || "";
    document.getElementById("ramadhanReviewMeta").textContent = `${formatDate(item.created_at)} · ${item.nama || "Anonim"}${item.whatsapp ? ` · ${item.whatsapp}` : ""}`;
    const content = document.getElementById("ramadhanReviewContent");
    content.replaceChildren(
      reviewItem("Program yang paling diharapkan", labels(item.program_prioritas, programLabels, item.program_lainnya).join(", ")),
      reviewItem("Hal yang perlu ditingkatkan", labels(item.area_peningkatan, improvementLabels, item.peningkatan_lainnya).join(", ")),
      reviewItem("Program yang perlu dipertahankan", item.program_dipertahankan),
      reviewItem("Usulan kegiatan baru", item.usulan_baru),
      reviewItem("Kesediaan berpartisipasi", participationLabels[item.partisipasi] || item.partisipasi),
      reviewItem("Saran atau masukan lain", item.saran_lain)
    );
    modal.classList.remove("hidden");
  }

  function closeReview() {
    modal.classList.add("hidden");
  }

  async function saveReview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Menyimpan...";
    try {
      const { data: { session } } = await db.auth.getSession();
      const payload = {
        status: document.getElementById("ramadhanReviewStatus").value,
        catatan_internal: document.getElementById("ramadhanReviewNote").value.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session?.user?.id || null
      };
      const id = Number(document.getElementById("ramadhanReviewId").value);
      const { error } = await db.from("aspirasi_ramadhan").update(payload).eq("id", id);
      if (error) throw error;
      const index = data.findIndex(item => Number(item.id) === id);
      if (index >= 0) data[index] = {...data[index], ...payload};
      updateStats();
      render();
      closeReview();
      setState("Tinjauan berhasil disimpan.");
    } catch (error) {
      console.error("Ramadhan review failed:", error);
      setState("Tinjauan belum berhasil disimpan. Silakan coba kembali.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Simpan Tinjauan";
    }
  }

  function csvCell(value) {
    const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
    return `"${text.replaceAll('"','""')}"`;
  }

  function exportCsv() {
    const header = ["Waktu","Nama","WhatsApp","Prioritas Program","Program Lainnya","Perlu Ditingkatkan","Peningkatan Lainnya","Program Dipertahankan","Usulan Baru","Partisipasi","Saran Lain","Status","Catatan Internal"];
    const lines = [header.map(csvCell).join(",")];
    filteredData().forEach(item => lines.push([
      formatDate(item.created_at),item.nama,item.whatsapp,
      labels(item.program_prioritas,programLabels,item.program_lainnya),item.program_lainnya,
      labels(item.area_peningkatan,improvementLabels,item.peningkatan_lainnya),item.peningkatan_lainnya,
      item.program_dipertahankan,item.usulan_baru,participationLabels[item.partisipasi] || item.partisipasi,
      item.saran_lain,statusLabels[item.status] || item.status,item.catatan_internal
    ].map(csvCell).join(",")));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aspirasi-ramadhan-1448h-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  menuButton.addEventListener("click", () => { if (!loaded) load().catch(error => console.error(error)); });
  [statusFilter, participationFilter].forEach(control => control.addEventListener("change", render));
  searchInput.addEventListener("input", render);
  document.getElementById("exportRamadhanCsv").addEventListener("click", exportCsv);
  document.getElementById("ramadhanReviewForm").addEventListener("submit", saveReview);
  document.getElementById("closeRamadhanReview").addEventListener("click", closeReview);
  document.getElementById("cancelRamadhanReview").addEventListener("click", closeReview);
  modal.addEventListener("click", event => { if (event.target === modal) closeReview(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.classList.contains("hidden")) closeReview(); });

  db.auth.getSession().then(({data:{session}}) => { if (session) load().catch(error => console.error(error)); });
})();
