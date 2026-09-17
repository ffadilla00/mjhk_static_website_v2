import { DeviceSessionStore } from "./device-session.js";
import { RevisionClient } from "./revision-client.js";
import { RevisionStore, safeRevisionMeta } from "./revision-store.js";

const sessionStore = new DeviceSessionStore();
const revisionClient = new RevisionClient();
const revisionStore = new RevisionStore();

const refs = {
  session: document.querySelector("#storeSession"),
  fetchStatus: document.querySelector("#storeFetch"),
  candidate: document.querySelector("#candidateStatus"),
  lkg: document.querySelector("#lkgStatus"),
  fetchCandidate: document.querySelector("#fetchCandidate"),
  promoteLkg: document.querySelector("#promoteLkg"),
  reloadStore: document.querySelector("#reloadStore"),
  clearCandidate: document.querySelector("#clearCandidate"),
};

let desiredRevisionId = null;

renderSession();
refreshStoredState();

refs.fetchCandidate.addEventListener("click", async () => {
  const session = sessionStore.load();

  if (!session) {
    set(refs.fetchStatus, "error", "NO DEVICE SESSION");
    return;
  }

  refs.fetchCandidate.disabled = true;
  set(refs.fetchStatus, "checking", "FETCH + STORE CANDIDATE...");

  try {
    const result = await revisionClient.fetchDesiredRevision(session);
    desiredRevisionId = result.desiredRevisionId;

    const meta = await revisionStore.saveCandidate(
      result.response.data,
      result.desiredRevisionId
    );

    set(
      refs.fetchStatus,
      "ok",
      `HTTP ${result.response.status} • candidate stored • revision ${meta.revision_number}`
    );

    await refreshStoredState();
  } catch (error) {
    set(refs.fetchStatus, "error", safeError(error));
  } finally {
    refs.fetchCandidate.disabled = false;
  }
});

refs.promoteLkg.addEventListener("click", async () => {
  refs.promoteLkg.disabled = true;

  try {
    const candidate = await revisionStore.loadCandidate();

    if (!candidate) {
      set(refs.candidate, "error", "NO CANDIDATE");
      return;
    }

    const meta = await revisionStore.promoteCandidate(
      desiredRevisionId || candidate.revision_id
    );

    set(
      refs.lkg,
      "ok",
      JSON.stringify(meta)
    );

    await refreshStoredState();
  } catch (error) {
    set(refs.lkg, "error", safeError(error));
  } finally {
    refs.promoteLkg.disabled = false;
  }
});

refs.reloadStore.addEventListener("click", async () => {
  await refreshStoredState(true);
});

refs.clearCandidate.addEventListener("click", async () => {
  revisionStore.clearCandidate();
  await refreshStoredState();
});

function renderSession() {
  const info = sessionStore.describe();

  if (!info) {
    refs.session.textContent = "NO SESSION";
    refs.session.dataset.state = "warning";
    refs.fetchCandidate.disabled = true;
    return;
  }

  refs.session.textContent =
    `${info.deviceCode} • token present [never printed]`;
  refs.session.dataset.state = "ok";
}

async function refreshStoredState(showIntegrity = false) {
  const candidateMeta = revisionStore.candidateMeta();
  const lkgMeta = revisionStore.lkgMeta();

  if (!candidateMeta) {
    set(refs.candidate, "warning", "EMPTY");
  } else if (candidateMeta.corrupt) {
    set(refs.candidate, "error", "CORRUPT JSON");
  } else {
    set(refs.candidate, "ok", JSON.stringify(candidateMeta));
  }

  if (!lkgMeta) {
    set(refs.lkg, "warning", "EMPTY");
  } else if (lkgMeta.corrupt) {
    set(refs.lkg, "error", "CORRUPT JSON");
  } else {
    set(refs.lkg, "ok", JSON.stringify(lkgMeta));
  }

  if (!showIntegrity) return;

  try {
    const candidate = await revisionStore.loadCandidate();
    if (candidate) {
      set(
        refs.candidate,
        "ok",
        `INTEGRITY OK • ${JSON.stringify(safeRevisionMeta(candidate))}`
      );
    }
  } catch (error) {
    set(refs.candidate, "error", safeError(error));
  }

  try {
    const lkg = await revisionStore.loadLastKnownGood();
    if (lkg) {
      set(
        refs.lkg,
        "ok",
        `INTEGRITY OK • ${JSON.stringify(safeRevisionMeta(lkg))}`
      );
    }
  } catch (error) {
    set(refs.lkg, "error", safeError(error));
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
