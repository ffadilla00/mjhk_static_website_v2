(() => {
  const $ = (id) => document.getElementById(id);

  const LOGICAL_WIDTH = 1920;
  const LOGICAL_HEIGHT = 1080;

  let frame = null;
  let frameWrap = null;
  let resizeObserver = null;

  function readThemeValue(key, fallback) {
    const input = $(`theme_${key}`);
    const value = input?.value?.trim();
    return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
  }

  function buildPayload() {
    return {
      layout: {
        prayerPanelPosition: $("prayerPanelSide")?.value || "left",
      },
      visibility: {
        headerShowClock: Boolean($("headerShowClock")?.checked),
        headerShowMosque: Boolean($("headerShowMosque")?.checked),
        headerShowGregorianDate: Boolean($("headerShowGregorianDate")?.checked),
        headerShowHijriDate: Boolean($("headerShowHijriDate")?.checked),
      },
      theme: {
        headerBackground: readThemeValue("header_bg", "#123f31"),
        headerText: readThemeValue("header_text", "#ffffff"),

        runningBackground: readThemeValue("running_bg", "#0c2f24"),
        runningText: readThemeValue("running_text", "#ffffff"),
        runningLabelBackground: readThemeValue("running_label_bg", "#c5a764"),
        runningLabelText: readThemeValue("running_label_text", "#0c2f24"),

        prayerPanelBackground: readThemeValue("prayer_panel_bg", "#e7efe9"),
        prayerRowBackground: readThemeValue("prayer_row_bg", "#ffffff"),
        prayerTitleText: readThemeValue("prayer_title_text", "#13231c"),
        prayerTimeText: readThemeValue("prayer_time_text", "#13231c"),

        prayerHighlightBackground: readThemeValue("prayer_highlight_bg", "#14513f"),
        prayerHighlightTitle: readThemeValue("prayer_highlight_title", "#ffffff"),
        prayerHighlightTime: readThemeValue("prayer_highlight_time", "#ffffff"),

        stageBackground: readThemeValue("canvas_bg", "#f6f0df"),
        accent: readThemeValue("accent", "#c5a764"),
      },
    };
  }

  function sendPreview() {
    if (!frame?.contentWindow) return;

    frame.contentWindow.postMessage(
      {
        type: "mjhk-tv-theme-preview",
        payload: buildPayload(),
      },
      window.location.origin
    );
  }

  function scaleFrame() {
    if (!frame || !frameWrap) return;

    const width = frameWrap.clientWidth;
    if (!width) return;

    const scale = width / LOGICAL_WIDTH;
    frame.style.transform = `scale(${scale})`;
  }

  function installFrame() {
    const mount = document.querySelector(".preview-panel .panel-body");
    if (!mount) return;

    mount.innerHTML = "";

    frameWrap = document.createElement("div");
    frameWrap.className = "tv-player-preview-viewport";

    frame = document.createElement("iframe");
    frame.className = "tv-player-preview-frame";
    frame.title = "MJHK TV Player Live Preview";
    frame.src = "../tv-player/preview.html";
    frame.loading = "eager";
    frame.setAttribute("scrolling", "no");

    frame.style.width = `${LOGICAL_WIDTH}px`;
    frame.style.height = `${LOGICAL_HEIGHT}px`;

    frameWrap.appendChild(frame);
    mount.appendChild(frameWrap);

    frame.addEventListener("load", () => {
      scaleFrame();
      window.setTimeout(sendPreview, 0);
    });

    if ("ResizeObserver" in window) {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(scaleFrame);
      resizeObserver.observe(frameWrap);
    } else {
      window.addEventListener("resize", scaleFrame);
    }

    scaleFrame();
  }

  function bindDraftInputs() {
    const selectors = [
      "#prayerPanelSide",
      "#headerShowClock",
      "#headerShowMosque",
      "#headerShowGregorianDate",
      "#headerShowHijriDate",
      "#themeFields input",
    ].join(",");

    document.addEventListener("input", (event) => {
      if (event.target.matches(selectors)) sendPreview();
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches(selectors)) sendPreview();
    });

    const profileSelect = $("profileSelect");
    if (profileSelect) {
      profileSelect.addEventListener("change", () => {
        window.setTimeout(sendPreview, 0);
      });
    }

    const refreshBtn = $("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        window.setTimeout(sendPreview, 250);
      });
    }
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== frame?.contentWindow) return;
    if (event.data?.type !== "mjhk-tv-theme-preview-ready") return;

    sendPreview();
  });

  window.mjhkThemePreviewRefresh = sendPreview;

  installFrame();
  bindDraftInputs();

  window.setTimeout(sendPreview, 300);
})();
