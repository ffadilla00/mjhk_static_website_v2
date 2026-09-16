const DEFAULT_PRAYERS = Object.freeze([
  ["Subuh", "04:33"],
  ["Syuruq", "05:44"],
  ["Dzuhur", "11:52"],
  ["Ashar", "15:05"],
  ["Maghrib", "17:54"],
  ["Isya", "19:02"],
]);

const RAMADAN_PRAYERS = Object.freeze([
  ["Subuh", "04:33"],
  ["Imsak", "04:23"],
  ["Dzuhur", "11:52"],
  ["Ashar", "15:05"],
  ["Maghrib", "17:54"],
  ["Isya", "19:02"],
]);

export function scaleStage(stage) {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = `scale(${scale})`;
}

export function renderPrayerRows(container, ramadanMode) {
  const source = ramadanMode ? RAMADAN_PRAYERS : DEFAULT_PRAYERS;

  container.innerHTML = source.map(([name, time], index) => `
    <div class="prayer-row ${index === 0 ? "is-next" : ""}">
      <span class="prayer-name">${escapeHtml(name)}</span>
      <span class="prayer-time">${escapeHtml(time)}</span>
    </div>
  `).join("");
}

export function renderState(snapshot, refs) {
  const { definition } = snapshot;

  refs.currentStateCode.textContent = snapshot.state;
  refs.remainingSeconds.textContent = String(snapshot.remainingSeconds);
  refs.stateOverlay.dataset.tone = definition.tone || "normal";
  refs.stateBadge.textContent = snapshot.state.replaceAll("_", " ");
  refs.stateTitle.textContent = definition.title;
  refs.stateMessage.textContent = definition.message;

  refs.stateOverlay.classList.toggle("is-hidden", !definition.overlay);

  if (definition.countdownLabel && snapshot.remainingSeconds > 0) {
    refs.countdownBox.classList.remove("is-hidden");
    refs.countdownLabel.textContent = definition.countdownLabel;
    refs.countdownValue.textContent = formatSeconds(snapshot.remainingSeconds);
  } else {
    refs.countdownBox.classList.add("is-hidden");
  }

  renderPrayerRows(refs.prayerRows, snapshot.ramadanMode);
  refs.ramadanToggle.checked = snapshot.ramadanMode;
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

  hijriEl.textContent = "Tanggal Hijriah • Simulator";
}

function formatSeconds(total) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
