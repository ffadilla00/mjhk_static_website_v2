import { VISUAL_CONFIG } from "./visual-config.js";
import { applyVisualConfig } from "./ui.js";

const $ = (selector) => document.querySelector(selector);

const refs = {
  tvStage: $("#tvStage"),
  tvBody: $("#tvBody"),
  prayerPanel: $("#prayerPanel"),
  prayerRows: $("#prayerRows"),
  prayerPositionSelect: $("#prayerPositionSelect"),
  mosqueLogo: $("#mosqueLogo"),
  mosqueLogoFallback: $("#mosqueLogoFallback"),
  mosqueName: $("#mosqueName"),
  mosqueAddress: $("#mosqueAddress"),
  clockTime: $("#clockTime"),
  clockDate: $("#clockDate"),
  hijriDate: $("#hijriDate"),
  devPanel: $("#devPanel"),
};

document.documentElement.dataset.playerMode = "preview";

if (refs.devPanel) {
  refs.devPanel.hidden = true;
  refs.devPanel.style.display = "none";
}

function renderStaticPrayerRows() {
  if (!refs.prayerRows) return;

  const rows = [
    ["Subuh", "04:33", false],
    ["Syuruq", "05:44", false],
    ["Dzuhur", "11:52", false],
    ["Ashar", "15:05", false],
    ["Maghrib", "17:54", true],
    ["Isya", "19:02", false],
  ];

  refs.prayerRows.innerHTML = "";

  for (const [name, time, isNext] of rows) {
    const row = document.createElement("div");
    row.className = `prayer-row${isNext ? " is-next" : ""}`;

    const nameEl = document.createElement("span");
    nameEl.className = "prayer-name";
    nameEl.textContent = name;

    const timeEl = document.createElement("strong");
    timeEl.className = "prayer-time";
    timeEl.textContent = time;

    row.append(nameEl, timeEl);
    refs.prayerRows.appendChild(row);
  }
}

function renderPreviewClock() {
  if (refs.clockTime) refs.clockTime.textContent = "17.05";
  if (refs.clockDate) refs.clockDate.textContent = "Rabu, 23 September 2026";
  if (refs.hijriDate) refs.hijriDate.textContent = "Tanggal Hijriah • Preview";
}

function setParentVisible(node, visible) {
  if (!node) return;
  const target = node.parentElement || node;
  target.style.display = visible ? "" : "none";
}

function applyVisibility(visibility = {}) {
  const showClock = visibility.headerShowClock !== false;
  const showMosque = visibility.headerShowMosque !== false;
  const showGregorian = visibility.headerShowGregorianDate !== false;
  const showHijri = visibility.headerShowHijriDate !== false;

  setParentVisible(refs.clockTime, showClock);

  if (refs.clockDate) {
    refs.clockDate.style.display = showClock && showGregorian ? "" : "none";
  }

  setParentVisible(refs.mosqueName, showMosque);

  if (refs.hijriDate) {
    refs.hijriDate.style.display = showHijri ? "" : "none";
  }
}

function normalizePreviewConfig(payload = {}) {
  return {
    identity: {
      ...VISUAL_CONFIG.identity,
    },
    layout: {
      ...VISUAL_CONFIG.layout,
      ...(payload.layout || {}),
    },
    theme: {
      ...VISUAL_CONFIG.theme,
      ...(payload.theme || {}),
    },
  };
}

function applyDraft(payload = {}) {
  const visualConfig = normalizePreviewConfig(payload);
  applyVisualConfig(refs, visualConfig);
  applyVisibility(payload.visibility || {});
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.source !== window.parent) return;

  const data = event.data;
  if (!data || data.type !== "mjhk-tv-theme-preview") return;

  applyDraft(data.payload || {});
});

renderStaticPrayerRows();
renderPreviewClock();
applyDraft({
  layout: VISUAL_CONFIG.layout,
  theme: VISUAL_CONFIG.theme,
  visibility: {
    headerShowClock: true,
    headerShowMosque: true,
    headerShowGregorianDate: true,
    headerShowHijriDate: true,
  },
});

window.parent.postMessage(
  { type: "mjhk-tv-theme-preview-ready" },
  window.location.origin
);
