import { RevisionStore } from "./revision-store.js";
import { prepareRuntimeConfig } from "./runtime-config-core.js";
import {
  adaptPresentationConfig,
  safePresentationMeta,
  getPresentationContract,
} from "./presentation-adapter.js";

const store = new RevisionStore();

const refs = {
  lkg: document.querySelector("#adapterLkg"),
  contract: document.querySelector("#adapterContract"),
  result: document.querySelector("#adapterResult"),
  isolation: document.querySelector("#adapterIsolation"),
  adapt: document.querySelector("#runAdapter"),
  failure: document.querySelector("#runAdapterFailure"),
};

let lastGoodPresentation = null;

loadLkg();

refs.adapt.addEventListener("click", async () => {
  refs.adapt.disabled = true;

  try {
    const lkg = await store.loadLastKnownGood();
    if (!lkg) {
      set(refs.result, "error", "NO LKG");
      return;
    }

    const runtime = prepareRuntimeConfig(lkg);
    const presentation = adaptPresentationConfig(runtime);

    lastGoodPresentation = presentation;

    set(
      refs.result,
      "ok",
      `ADAPTER OK • ${JSON.stringify(safePresentationMeta(presentation))}`
    );
  } catch (error) {
    set(refs.result, "error", safeError(error));
  } finally {
    refs.adapt.disabled = false;
  }
});

refs.failure.addEventListener("click", async () => {
  if (!lastGoodPresentation) {
    set(
      refs.isolation,
      "warning",
      "Run Typed Adapter dulu sebelum failure test."
    );
    return;
  }

  const before = lastGoodPresentation;

  try {
    adaptPresentationConfig({
      revision_id: before.revision_id,
      revision_number: before.revision_number + 1,
      config: {
        playlist_items: [
          {
            id: "bad-item",
            type: "video",
            title: "Bad",
            duration_seconds: 10,
            fullscreen: false,
            always_show: true,
            starts_at: null,
            ends_at: null,
            payload: {},
          },
        ],
        running_text: [],
      },
    });

    set(refs.isolation, "error", "INVALID TYPE TIDAK DITOLAK");
  } catch (error) {
    const unchanged = before === lastGoodPresentation;
    const expected = error?.code === "playlist_type_unsupported";

    set(
      refs.isolation,
      unchanged && expected ? "ok" : "error",
      unchanged && expected
        ? `FAILURE ISOLATED • presentation unchanged • ${error.code}`
        : `UNEXPECTED FAILURE • ${safeError(error)}`
    );
  }
});

async function loadLkg() {
  refs.contract.textContent = JSON.stringify(getPresentationContract());

  try {
    const lkg = await store.loadLastKnownGood();
    if (!lkg) {
      set(refs.lkg, "warning", "NO LKG");
      refs.adapt.disabled = true;
      return;
    }

    set(
      refs.lkg,
      "ok",
      `revision ${lkg.revision_number} • ${lkg.revision_id} • integrity OK`
    );
  } catch (error) {
    set(refs.lkg, "error", safeError(error));
    refs.adapt.disabled = true;
  }
}

function set(element, state, text) {
  element.dataset.state = state;
  element.textContent = text;
}

function safeError(error) {
  const code = error?.code ? `${error.code} • ` : "";
  const path = error?.path ? ` • ${error.path}` : "";
  return `${error?.name || "Error"}: ${code}${error?.message || "operation failed"}${path}`;
}
