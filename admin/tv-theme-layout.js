const db = window.mjhkSupabase;

if (!db) {
  throw new Error("mjhk_supabase_client_unavailable");
}

const THEME_FIELDS = [
  ["canvas_bg", "Canvas / Stage"],
  ["header_bg", "Header Background"],
  ["header_text", "Header Text"],
  ["running_bg", "Running Background"],
  ["running_text", "Running Text"],
  ["running_label_bg", "Running Label Background"],
  ["running_label_text", "Running Label Text"],
  ["prayer_panel_bg", "Prayer Panel Background"],
  ["prayer_row_bg", "Prayer Row Background"],
  ["prayer_title_text", "Prayer Title Text"],
  ["prayer_time_text", "Prayer Time Text"],
  ["prayer_highlight_bg", "Prayer Highlight Background"],
  ["prayer_highlight_title", "Prayer Highlight Title"],
  ["prayer_highlight_time", "Prayer Highlight Time"],
  ["accent", "Accent"],
];

const FALLBACKS = Object.freeze({
  canvas_bg:"#0A2E24",
  header_bg:"#0B4B37",
  header_text:"#FFFFFF",
  running_bg:"#0B4B37",
  running_text:"#FFFFFF",
  running_label_bg:"#c5a764",
  running_label_text:"#0c2f24",
  prayer_panel_bg:"#e7efe9",
  prayer_row_bg:"#ffffff",
  prayer_title_text:"#13231c",
  prayer_time_text:"#13231c",
  prayer_highlight_bg:"#14513f",
  prayer_highlight_title:"#ffffff",
  prayer_highlight_time:"#ffffff",
  accent:"#c5a764",
});

const $ = (id) => document.getElementById(id);

const state = {
  session: null,
  profiles: [],
  currentProfile: null,
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

function isHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
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

function buildThemeFields() {
  const mount = $("themeFields");
  mount.innerHTML = "";

  for (const [key, label] of THEME_FIELDS) {
    const wrap = document.createElement("div");
    wrap.className = "color-field";
    wrap.innerHTML = `
      <label class="field">
        <span>${label}</span>
        <input id="theme_${key}" data-theme-key="${key}" type="text" maxlength="7">
      </label>
      <input
        id="picker_${key}"
        data-picker-key="${key}"
        type="color"
        aria-label="${label}"
      >
    `;
    mount.appendChild(wrap);
  }

  mount.querySelectorAll("[data-theme-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.themeKey;
      if (isHex(input.value)) {
        $(`picker_${key}`).value = input.value;
        updatePreview();
      }
    });
  });

  mount.querySelectorAll("[data-picker-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.pickerKey;
      $(`theme_${key}`).value = input.value;
      updatePreview();
    });
  });
}

function themeValue(profile, key) {
  return profile?.theme?.[key] || FALLBACKS[key];
}

function fillForm(profile) {
  state.currentProfile = profile;

  $("prayerPanelSide").value = profile.prayer_panel_side || "left";
  $("headerShowClock").checked = Boolean(profile.header_show_clock);
  $("headerShowMosque").checked = Boolean(profile.header_show_mosque);
  $("headerShowGregorianDate").checked =
    Boolean(profile.header_show_gregorian_date);
  $("headerShowHijriDate").checked =
    Boolean(profile.header_show_hijri_date);

  $("slideDuration").value =
    profile.default_slide_duration_seconds ?? 10;
  $("runningSpeed").value =
    profile.running_text_speed_px_per_second ?? 60;

  for (const [key] of THEME_FIELDS) {
    const value = themeValue(profile, key);
    $(`theme_${key}`).value = value;
    $(`picker_${key}`).value = value;
  }

  updatePreview();
}

