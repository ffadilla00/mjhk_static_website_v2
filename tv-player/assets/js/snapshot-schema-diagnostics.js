import { RevisionStore, safeRevisionMeta } from "./revision-store.js";
import { summarizeTypedContract } from "./snapshot-shape-inspector.js";

const revisionStore = new RevisionStore();

const refs = {
  lkg: document.querySelector("#schemaLkg"),
  top: document.querySelector("#schemaTop"),
  playlist: document.querySelector("#schemaPlaylist"),
  runningText: document.querySelector("#schemaRunningText"),
  full: document.querySelector("#schemaFull"),
  inspect: document.querySelector("#inspectSchema"),
};

loadLkgMeta();

refs.inspect.addEventListener("click", async () => {
  refs.inspect.disabled = true;

  try {
    const lkg = await revisionStore.loadLastKnownGood();

    if (!lkg) {
      set(refs.full, "error", "NO LKG");
      return;
    }

    const contract = summarizeTypedContract(lkg.snapshot);

    if (!contract.ok) {
      set(refs.full, "error", contract.error || "SCHEMA INSPECTION FAILED");
      return;
    }

    set(
      refs.top,
      "ok",
      JSON.stringify(contract.top_level_keys)
    );

    set(
      refs.playlist,
      contract.playlist_items?.present ? "ok" : "warning",
      JSON.stringify(contract.playlist_items)
    );

    set(
      refs.runningText,
      contract.running_text?.present ? "ok" : "warning",
      JSON.stringify(contract.running_text)
    );

    set(
      refs.full,
      "ok",
      JSON.stringify(contract, null, 2)
    );
  } catch (error) {
    set(refs.full, "error", safeError(error));
  } finally {
    refs.inspect.disabled = false;
  }
});

async function loadLkgMeta() {
  try {
    const lkg = await revisionStore.loadLastKnownGood();

    if (!lkg) {
      set(refs.lkg, "warning", "NO LKG");
      refs.inspect.disabled = true;
      return;
    }

    set(
      refs.lkg,
      "ok",
      `INTEGRITY OK • ${JSON.stringify(safeRevisionMeta(lkg))}`
    );
  } catch (error) {
    set(refs.lkg, "error", safeError(error));
    refs.inspect.disabled = true;
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
