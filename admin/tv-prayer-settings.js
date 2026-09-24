const db = window.mjhkSupabase;

if (!db) {
  throw new Error("mjhk_supabase_client_unavailable");
}

const $ = (id) => document.getElementById(id);

const PRAYER_ORDER = Object.freeze([
  "subuh",
  "dzuhur",
  "ashar",
  "maghrib",
  "isya",
  "jumat",
]);

const state = {
  session: null,
  systemSettings: null,
  prayerRules: [],
};

function showStatus(message, isError = false) {
  const el = $("status");
  el.hidden = false;
  el.textContent = message;
  el.style.background = isError ? "#fdecec" : "#eef6f1";
  el.style.borderColor = isError ? "#f0c8c8" : "#dfe8e3";
}

function clearStatus() {
  $("status").hidden = true;
  $("status").textContent = "";
}

function intValue(id, min, max, { nullable = false } = {}) {
  const raw = $(id).value.trim();

  if (nullable && raw === "") return null;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${id} harus bilangan bulat ${min}–${max}.`);
  }

  return value;
}

function finiteNumber(id, min, max) {
  const value = Number($(id).value);

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${id} harus berada pada rentang ${min}–${max}.`);
  }

  return value;
}

function parseJsonObject(id) {
  const raw = $(id).value.trim() || "{}";
  let value;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Prayer Calculation Config harus JSON valid.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Prayer Calculation Config harus JSON object.");
  }

  return value;
}

async function requireAdminSession() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;

  const session = data.session;

  if (!session) {
    location.href = "login.html";
    throw new Error("admin_session_required");
  }

  state.session = session;
  $("sessionLabel").textContent =
    `Login sebagai ${session.user.email || "admin"}`;
}

function updateJumatDurationState() {
  const durationMode = $("jumatPrayerEndMode").value === "duration";
  const input = $("jumatPrayerDurationMinutes");

  input.disabled = !durationMode;

  if (!durationMode) {
    input.value = "";
    $("jumatDurationHint").textContent = "Kosong saat mode Manual.";
  } else {
    if (!input.value) input.value = "15";
    $("jumatDurationHint").textContent = "Wajib 1–60 menit saat mode Durasi.";
  }
}

function fillSystemSettings(row) {
  state.systemSettings = row;

  $("timezone").value = row.timezone ?? "";
  $("latitude").value = row.latitude ?? "";
  $("longitude").value = row.longitude ?? "";

  const calc =
    row.prayer_calculation_config &&
    typeof row.prayer_calculation_config === "object"
      ? row.prayer_calculation_config
      : {};

  $("prayerCalculationConfig").value =
    JSON.stringify(calc, null, 2);

  $("hijriAdjustmentDays").value = row.hijri_adjustment_days ?? 0;
  $("ramadanMode").value = row.ramadan_mode ?? "auto";
  $("imsakOffsetMinutes").value = row.imsak_offset_minutes ?? 10;

  $("syuruqAdjustmentMinutes").value =
    row.syuruq_adjustment_minutes ?? 0;
  $("syuruqWaitMinutes").value =
    row.syuruq_wait_minutes ?? 10;
  $("isyraqDurationMinutes").value =
    row.isyraq_duration_minutes ?? 3;
  $("forbiddenBeforeMaghribMinutes").value =
    row.forbidden_before_maghrib_minutes ?? 3;

  $("fullscreenAdhanThresholdMinutes").value =
    row.fullscreen_adhan_threshold_minutes ?? 5;
  $("fullscreenIqamahThresholdMinutes").value =
    row.fullscreen_iqamah_threshold_minutes ?? 10;

  $("beepAdhanCount").value = row.beep_adhan_count ?? 5;
  $("beepIqamahCount").value = row.beep_iqamah_count ?? 15;
  $("beepForbiddenCount").value = row.beep_forbidden_count ?? 5;
  $("beepIsyraqCount").value = row.beep_isyraq_count ?? 10;
  $("beepImsakCount").value = row.beep_imsak_count ?? 5;

  $("jumatPrayerEndMode").value =
    row.jumat_prayer_end_mode ?? "manual";

  $("jumatPrayerDurationMinutes").value =
    row.jumat_prayer_duration_minutes ?? "";

  updateJumatDurationState();
}

