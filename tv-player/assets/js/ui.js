import {
  VISUAL_CONFIG,
  getStateScreenPolicy,
  shouldShowRunningText,
} from "./visual-config.js";

const DEFAULT_PRAYERS = Object.freeze([
  ["Subuh", "04:33"],
  ["Syuruq", "05:44"],
  ["Dzuhur", "11:52"],
  ["Ashar", "15:05"],
  ["Maghrib", "17:54"],
  ["Isya", "19:02"],
]);

// Per Phase 1 requirement, the display SLOT that normally says Syuruq
// changes to Imsak during Ramadan. The row order intentionally remains
// identical to the normal panel.
const RAMADAN_PRAYERS = Object.freeze([
  ["Subuh", "04:33"],
  ["Imsak", "04:23"],
  ["Dzuhur", "11:52"],
  ["Ashar", "15:05"],
  ["Maghrib", "17:54"],
  ["Isya", "19:02"],
]);

let lastVisualState = null;

export function scaleStage(stage) {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = `scale(${scale})`;
}

export function applyVisualConfig(refs, config = VISUAL_CONFIG) {
  const root = refs.tvStage;

  root.style.setProperty("--cfg-header-bg", config.theme.headerBackground);
  root.style.setProperty("--cfg-header-text", config.theme.headerText);
  root.style.setProperty("--cfg-running-bg", config.theme.runningBackground);
  root.style.setProperty("--cfg-running-text", config.theme.runningText);
  root.style.setProperty("--cfg-running-label-bg", config.theme.runningLabelBackground);
  root.style.setProperty("--cfg-running-label-text", config.theme.runningLabelText);
  root.style.setProperty("--cfg-prayer-panel-bg", config.theme.prayerPanelBackground);
  root.style.setProperty("--cfg-prayer-row-bg", config.theme.prayerRowBackground);
  root.style.setProperty("--cfg-prayer-title", config.theme.prayerTitleText);
  root.style.setProperty("--cfg-prayer-time", config.theme.prayerTimeText);
  root.style.setProperty("--cfg-prayer-highlight-bg", config.theme.prayerHighlightBackground);
  root.style.setProperty("--cfg-prayer-highlight-title", config.theme.prayerHighlightTitle);
  root.style.setProperty("--cfg-prayer-highlight-time", config.theme.prayerHighlightTime);
  root.style.setProperty("--cfg-stage-bg", config.theme.stageBackground);
  root.style.setProperty("--cfg-accent", config.theme.accent);

  refs.mosqueName.textContent = config.identity.mosqueName;
  refs.mosqueAddress.textContent = config.identity.mosqueAddress;

  if (config.identity.logoUrl) {
    refs.mosqueLogo.src = config.identity.logoUrl;
    refs.mosqueLogo.alt = `Logo ${config.identity.mosqueName}`;
    refs.mosqueLogo.classList.remove("is-hidden");
    refs.mosqueLogoFallback.classList.add("is-hidden");
  } else {
    refs.mosqueLogo.removeAttribute("src");
    refs.mosqueLogo.classList.add("is-hidden");
    refs.mosqueLogoFallback.textContent = config.identity.fallbackLogoText;
    refs.mosqueLogoFallback.classList.remove("is-hidden");
  }

  setPrayerPanelPosition(refs, config.layout.prayerPanelPosition);
}

export function setPrayerPanelPosition(refs, position) {
  const resolved = position === "right" ? "right" : "left";
  refs.tvBody.dataset.prayerPosition = resolved;
  refs.prayerPositionSelect.value = resolved;
}

export function renderPrayerRows(container, ramadanMode, now = new Date()) {
  const source = ramadanMode ? RAMADAN_PRAYERS : DEFAULT_PRAYERS;
  const highlightedName = getNextPrayerName(source, now);

  container.innerHTML = source.map(([name, time]) => `
    <div class="prayer-row ${name === highlightedName ? "is-next" : ""}">
      <span class="prayer-name">${escapeHtml(name)}</span>
      <span class="prayer-time">${escapeHtml(time)}</span>
    </div>
  `).join("");
}

export function renderState(snapshot, refs) {
  const { definition } = snapshot;
  const screenPolicy = getStateScreenPolicy(snapshot.state);

  refs.currentStateCode.textContent = snapshot.state;
  refs.remainingSeconds.textContent = String(snapshot.remainingSeconds);
  refs.stateOverlay.dataset.tone = definition.tone || "normal";
  refs.stateOverlay.dataset.owner = screenPolicy.owner;
  refs.stateOverlay.dataset.renderMode = screenPolicy.renderMode;
  refs.stateBadge.textContent = snapshot.state.replaceAll("_", " ");
  refs.stateTitle.textContent = definition.title;
  refs.stateMessage.textContent = definition.message;

  applyStateAsset(refs.stateOverlay, screenPolicy);

  refs.stateOverlay.classList.toggle("is-hidden", !definition.overlay);

  if (definition.countdownLabel && snapshot.remainingSeconds > 0) {
    refs.countdownBox.classList.remove("is-hidden");
    refs.countdownLabel.textContent = definition.countdownLabel;
    refs.countdownValue.textContent = formatSeconds(snapshot.remainingSeconds);
  } else {
    refs.countdownBox.classList.add("is-hidden");
  }

  const runningTextVisible = shouldShowRunningText(snapshot.state);
  refs.tvStage.classList.toggle("running-text-hidden", !runningTextVisible);

  renderPrayerRows(refs.prayerRows, snapshot.ramadanMode, new Date());
  refs.ramadanToggle.checked = snapshot.ramadanMode;

  if (lastVisualState !== snapshot.state && definition.overlay) {
    restartStateTransition(refs.stateOverlay);
  }
  lastVisualState = snapshot.state;
}

export function updateClock(timeEl, dateEl, hijriEl) {
  const now = new Date();

  timeEl.textContent = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  dateEl.textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  // Placeholder until Phase 3B/3C config/revision supplies the authoritative
  // Hijri date + adjustment.
  hijriEl.textContent = "Tanggal Hijriah • Simulator";
}

function applyStateAsset(stateOverlay, policy) {
  const assetUrl = typeof policy.assetUrl === "string" && policy.assetUrl.trim()
    ? policy.assetUrl.trim()
    : "";

  stateOverlay.classList.toggle("has-state-asset", Boolean(assetUrl));
  stateOverlay.style.removeProperty("--state-asset");

  if (assetUrl) {
    stateOverlay.style.setProperty("--state-asset", `url("${cssUrl(assetUrl)}")`);
  }
}

function restartStateTransition(element) {
  element.classList.remove("state-enter");
  void element.offsetWidth;
  element.classList.add("state-enter");
}

function getNextPrayerName(prayers, now) {
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  const chronological = prayers
    .map(([name, time]) => ({
      name,
      minutes: toMinutes(time),
    }))
    .sort((a, b) => a.minutes - b.minutes);

  const upcoming = chronological.find((item) => item.minutes >= currentMinutes);
  return upcoming?.name || chronological[0]?.name || "";
}

function toMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (hours * 60) + minutes;
}

function formatSeconds(total) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function cssUrl(value) {
  return String(value).replaceAll('"', '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
