(() => {
  "use strict";

  const form = document.getElementById("ramadhanForm");
  if (!form) return;

  const db = window.mjhkSupabase;
  const alertBox = document.getElementById("formAlert");
  const submitButton = document.getElementById("submitButton");
  const successPanel = document.getElementById("successPanel");
  const startedAt = Date.now();
  const LAST_SUCCESS_KEY = "mjhk_ramadhan_1448_last_success";

  const programChecks = [...form.querySelectorAll('input[name="program_prioritas"]')];
  const improvementChecks = [...form.querySelectorAll('input[name="area_peningkatan"]')];
  const programOther = programChecks.find(input => input.value === "lainnya");
  const improvementOther = improvementChecks.find(input => input.value === "lainnya");
  const noImprovement = improvementChecks.find(input => input.value === "tidak_ada");

  function checkedValues(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  }

  function setAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = !message;
    if (message) alertBox.focus();
  }

  function normalize(value, maxLength) {
    const clean = String(value || "").trim().replace(/\s+/g, " ");
    return clean ? clean.slice(0, maxLength) : null;
  }

  function bindLimitedGroup(inputs, limit, counterId) {
    const counter = document.getElementById(counterId);
    inputs.forEach(input => input.addEventListener("change", () => {
      const selected = inputs.filter(item => item.checked);
      if (selected.length > limit) {
        input.checked = false;
        setAlert(`Pilihan maksimal ${limit}. Hapus pilihan lain sebelum menambahkan pilihan baru.`);
      } else {
        setAlert("");
      }
      counter.textContent = `${inputs.filter(item => item.checked).length}/${limit} dipilih`;
    }));
  }

  bindLimitedGroup(programChecks, 5, "programCounter");
  bindLimitedGroup(improvementChecks, 3, "peningkatanCounter");

  programOther.addEventListener("change", () => {
    const wrap = document.getElementById("programLainnyaWrap");
    wrap.hidden = !programOther.checked;
    if (!programOther.checked) document.getElementById("programLainnya").value = "";
  });

  improvementOther.addEventListener("change", () => {
    const wrap = document.getElementById("peningkatanLainnyaWrap");
    wrap.hidden = !improvementOther.checked;
    if (!improvementOther.checked) document.getElementById("peningkatanLainnya").value = "";
  });

  improvementChecks.forEach(input => input.addEventListener("change", () => {
    if (!input.checked) return;
    if (input === noImprovement) {
      improvementChecks.forEach(item => { if (item !== noImprovement) item.checked = false; });
      document.getElementById("peningkatanLainnyaWrap").hidden = true;
      document.getElementById("peningkatanLainnya").value = "";
    } else {
      noImprovement.checked = false;
    }
    document.getElementById("peningkatanCounter").textContent = `${improvementChecks.filter(item => item.checked).length}/3 dipilih`;
  }));

  function validate() {
    const programs = checkedValues("program_prioritas");
    const improvements = checkedValues("area_peningkatan");
    const participation = form.querySelector('input[name="partisipasi"]:checked')?.value;
    const programOtherText = normalize(document.getElementById("programLainnya").value, 200);
    const improvementOtherText = normalize(document.getElementById("peningkatanLainnya").value, 200);
    const whatsapp = normalize(document.getElementById("whatsapp").value, 20);

    if (!programs.length) return "Pilih minimal satu program yang paling Anda harapkan.";
    if (programs.length > 5) return "Pilihan program maksimal lima.";
    if (programs.includes("lainnya") && !programOtherText) return "Tuliskan program lainnya yang Anda harapkan.";
    if (!improvements.length) return "Pilih minimal satu hal yang perlu DKM tingkatkan.";
    if (improvements.length > 3) return "Pilihan hal yang perlu ditingkatkan maksimal tiga.";
    if (improvements.includes("tidak_ada") && improvements.length > 1) return "Pilihan Tidak ada tidak dapat digabungkan dengan pilihan lainnya.";
    if (improvements.includes("lainnya") && !improvementOtherText) return "Tuliskan hal lainnya yang perlu ditingkatkan.";
    if (!participation) return "Pilih jawaban kesediaan berpartisipasi.";
    if (whatsapp && !/^[0-9+() .-]{8,20}$/.test(whatsapp)) return "Periksa kembali format nomor WhatsApp.";
    return "";
  }

  function requestId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
      const value = Math.random() * 16 | 0;
      return (char === "x" ? value : (value & 3 | 8)).toString(16);
    });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    setAlert("");

    const validationError = validate();
    if (validationError) {
      setAlert(validationError);
      return;
    }
    if (document.getElementById("website").value) return;
    if (Date.now() - startedAt < 2500) {
      setAlert("Mohon periksa kembali jawaban sebelum mengirim form.");
      return;
    }
    const lastSuccess = Number(localStorage.getItem(LAST_SUCCESS_KEY) || 0);
    if (lastSuccess && Date.now() - lastSuccess < 60000) {
      setAlert("Aspirasi baru saja terkirim dari perangkat ini. Silakan tunggu satu menit jika ingin mengirim jawaban lain.");
      return;
    }
    if (!db) {
      setAlert("Layanan pengiriman belum tersedia. Silakan coba beberapa saat lagi.");
      return;
    }

    const payload = {
      submission_token: requestId(),
      form_version: "1448h-v1",
      program_prioritas: checkedValues("program_prioritas"),
      program_lainnya: normalize(document.getElementById("programLainnya").value, 200),
      area_peningkatan: checkedValues("area_peningkatan"),
      peningkatan_lainnya: normalize(document.getElementById("peningkatanLainnya").value, 200),
      program_dipertahankan: normalize(document.getElementById("programDipertahankan").value, 500),
      usulan_baru: normalize(document.getElementById("usulanBaru").value, 500),
      partisipasi: form.querySelector('input[name="partisipasi"]:checked').value,
      saran_lain: normalize(document.getElementById("saranLain").value, 1000),
      nama: normalize(document.getElementById("nama").value, 100),
      whatsapp: normalize(document.getElementById("whatsapp").value, 20),
      source_channel: "website"
    };

    submitButton.disabled = true;
    submitButton.textContent = "Mengirim...";
    try {
      const { error } = await db.from("aspirasi_ramadhan").insert(payload);
      if (error) throw error;
      localStorage.setItem(LAST_SUCCESS_KEY, String(Date.now()));
      form.hidden = true;
      document.querySelector(".form-head").hidden = true;
      successPanel.hidden = false;
      successPanel.focus();
      window.scrollTo({ top: document.querySelector(".form-card").offsetTop - 100, behavior: "smooth" });
    } catch (error) {
      console.error("Ramadhan form submit failed:", error);
      setAlert("Aspirasi belum berhasil dikirim. Periksa koneksi internet, lalu coba kembali.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Kirim Aspirasi";
    }
  });
})();
