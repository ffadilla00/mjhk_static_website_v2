import { DeviceSessionStore } from "./device-session.js";
import { RevisionClient } from "./revision-client.js";
import {
  validateRevisionPayload,
  safeRevisionSummary,
} from "./revision-validator.js";

const sessionStore = new DeviceSessionStore();
const revisionClient = new RevisionClient();

const refs = {
  session: document.querySelector("#revisionSession"),
  desired: document.querySelector("#desiredRevision"),
  fetchStatus: document.querySelector("#revisionFetchStatus"),
  validation: document.querySelector("#revisionValidation"),
  responseKeys: document.querySelector("#revisionResponseKeys"),
  probe: document.querySelector("#probeRevision"),
};

renderSession();

refs.probe.addEventListener("click", async () => {
  const session = sessionStore.load();

  if (!session) {
    set(refs.fetchStatus, "error", "NO DEVICE SESSION");
    return;
  }

  refs.probe.disabled = true;
  set(refs.fetchStatus, "checking", "BOOTSTRAP + FETCH...");
  set(refs.validation, "idle", "NOT RUN");
  refs.responseKeys.textContent = "-";

  try {
    const result = await revisionClient.fetchDesiredRevision(session);

    refs.desired.textContent = result.desiredRevisionId;

    set(
      refs.fetchStatus,
      "ok",
      `HTTP ${result.response.status} • desired revision fetched`
    );

    const validation = validateRevisionPayload(
      result.response.data,
      result.desiredRevisionId
    );

    const summary = safeRevisionSummary(validation);

    set(
      refs.validation,
      validation.ok ? "ok" : "error",
      JSON.stringify(summary)
    );

    refs.responseKeys.textContent =
      summary.response_keys.length
        ? summary.response_keys.join(", ")
        : "(none)";
  } catch (error) {
    set(refs.fetchStatus, "error", safeError(error));
  } finally {
    refs.probe.disabled = false;
  }
});

function renderSession() {
  const info = sessionStore.describe();

  if (!info) {
    refs.session.textContent = "NO SESSION";
    refs.session.dataset.state = "warning";
    refs.probe.disabled = true;
    return;
  }

  refs.session.textContent =
    `${info.deviceCode} • token present [never printed]`;
  refs.session.dataset.state = "ok";
  refs.probe.disabled = false;
}

function set(element, state, text) {
  element.dataset.state = state;
  element.textContent = text;
}

function safeError(error) {
  const status = Number.isInteger(error?.status)
    ? `HTTP ${error.status} • `
    : "";

  const code =
    error?.payload &&
    typeof error.payload === "object" &&
    typeof error.payload.error === "string"
      ? ` • ${error.payload.error}`
      : "";

  return `${status}${error?.name || "Error"}: ${error?.message || "request failed"}${code}`;
}
