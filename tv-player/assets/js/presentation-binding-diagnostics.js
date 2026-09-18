import { RevisionStore } from "./revision-store.js";
import { prepareRuntimeConfig } from "./runtime-config-core.js";
import { adaptPresentationConfig, safePresentationMeta } from "./presentation-adapter.js";
import { PresentationBinder } from "./presentation-binding.js";

const store = new RevisionStore();

const refs = {
  root: document.querySelector("#bindingSurface"),
  stage: document.querySelector("#bindingStage"),
  running: document.querySelector("#bindingRunningText"),
  status: document.querySelector("#bindingStatus"),
  meta: document.querySelector("#bindingMeta"),
  state: document.querySelector("#bindingState"),
  load: document.querySelector("#bindingLoad"),
  applyState: document.querySelector("#bindingApplyState"),
  next: document.querySelector("#bindingNext"),
  start: document.querySelector("#bindingStart"),
  stop: document.querySelector("#bindingStop"),
};

const binder = new PresentationBinder({
  root: refs.root,
  stage: refs.stage,
  runningText: refs.running,
  emptyBehavior: "clear",
});

refs.load.addEventListener("click", async () => {
  try {
    const lkg = await store.loadLastKnownGood();
    if (!lkg) throw new Error("NO LKG");

    const typed = adaptPresentationConfig(prepareRuntimeConfig(lkg));
    binder.setConfig(typed);
    binder.setPresentationState(refs.state.value);

    refs.status.dataset.state = "ok";
    refs.status.textContent =
      `BOUND OK • ${JSON.stringify(safePresentationMeta(typed))}`;
    refs.meta.textContent = JSON.stringify(binder.meta());
  } catch (error) {
    refs.status.dataset.state = "error";
    refs.status.textContent =
      `${error.name}: ${error.code || ""} ${error.message}`;
  }
});

refs.applyState.addEventListener("click", () => {
  binder.setPresentationState(refs.state.value);
  refs.meta.textContent = JSON.stringify(binder.meta());
});

refs.next.addEventListener("click", () => {
  binder.next();
  refs.meta.textContent = JSON.stringify(binder.meta());
});

refs.start.addEventListener("click", () => {
  binder.start();
  refs.meta.textContent = JSON.stringify(binder.meta());
});

refs.stop.addEventListener("click", () => {
  binder.stop();
  refs.meta.textContent = JSON.stringify(binder.meta());
});
