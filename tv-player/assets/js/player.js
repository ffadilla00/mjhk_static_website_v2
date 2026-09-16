import { TVStateEngine } from "./engine.js";
import { TV_STATES } from "./states.js";
import { SCENARIOS } from "./scenarios.js";
import { renderState, scaleStage, updateClock } from "./ui.js";

const refs = {
  tvStage: document.querySelector("#tvStage"),
  prayerRows: document.querySelector("#prayerRows"),
  stateOverlay: document.querySelector("#stateOverlay"),
  stateBadge: document.querySelector("#stateBadge"),
  stateTitle: document.querySelector("#stateTitle"),
  stateMessage: document.querySelector("#stateMessage"),
  countdownBox: document.querySelector("#countdownBox"),
  countdownLabel: document.querySelector("#countdownLabel"),
  countdownValue: document.querySelector("#countdownValue"),
  currentStateCode: document.querySelector("#currentStateCode"),
  remainingSeconds: document.querySelector("#remainingSeconds"),
  scenarioSelect: document.querySelector("#scenarioSelect"),
  runScenario: document.querySelector("#runScenario"),
  stateSelect: document.querySelector("#stateSelect"),
  applyState: document.querySelector("#applyState"),
  ramadanToggle: document.querySelector("#ramadanToggle"),
  pauseClock: document.querySelector("#pauseClock"),
  resetPlayer: document.querySelector("#resetPlayer"),
  devPanel: document.querySelector("#devPanel"),
  toggleDevPanel: document.querySelector("#toggleDevPanel"),
  clockTime: document.querySelector("#clockTime"),
  clockDate: document.querySelector("#clockDate"),
  hijriDate: document.querySelector("#hijriDate"),
};

const engine = new TVStateEngine();

for (const [key, scenario] of Object.entries(SCENARIOS)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = scenario.label;
  refs.scenarioSelect.append(option);
}

for (const code of Object.values(TV_STATES)) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = code;
  refs.stateSelect.append(option);
}

engine.addEventListener("change", (event) => {
  renderState(event.detail, refs);
  refs.pauseClock.textContent = event.detail.paused ? "Resume Scenario" : "Pause Scenario";
});

refs.runScenario.addEventListener("click", () => {
  const scenario = SCENARIOS[refs.scenarioSelect.value];
  if (scenario) engine.runScenario(scenario);
});

refs.applyState.addEventListener("click", () => {
  engine.runningScenario = null;
  engine.setState(refs.stateSelect.value, 0);
});

refs.ramadanToggle.addEventListener("change", () => {
  engine.setRamadanMode(refs.ramadanToggle.checked);
});

refs.pauseClock.addEventListener("click", () => {
  engine.togglePause();
});

refs.resetPlayer.addEventListener("click", () => {
  engine.reset();
});

refs.toggleDevPanel.addEventListener("click", () => {
  refs.devPanel.classList.toggle("is-collapsed");
  refs.toggleDevPanel.textContent = refs.devPanel.classList.contains("is-collapsed")
    ? "Show"
    : "Hide";
});

function refreshClock() {
  updateClock(refs.clockTime, refs.clockDate, refs.hijriDate);
}

window.addEventListener("resize", () => scaleStage(refs.tvStage));

scaleStage(refs.tvStage);
refreshClock();
window.setInterval(refreshClock, 1000);
engine.start();
