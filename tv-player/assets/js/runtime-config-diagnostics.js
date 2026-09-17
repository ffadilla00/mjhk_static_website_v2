import { RevisionStore, safeRevisionMeta } from "./revision-store.js";
import {
  RuntimeConfigRegistry,
} from "./runtime-config.js";
import {
  prepareRuntimeConfig,
  safeSnapshotShape,
  safeRuntimeMeta,
} from "./runtime-config-core.js";

const revisionStore = new RevisionStore();
const registry = new RuntimeConfigRegistry();

const refs = {
  lkg: document.querySelector("#hydrateLkg"),
  shape: document.querySelector("#hydrateShape"),
  runtime: document.querySelector("#hydrateRuntime"),
  isolation: document.querySelector("#hydrateIsolation"),
  rollbackStatus: document.querySelector("#hydrateRollback"),
  analyze: document.querySelector("#analyzeLkg"),
  apply: document.querySelector("#applyRuntime"),
  testFailure: document.querySelector("#testFailure"),
  rollback: document.querySelector("#rollbackRuntime"),
};

refreshLkgMeta();

refs.analyze.addEventListener("click", async () => {
  try {
    const lkg = await revisionStore.loadLastKnownGood();

    if (!lkg) {
      set(refs.shape, "error", "NO LKG");
      return;
    }

    const shape = safeSnapshotShape(lkg.snapshot);
    set(
      refs.shape,
      shape.valid_root ? "ok" : "error",
      JSON.stringify(shape)
    );
  } catch (error) {
    set(refs.shape, "error", safeError(error));
  }
});

refs.apply.addEventListener("click", async () => {
  refs.apply.disabled = true;

  try {
    const lkg = await revisionStore.loadLastKnownGood();

    if (!lkg) {
      set(refs.runtime, "error", "NO LKG");
      return;
    }

    const meta = registry.applyFromLkg(lkg);

    set(
      refs.runtime,
      "ok",
      `ATOMIC APPLY OK • ${JSON.stringify(meta)}`
    );

    set(refs.rollbackStatus, "idle", "NOT RUN");
  } catch (error) {
    set(refs.runtime, "error", safeError(error));
  } finally {
    refs.apply.disabled = false;
  }
});

refs.testFailure.addEventListener("click", async () => {
  const before = registry.current();

  if (!before) {
    set(
      refs.isolation,
      "warning",
      "Apply Runtime Config dulu sebelum failure-isolation test."
    );
    return;
  }

  const beforeMeta = safeRuntimeMeta(before);

  // IMPORTANT:
  // Object literal {"__proto__": {...}} is special JavaScript syntax and does
  // not reliably create an own enumerable "__proto__" property.
  // Build a null-prototype object so the dangerous key is a real own property.
  const dangerousNested = Object.create(null);
  dangerousNested["__proto__"] = {
    polluted: true,
  };

  try {
    prepareRuntimeConfig({
      kind: "lkg",
      revision_id: before.revision_id,
      revision_number: before.revision_number + 1,
      snapshot: {
        safe: true,
        nested: dangerousNested,
      },
    });

    set(
      refs.isolation,
      "error",
      "FAILURE TEST TIDAK DITOLAK"
    );
  } catch (error) {
    const after = registry.current();
    const afterMeta = safeRuntimeMeta(after);

    const unchanged =
      before === after &&
      beforeMeta?.revision_id === afterMeta?.revision_id &&
      beforeMeta?.revision_number === afterMeta?.revision_number;

    const dangerousRejected =
      error?.code === "snapshot_dangerous_key";

    set(
      refs.isolation,
      unchanged && dangerousRejected ? "ok" : "error",
      unchanged && dangerousRejected
        ? `FAILURE ISOLATED • runtime unchanged • ${error.code}`
        : `UNEXPECTED FAILURE RESULT • ${safeError(error)}`
    );
  }
});

refs.rollback.addEventListener("click", () => {
  try {
    const meta = registry.rollback();
    set(
      refs.rollbackStatus,
      "ok",
      `ROLLBACK OK • ${JSON.stringify(meta)}`
    );
  } catch (error) {
    if (error?.code === "runtime_previous_missing") {
      set(
        refs.rollbackStatus,
        "warning",
        "EXPECTED • belum ada runtime sebelumnya untuk rollback"
      );
      return;
    }

    set(refs.rollbackStatus, "error", safeError(error));
  }
});

async function refreshLkgMeta() {
  try {
    const lkg = await revisionStore.loadLastKnownGood();

    if (!lkg) {
      set(refs.lkg, "warning", "NO LKG");
      refs.analyze.disabled = true;
      refs.apply.disabled = true;
      return;
    }

    set(
      refs.lkg,
      "ok",
      `INTEGRITY OK • ${JSON.stringify(safeRevisionMeta(lkg))}`
    );
  } catch (error) {
    set(refs.lkg, "error", safeError(error));
    refs.analyze.disabled = true;
    refs.apply.disabled = true;
  }
}

function set(element, state, text) {
  element.dataset.state = state;
  element.textContent = text;
}

function safeError(error) {
  const code = error?.code ? `${error.code} • ` : "";
  return `${error?.name || "Error"}: ${code}${error?.message || "operation failed"}`;
}
