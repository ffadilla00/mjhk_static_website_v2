import {
  activePlaylistItems,
  runningTextLine,
  PRESENTATION_STATES,
} from "./presentation-scheduler.js";

export class PresentationBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PresentationBindingError";
    this.code = code;
  }
}

export class PresentationBinder {
  #config = null;
  #state = "NORMAL";
  #items = [];
  #index = 0;
  #timer = null;
  #started = false;

  constructor({root, stage, runningText, emptyBehavior="preserve", nowProvider=()=>new Date()}) {
    assertElement(root, "root");
    assertElement(stage, "stage");
    assertElement(runningText, "runningText");
    this.root = root;
    this.stage = stage;
    this.runningText = runningText;
    this.emptyBehavior = emptyBehavior;
    this.nowProvider = nowProvider;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.playlist_items) || !Array.isArray(config.running_text))
      throw new PresentationBindingError("presentation_config_invalid","Typed presentation config invalid.");
    if (!Object.isFrozen(config))
      throw new PresentationBindingError("presentation_config_not_frozen","Binder only accepts immutable typed config.");
    this.#config = config;
    this.#index = 0;
    this.#refreshItems();
    this.render();
  }

  setPresentationState(state) {
    if (!PRESENTATION_STATES.includes(state))
      throw new PresentationBindingError("presentation_state_invalid",`Unknown presentation state: ${state}`);
    this.#state = state;
    this.root.dataset.presentationState = state;
    this.#index = 0;
    this.#refreshItems();
    this.render();
  }

  start() { this.#started = true; this.render(); }
  stop() { this.#started = false; this.#clearTimer(); }

  next() {
    if (this.#state !== "NORMAL" || this.#items.length === 0) return;
    this.#index = (this.#index + 1) % this.#items.length;
    this.render();
  }

  render() {
    if (!this.#config) return;
    this.#renderRunningText();

    if (this.#state !== "NORMAL") {
      this.#clearTimer();
      this.root.dataset.presentationFullscreen = "false";
      this.root.dataset.presentationContentActive = "false";
      return;
    }

    this.#refreshItems();

    if (this.#items.length === 0) {
      this.#clearTimer();
      this.root.dataset.presentationFullscreen = "false";
      this.root.dataset.presentationContentActive = "false";
      if (this.emptyBehavior === "clear") this.stage.replaceChildren();
      return;
    }

    if (this.#index >= this.#items.length) this.#index = 0;

    const item = this.#items[this.#index];

    this.stage.replaceChildren(renderItem(item));

    this.root.dataset.presentationFullscreen = item.fullscreen ? "true" : "false";
    this.root.dataset.presentationContentActive = "true";
    this.root.dataset.presentationContentType = item.type;
    this.root.dataset.presentationContentId = item.id;

    this.#scheduleNext(item.duration_seconds);
  }

  meta() {
    return {
      state: this.#state,
      active_playlist_count: this.#items.length,
      current_index: this.#items.length ? this.#index : null,
      current_type: this.#items[this.#index]?.type ?? null,
      fullscreen: this.root.dataset.presentationFullscreen === "true",
      running_text_active: Boolean(this.runningText.textContent?.trim()),
      started: this.#started,
    };
  }

  #refreshItems() {
    this.#items = (this.#config && this.#state === "NORMAL")
      ? activePlaylistItems(this.#config, this.nowProvider())
      : [];
  }

  #renderRunningText() {
    const text = runningTextLine(this.#config, this.#state, this.nowProvider());
    this.runningText.textContent = text;
    this.runningText.hidden = !text;
    this.root.dataset.presentationRunningText = text ? "active" : "hidden";
  }

  #scheduleNext(seconds) {
    this.#clearTimer();
    if (!this.#started || this.#items.length <= 1) return;

    this.#timer = setTimeout(() => {
      this.#index = (this.#index + 1) % this.#items.length;
      this.render();
    }, seconds * 1000);
  }

  #clearTimer() {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}

function renderItem(item) {
  const article = document.createElement("article");
  article.className = `mjhk-bound-content mjhk-bound-content--${item.type}`;
  article.dataset.contentId = item.id;

  if (item.type === "image") {
    article.append(makeImage(item.payload.image_url, item.payload.alt_text));
  } else if (item.type === "text") {
    article.append(makeText(item.payload.heading, item.payload.body));
  } else if (item.type === "image_text") {
    const image = makeImage(item.payload.image_url, item.title);
    image.classList.add("mjhk-bound-content__image");
    article.append(image, makeText(item.payload.heading, item.payload.body));
  } else {
    throw new PresentationBindingError(
      "presentation_type_unreachable",
      `Unexpected type: ${item.type}`
    );
  }

  return article;
}

function makeImage(src, alt) {
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt || "";
  image.decoding = "async";
  image.loading = "eager";
  image.referrerPolicy = "no-referrer";

  image.addEventListener("error", () => {
    const host = image.closest(".mjhk-bound-content");

    image.hidden = true;
    image.removeAttribute("src");
    image.alt = "";

    if (!host) return;

    host.classList.add("has-media-error");

    if (host.querySelector(".mjhk-media-fallback")) return;

    const fallback = document.createElement("div");
    fallback.className = "mjhk-media-fallback";
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", "Media gambar tidak tersedia");

    const mark = document.createElement("div");
    mark.className = "mjhk-media-fallback__mark";
    mark.textContent = "MJHK";

    const title = document.createElement("strong");
    title.textContent = "Media gambar tidak tersedia";

    const note = document.createElement("span");
    note.textContent = "Konten akan dilanjutkan secara otomatis.";

    fallback.append(mark, title, note);
    host.prepend(fallback);
  }, { once: true });

  return image;
}

function makeText(heading, body) {
  const wrap = document.createElement("div");
  wrap.className = "mjhk-bound-content__text";

  if (heading) {
    const h = document.createElement("h2");
    h.textContent = heading;
    wrap.append(h);
  }

  if (body) {
    const p = document.createElement("p");
    p.textContent = body;
    wrap.append(p);
  }

  return wrap;
}

function assertElement(value, name) {
  if (!value || typeof value.replaceChildren !== "function")
    throw new PresentationBindingError(
      "presentation_element_required",
      `${name} element required.`
    );
}