async function loadProfiles() {
  clearStatus();

  const { data, error } = await db
    .from("tv_display_profiles")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");

  if (error) throw error;

  state.profiles = data || [];

  const select = $("profileSelect");
  select.innerHTML = "";

  for (const profile of state.profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent =
      `${profile.name}${profile.is_default ? " · Default" : ""}`;
    select.appendChild(option);
  }

  const selected =
    state.profiles.find((profile) => profile.is_default) ||
    state.profiles[0] ||
    null;

  if (!selected) {
    state.currentProfile = null;
    showStatus("Belum ada display profile.", true);
    return;
  }

  select.value = selected.id;
  fillForm(selected);
}

function collectTheme() {
  const result = {};

  for (const [key] of THEME_FIELDS) {
    const value = $(`theme_${key}`).value.trim();

    if (!isHex(value)) {
      throw new Error(`${key} harus format #RRGGBB`);
    }

    result[key] = value;
  }

  return result;
}

function updatePreview() {
  if (typeof window.mjhkThemePreviewRefresh === "function") {
    window.mjhkThemePreviewRefresh();
  }
}

async function saveProfile() {
  const profile = state.currentProfile;
  if (!profile) return;

  $("saveBtn").disabled = true;
  clearStatus();

  try {
    const currentTheme =
      profile.theme &&
      typeof profile.theme === "object" &&
      !Array.isArray(profile.theme)
        ? profile.theme
        : {};

    const slideDuration = Number($("slideDuration").value);
    const runningSpeed = Number($("runningSpeed").value);

    if (!Number.isFinite(slideDuration) || slideDuration < 1 || slideDuration > 300) {
      throw new Error("Durasi slideshow harus 1–300 detik.");
    }

    if (!Number.isFinite(runningSpeed) || runningSpeed < 1 || runningSpeed > 500) {
      throw new Error("Running text speed harus 1–500 px/detik.");
    }

    const payload = {
      prayer_panel_side: $("prayerPanelSide").value,
      header_show_clock: $("headerShowClock").checked,
      header_show_mosque: $("headerShowMosque").checked,
      header_show_gregorian_date: $("headerShowGregorianDate").checked,
      header_show_hijri_date: $("headerShowHijriDate").checked,
      default_slide_duration_seconds: slideDuration,
      running_text_speed_px_per_second: runningSpeed,
      theme: {
        ...currentTheme,
        ...collectTheme(),
      },
    };

    const { data, error } = await db
      .from("tv_display_profiles")
      .update(payload)
      .eq("id", profile.id)
      .select()
      .single();

    if (error) throw error;

    const index = state.profiles.findIndex((item) => item.id === data.id);
    if (index >= 0) {
      state.profiles[index] = data;
    }

    state.currentProfile = data;
    fillForm(data);

    showStatus(
      "Theme & Layout berhasil disimpan. Belum dipublish ke revision TV."
    );
  } catch (error) {
    console.error(error);
    showStatus(error?.message || "Gagal menyimpan Theme & Layout.", true);
  } finally {
    $("saveBtn").disabled = false;
  }
}

async function bootstrap() {
  buildThemeFields();

  await requireAdminSession();
  await loadProfiles();

  $("profileSelect").addEventListener("change", () => {
    const profile = state.profiles.find(
      (item) => item.id === $("profileSelect").value
    );
    if (profile) fillForm(profile);
  });

  [
    "prayerPanelSide",
    "headerShowClock",
    "headerShowMosque",
    "headerShowGregorianDate",
    "headerShowHijriDate",
  ].forEach((id) => {
    $(id).addEventListener("change", updatePreview);
  });

  $("saveBtn").addEventListener("click", saveProfile);

  $("refreshBtn").addEventListener("click", async () => {
    $("refreshBtn").disabled = true;
    try {
      await loadProfiles();
    } catch (error) {
      console.error(error);
      showStatus(error?.message || "Gagal refresh Theme & Layout.", true);
    } finally {
      $("refreshBtn").disabled = false;
    }
  });
}

bootstrap().catch((error) => {
  console.error(error);
  showStatus(error?.message || "Gagal memuat Theme & Layout.", true);
});
