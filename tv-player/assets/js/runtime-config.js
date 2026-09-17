import {
  prepareRuntimeConfig,
  safeRuntimeMeta,
  RuntimeConfigError,
} from "./runtime-config-core.js";

export class RuntimeConfigRegistry {
  #current = null;
  #previous = null;

  constructor({ eventTarget = globalThis } = {}) {
    this.eventTarget = eventTarget;
  }

  current() {
    return this.#current;
  }

  previous() {
    return this.#previous;
  }

  currentMeta() {
    return safeRuntimeMeta(this.#current);
  }

  hasActiveConfig() {
    return Boolean(this.#current);
  }

  applyFromLkg(lkgRecord) {
    // Preparation + validation happens before touching active runtime.
    const candidate = prepareRuntimeConfig(lkgRecord);

    const oldCurrent = this.#current;

    // Atomic in-memory swap: after this line, readers see the new frozen config.
    this.#previous = oldCurrent;
    this.#current = candidate;

    this.#emit("mjhk:runtime-config-changed", {
      previous: safeRuntimeMeta(oldCurrent),
      current: safeRuntimeMeta(candidate),
    });

    return this.currentMeta();
  }

  rollback() {
    if (!this.#previous) {
      throw new RuntimeConfigError(
        "runtime_previous_missing",
        "Tidak ada runtime config sebelumnya untuk rollback."
      );
    }

    const failedCurrent = this.#current;
    const restored = this.#previous;

    this.#current = restored;
    this.#previous = null;

    this.#emit("mjhk:runtime-config-rollback", {
      replaced: safeRuntimeMeta(failedCurrent),
      current: safeRuntimeMeta(restored),
    });

    return this.currentMeta();
  }

  clearForDiagnostics() {
    this.#current = null;
    this.#previous = null;
  }

  #emit(type, detail) {
    if (
      !this.eventTarget ||
      typeof this.eventTarget.dispatchEvent !== "function"
    ) {
      return;
    }

    if (typeof CustomEvent === "function") {
      this.eventTarget.dispatchEvent(new CustomEvent(type, { detail }));
      return;
    }

    if (typeof Event === "function") {
      const event = new Event(type);
      Object.defineProperty(event, "detail", {
        value: detail,
        enumerable: true,
      });
      this.eventTarget.dispatchEvent(event);
    }
  }
}
