import { RevisionStore } from "./revision-store.js";
import { prepareRuntimeConfig } from "./runtime-config-core.js";
import {
  adaptPresentationConfig,
  safePresentationMeta,
} from "./presentation-adapter.js";
import { PresentationBinder } from "./presentation-binding.js";

const BRIDGE_VERSION = "3B.2E-C-v1";

export function createPresentationPlayerBridge() {
  const refs = resolvePlayerRefs();

  let binder = null;
  let currentTypedConfig = null;
  let pendingState = "NORMAL";
  let binderStarted = false;

  const initialRunningText = {
    text: refs.runningText.textContent || "",
    hidden: refs.runningText.hidden,
  };

  async function initialize() {
    try {
      const store = new RevisionStore();
      const lkg = await store.loadLastKnownGood();

      if (!lkg) {
        refs.tvStage.dataset.presentationBridge = "no-lkg";
        return false;
      }

      const runtime = prepareRuntimeConfig(lkg);
      const typed = adaptPresentationConfig(runtime);

      applyPresentationConfig(typed);

      return true;
    } catch (error) {
      markBridgeError(refs.tvStage, error);
      return false;
    }
  }

  function applyPresentationConfig(typedConfig) {
    const previous = currentTypedConfig;

    try {
      const activeBinder = ensureBinder();

      activeBinder.setConfig(typedConfig);
      activeBinder.setPresentationState(pendingState);

      if (!binderStarted) {
        activeBinder.start();
        binderStarted = true;
      }

      currentTypedConfig = typedConfig;
      markReady(typedConfig);

      return getSafeMeta();
    } catch (error) {
      // Transactional UI safety:
      // if the candidate fails locally, restore the previous typed config.
      if (previous && binder) {
        try {
          binder.setConfig(previous);
          binder.setPresentationState(pendingState);
          currentTypedConfig = previous;
          markReady(previous);
        } catch {
          markBridgeError(refs.tvStage, {
            code: "presentation_restore_failed",
          });
        }
      } else {
        markBridgeError(refs.tvStage, error);
      }

      throw error;
    }
  }

  function clearPresentationConfig() {
    if (binder) {
      binder.stop();
    }

    binderStarted = false;
    binder = null;
    currentTypedConfig = null;

    const mount = refs.normalContent.querySelector("#presentationMount");
    if (mount) mount.replaceChildren();

    refs.runningText.textContent = initialRunningText.text;
    refs.runningText.hidden = initialRunningText.hidden;

    delete refs.tvStage.dataset.presentationRevision;
    delete refs.tvStage.dataset.presentationContentId;
    delete refs.tvStage.dataset.presentationContentType;

    refs.tvStage.dataset.presentationFullscreen = "false";
    refs.tvStage.dataset.presentationContentActive = "false";
    refs.tvStage.dataset.presentationBridge = "no-lkg";
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
    if (!binder || !currentTypedConfig) {
      return Object.freeze({
        ready: false,
        state: pendingState,
        revision_id: null,
        revision_number: null,
      });
    }

    const typedMeta = safePresentationMeta(currentTypedConfig);

    return Object.freeze({
      ready: true,
      revision_id: typedMeta?.revision_id ?? null,
      revision_number: typedMeta?.revision_number ?? null,
      ...binder.meta(),
    });
  }

  function ensureBinder() {
    if (binder) return binder;

    const mount = ensurePresentationMount(refs.normalContent);

    binder = new PresentationBinder({
      root: refs.tvStage,
      stage: mount,
      runningText: refs.runningText,
      emptyBehavior: "clear",
    });

    return binder;
  }

  function markReady(typedConfig) {
    const meta = safePresentationMeta(typedConfig);

    refs.tvStage.dataset.presentationBridge = "ready";
    refs.tvStage.dataset.presentationBridgeVersion = BRIDGE_VERSION;
    refs.tvStage.dataset.presentationRevision =
      String(meta?.revision_number ?? "");
    delete refs.tvStage.dataset.presentationBridgeError;
  }

  return Object.freeze({
    initialize,
    applyPresentationConfig,
    clearPresentationConfig,
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