function renderPrayerRules(rows) {
  state.prayerRules = [...rows].sort(
    (a, b) =>
      PRAYER_ORDER.indexOf(a.prayer_code) -
      PRAYER_ORDER.indexOf(b.prayer_code)
  );

  const mount = $("prayerRulesGrid");
  mount.innerHTML = "";

  for (const row of state.prayerRules) {
    const isFriday = row.prayer_code === "jumat";
    const card = document.createElement("article");

    card.className = "prayer-rule-card";
    card.dataset.prayerCode = row.prayer_code;

    card.innerHTML = `
      <div class="prayer-rule-head">
        <strong>${row.display_name}</strong>
        <label class="enable-row">
          <input
            id="rule_${row.prayer_code}_enabled"
            type="checkbox"
            ${row.enabled ? "checked" : ""}
          >
          Aktif
        </label>
      </div>

      <div class="prayer-rule-body">
        <label class="field">
          <span>Adjustment Waktu</span>
          <input
            id="rule_${row.prayer_code}_time_adjustment_minutes"
            type="number"
            min="-60"
            max="60"
            step="1"
            value="${row.time_adjustment_minutes ?? 0}"
          >
          <small>-60 s.d. 60 menit</small>
        </label>

        <label class="field">
          <span>Durasi Salat</span>
          <input
            id="rule_${row.prayer_code}_prayer_duration_minutes"
            type="number"
            min="1"
            max="60"
            step="1"
            value="${row.prayer_duration_minutes ?? ""}"
          >
          <small>${isFriday ? "Boleh kosong untuk Jum'at" : "1–60 menit"}</small>
        </label>

        <label class="field">
          <span>Countdown Adhan</span>
          <input
            id="rule_${row.prayer_code}_adhan_countdown_minutes"
            type="number"
            min="0"
            max="30"
            step="1"
            value="${row.adhan_countdown_minutes ?? 0}"
          >
          <small>0–30 menit</small>
        </label>

        <label class="field">
          <span>Jeda Adhan</span>
          <input
            id="rule_${row.prayer_code}_adhan_pause_minutes"
            type="number"
            min="0"
            max="60"
            step="1"
            value="${row.adhan_pause_minutes ?? 0}"
          >
          <small>0–60 menit</small>
        </label>

        <label class="field">
          <span>Countdown Iqamah</span>
          <input
            id="rule_${row.prayer_code}_iqamah_countdown_minutes"
            type="number"
            min="0"
            max="60"
            step="1"
            value="${row.iqamah_countdown_minutes ?? ""}"
          >
          <small>${isFriday ? "Boleh kosong untuk Jum'at" : "0–60 menit"}</small>
        </label>

        <label class="field">
          <span>Jeda Iqamah</span>
          <input
            id="rule_${row.prayer_code}_iqamah_pause_seconds"
            type="number"
            min="0"
            max="300"
            step="1"
            value="${row.iqamah_pause_seconds ?? ""}"
          >
          <small>${isFriday ? "Boleh kosong untuk Jum'at" : "0–300 detik"}</small>
        </label>

        ${
          isFriday
            ? '<p class="nullable-note">Contract Jum\'at saat ini memang memakai NULL untuk durasi salat, countdown iqamah, dan jeda iqamah. Editor mempertahankan nilai kosong tersebut.</p>'
            : ""
        }
      </div>
    `;

    mount.appendChild(card);
  }
}

async function loadSources() {
  clearStatus();

  const [
    { data: settings, error: settingsError },
    { data: rules, error: rulesError },
  ] = await Promise.all([
    db
      .from("tv_system_settings")
      .select("*")
      .eq("id", 1)
      .single(),

    db
      .from("tv_prayer_rules")
      .select("*"),
  ]);

  if (settingsError) throw settingsError;
  if (rulesError) throw rulesError;

  if (!Array.isArray(rules) || rules.length !== 6) {
    throw new Error(
      `Expected 6 prayer rules, received ${Array.isArray(rules) ? rules.length : 0}.`
    );
  }

  fillSystemSettings(settings);
  renderPrayerRules(rules);
}

function buildGlobalPayload() {
  const timezone = $("timezone").value.trim();

  if (!timezone) {
    throw new Error("Timezone tidak boleh kosong.");
  }

  const jumatMode = $("jumatPrayerEndMode").value;

  if (!["manual", "duration"].includes(jumatMode)) {
    throw new Error("Mode selesai Jum'at tidak valid.");
  }

  const jumatDuration =
    jumatMode === "duration"
      ? intValue("jumatPrayerDurationMinutes", 1, 60)
      : null;

  return {
    timezone,
    latitude: finiteNumber("latitude", -90, 90),
    longitude: finiteNumber("longitude", -180, 180),
    prayer_calculation_config: parseJsonObject("prayerCalculationConfig"),

    hijri_adjustment_days:
      intValue("hijriAdjustmentDays", -3, 3),
    ramadan_mode: $("ramadanMode").value,
    imsak_offset_minutes:
      intValue("imsakOffsetMinutes", 0, 60),

    syuruq_adjustment_minutes:
      intValue("syuruqAdjustmentMinutes", -30, 30),
    syuruq_wait_minutes:
      intValue("syuruqWaitMinutes", 0, 60),
    isyraq_duration_minutes:
      intValue("isyraqDurationMinutes", 1, 30),
    forbidden_before_maghrib_minutes:
      intValue("forbiddenBeforeMaghribMinutes", 0, 30),

    fullscreen_adhan_threshold_minutes:
      intValue("fullscreenAdhanThresholdMinutes", 0, 30),
    fullscreen_iqamah_threshold_minutes:
      intValue("fullscreenIqamahThresholdMinutes", 0, 60),

    beep_adhan_count:
      intValue("beepAdhanCount", 0, 60),
    beep_iqamah_count:
      intValue("beepIqamahCount", 0, 60),
    beep_forbidden_count:
      intValue("beepForbiddenCount", 0, 60),
    beep_isyraq_count:
      intValue("beepIsyraqCount", 0, 60),
    beep_imsak_count:
      intValue("beepImsakCount", 0, 60),

    jumat_prayer_end_mode: jumatMode,
    jumat_prayer_duration_minutes: jumatDuration,
  };
}

