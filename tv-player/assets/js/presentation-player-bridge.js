import { RevisionStore } from "./revision-store.js";
import { prepareRuntimeConfig } from "./runtime-config-core.js";
import {
  adaptPresentationConfig,
  safePresentationMeta,
} from "./presentation-adapter.js";
import { PresentationBinder } from "./presentation-binding.js";

const BRIDGE_VERSION = "3B.2D-C2-v1";

export function createPresentationPlayerBridge() {
  const refs = resolvePlayerRefs();

  let binder = null;
  let pendingState = "NORMAL";
  let initialized = false;

  async function initialize() {
    if (initialized) return true;

    try {
      const store = new RevisionStore();
      const lkg = await store.loadLastKnownGood();

      if (!lkg) {
        refs.tvStage.dataset.presentationBridge = "no-lkg";
        return false;
      }

      const runtime = prepareRuntimeConfig(lkg);
      const typed = adaptPresentationConfig(runtime);
      const mount = ensurePresentationMount(refs.normalContent);

      binder = new PresentationBinder({
        root: refs.tvStage,
        stage: mount,
        runningText: refs.runningText,
        emptyBehavior: "clear",
      });

      binder.setConfig(typed);
      binder.setPresentationState(pendingState);
      binder.start();

      const meta = safePresentationMeta(typed);

      refs.tvStage.dataset.presentationBridge = "ready";
      refs.tvStage.dataset.presentationBridgeVersion = BRIDGE_VERSION;
      refs.tvStage.dataset.presentationRevision =
        String(meta?.revision_number ?? "");

      initialized = true;
      return true;
    } catch (error) {
      markBridgeError(refs.tvStage, error);
      return false;
    }
  }

  function setPresentationState(state) {
    pendingState = state;

    if (!binder) return;

    try {
      binder.setPresentationState(state);
    } catch (error) {
      markBridgeError(refs.tvStage, error);
    }
  }

  function refresh() {
    if (!binder) return;
    try {
      binder.render();
    } catch (error) {
      markBridgeError(refs.tvStage, error);
    }
  }

  function getSafeMeta() {
    if (!binder) {
      return {
        ready: false,
        state: pendingState,
      };
    }

    return {
      ready: true,
      ...binder.meta(),
    };
  }

  return Object.freeze({
    initialize,
    setPresentationState,
    refresh,
    getSafeMeta,
  });
}

function resolvePlayerRefs() {
  const tvStage = document.querySelector("#tvStage");
  const normalContent = document.querySelector("#normalContent");
  const runningText = document.querySelector("#runningText");

  if (!tvStage || !normalContent || !runningText) {
    throw new Error("presentation_player_dom_contract_missing");
  }

  return {
    tvStage,
    normalContent,
    runningText,
  };
}

function ensurePresentationMount(normalContent) {
  let mount = normalContent.querySelector("#presentationMount");

  if (mount) return mount;

  mount = document.createElement("div");
  mount.id = "presentationMount";
  mount.className = "presentation-mount";
  mount.setAttribute("aria-live", "off");

  normalContent.append(mount);
  return mount;
}

function markBridgeError(stage, error) {
  stage.dataset.presentationBridge = "error";
  stage.dataset.presentationBridgeError =
    typeof error?.code === "string"
      ? error.code.slice(0, 80)
      : "bridge_error";
}
