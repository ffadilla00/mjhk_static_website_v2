import { TV_STATES, getStateDefinition } from "./states.js";

export class TVStateEngine extends EventTarget {
  constructor() {
    super();
    this.state = TV_STATES.NORMAL;
    this.remainingSeconds = 0;
    this.ramadanMode = false;
    this.runningScenario = null;
    this.scenarioIndex = -1;
    this.paused = false;
    this._timer = null;
  }

  start() {
    if (this._timer) return;
    this._timer = window.setInterval(() => this.tick(), 1000);
    this.emit();
  }

  tick() {
    if (this.paused) return;

    if (this.remainingSeconds > 0) {
      this.remainingSeconds -= 1;

      // IMPORTANT:
      // Do not emit an expired countdown frame (00:00) while the old state
      // is still active. As soon as a scenario step reaches zero, transition
      // atomically to the next step and let setState() emit that new state.
      if (this.remainingSeconds === 0 && this.runningScenario) {
        this.advanceScenario();
        return;
      }

      this.emit();
      return;
    }

    // Covers zero-duration scenario steps and protects against any stale
    // scenario state that somehow reaches a tick with remainingSeconds = 0.
    if (this.runningScenario) {
      this.advanceScenario();
    }
  }

  setState(state, duration = 0) {
    this.state = state;
    this.remainingSeconds = Math.max(0, Number(duration) || 0);
    this.emit();
  }

  setRamadanMode(enabled) {
    this.ramadanMode = Boolean(enabled);
    this.emit();
  }

  runScenario(scenario) {
    this.runningScenario = scenario;
    this.scenarioIndex = -1;
    this.paused = false;

    if (typeof scenario.ramadan === "boolean") {
      this.ramadanMode = scenario.ramadan;
    }

    this.advanceScenario();
  }

  advanceScenario() {
    if (!this.runningScenario) return;

    this.scenarioIndex += 1;

    if (this.scenarioIndex >= this.runningScenario.steps.length) {
      this.runningScenario = null;
      this.scenarioIndex = -1;
      this.setState(TV_STATES.NORMAL, 0);
      return;
    }

    const step = this.runningScenario.steps[this.scenarioIndex];
    this.setState(step.state, step.duration);
  }

  reset() {
    this.runningScenario = null;
    this.scenarioIndex = -1;
    this.paused = false;
    this.ramadanMode = false;
    this.setState(TV_STATES.NORMAL, 0);
  }

  togglePause() {
    this.paused = !this.paused;
    this.emit();
    return this.paused;
  }

  snapshot() {
    return {
      state: this.state,
      definition: getStateDefinition(this.state),
      remainingSeconds: this.remainingSeconds,
      ramadanMode: this.ramadanMode,
      paused: this.paused,
    };
  }

  emit() {
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }));
  }
}