function buildPrayerPayload(row) {
  const prefix = `rule_${row.prayer_code}_`;

  return {
    display_name: row.display_name,
    time_adjustment_minutes:
      intValue(`${prefix}time_adjustment_minutes`, -60, 60),

    prayer_duration_minutes:
      intValue(
        `${prefix}prayer_duration_minutes`,
        1,
        60,
        { nullable: row.prayer_code === "jumat" }
      ),

    adhan_countdown_minutes:
      intValue(`${prefix}adhan_countdown_minutes`, 0, 30),

    adhan_pause_minutes:
      intValue(`${prefix}adhan_pause_minutes`, 0, 60),

    iqamah_countdown_minutes:
      intValue(
        `${prefix}iqamah_countdown_minutes`,
        0,
        60,
        { nullable: row.prayer_code === "jumat" }
      ),

    iqamah_pause_seconds:
      intValue(
        `${prefix}iqamah_pause_seconds`,
        0,
        300,
        { nullable: row.prayer_code === "jumat" }
      ),

    enabled: $(`${prefix}enabled`).checked,
  };
}

async function saveGlobalSettings() {
  $("saveGlobalBtn").disabled = true;
  clearStatus();

  try {
    const payload = buildGlobalPayload();

    const { data, error } = await db
      .from("tv_system_settings")
      .update(payload)
      .eq("id", 1)
      .select()
      .single();

    if (error) throw error;

    fillSystemSettings(data);
    showStatus(
      "Global Prayer Settings berhasil disimpan. Belum dipublish ke revision TV."
    );
  } catch (error) {
    console.error(error);
    showStatus(error?.message || "Gagal menyimpan Global Prayer Settings.", true);
  } finally {
    $("saveGlobalBtn").disabled = false;
  }
}

async function savePrayerRules() {
  $("savePrayerRulesBtn").disabled = true;
  clearStatus();

  try {
    const updates = state.prayerRules.map((row) => ({
      prayerCode: row.prayer_code,
      payload: buildPrayerPayload(row),
    }));

    for (const item of updates) {
      const { error } = await db
        .from("tv_prayer_rules")
        .update(item.payload)
        .eq("prayer_code", item.prayerCode);

      if (error) {
        throw new Error(
          `${item.prayerCode}: ${error.message || "update_failed"}`
        );
      }
    }

    const { data, error } = await db
      .from("tv_prayer_rules")
      .select("*");

    if (error) throw error;

    renderPrayerRules(data || []);

    showStatus(
      "Per-Prayer Rules berhasil disimpan. Belum dipublish ke revision TV."
    );
  } catch (error) {
    console.error(error);

    try {
      await loadSources();
    } catch (reloadError) {
      console.error(reloadError);
    }

    showStatus(
      `${error?.message || "Gagal menyimpan Per-Prayer Rules."} Data telah dimuat ulang.`,
      true
    );
  } finally {
    $("savePrayerRulesBtn").disabled = false;
  }
}

async function bootstrap() {
  await requireAdminSession();
  await loadSources();

  $("jumatPrayerEndMode").addEventListener(
    "change",
    updateJumatDurationState
  );

  $("saveGlobalBtn").addEventListener(
    "click",
    saveGlobalSettings
  );

  $("savePrayerRulesBtn").addEventListener(
    "click",
    savePrayerRules
  );

  $("refreshBtn").addEventListener("click", async () => {
    $("refreshBtn").disabled = true;

    try {
      await loadSources();
    } catch (error) {
      console.error(error);
      showStatus(error?.message || "Gagal refresh Prayer Settings.", true);
    } finally {
      $("refreshBtn").disabled = false;
    }
  });
}

bootstrap().catch((error) => {
  console.error(error);
  showStatus(error?.message || "Gagal memuat Prayer Settings.", true);
});
