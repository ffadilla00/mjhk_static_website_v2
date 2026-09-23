const DEFAULT_MJHK_LOGO_URL = new URL("../img/mjhk-logo.png", import.meta.url).href;

/*
 * MJHK TV — Phase 3A.1 Visual Contract
 *
 * Presentation-only contract.
 * DO NOT put trigger, priority, scheduler, countdown, or resume-policy logic here.
 * Those remain owned by the locked state engine / backend configuration.
 */

export const VISUAL_CONFIG = Object.freeze({
  identity: {
    mosqueName: "Masjid Jami' Harapan Kita",
    mosqueAddress: "Jl. Menur III No. 9A Blok A4, Kelapa Dua - Tangerang",
    logoUrl: DEFAULT_MJHK_LOGO_URL,
    fallbackLogoText: "MJHK",
  },

  layout: {
    prayerPanelPosition: "left",
  },

  theme: {
    headerBackground: "#123f31",
    headerText: "#ffffff",

    runningBackground: "#0c2f24",
    runningText: "#ffffff",
    runningLabelBackground: "#c5a764",
    runningLabelText: "#0c2f24",

    prayerPanelBackground: "#e7efe9",
    prayerRowBackground: "#ffffff",
    prayerTitleText: "#13231c",
    prayerTimeText: "#13231c",

    prayerHighlightBackground: "#14513f",
    prayerHighlightTitle: "#ffffff",
    prayerHighlightTime: "#ffffff",

    stageBackground: "#f6f0df",
    accent: "#c5a764",
  },

  // Admin CMS will eventually persist these content-type choices.
  slideshowContentTypes: Object.freeze([
    "text",
    "image",
    "image_text",
    "video",
    "finance_report",
    "gallery",
  ]),

  // State screen ownership and presentation policy.
  // assetUrl is intentionally null in Phase 3A.1; Phase 3B+ will hydrate it from revision data.
  stateScreens: Object.freeze({
    PRE_ADHAN: {
      owner: "mjhk",
      customizable: false,
      renderMode: "template",
      assetUrl: null,
      audioCue: null,
    },
    ADHAN: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: "beep",
    },
    IQAMAH_COUNTDOWN: {
      owner: "mjhk",
      customizable: false,
      renderMode: "template",
      assetUrl: null,
      audioCue: null,
    },
    IQAMAH: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: "beep",
    },
    SALAT: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: null,
    },
    PRAYER_PROHIBITION: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: null,
    },
    SYURUQ: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: null,
    },
    ISYRAQ: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: null,
    },
    IMSAK: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: null,
    },
    FRIDAY_PRE_ADHAN: {
      owner: "mjhk",
      customizable: false,
      renderMode: "template",
      assetUrl: null,
      audioCue: null,
    },
    FRIDAY_KHUTBAH: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: null,
    },
    FRIDAY_SALAT: {
      owner: "admin",
      customizable: true,
      renderMode: "asset-or-template",
      assetUrl: null,
      audioCue: null,
    },
  }),

  // Default MJHK behavior. Kept separate from the state engine so the
  // visual surface can hide/show the ticker without changing state semantics.
  runningTextByState: Object.freeze({
    NORMAL: true,
    PRE_ADHAN: true,
    ADHAN: false,
    IQAMAH_COUNTDOWN: true,
    IQAMAH: false,
    SALAT: false,
    PRAYER_PROHIBITION: false,
    SYURUQ: false,
    ISYRAQ: false,
    IMSAK: true,
    FRIDAY_PRE_ADHAN: true,
    FRIDAY_KHUTBAH: false,
    FRIDAY_SALAT: false,
  }),
});

export function getStateScreenPolicy(stateCode) {
  return VISUAL_CONFIG.stateScreens[stateCode] || {
    owner: "mjhk",
    customizable: false,
    renderMode: "template",
    assetUrl: null,
    audioCue: null,
  };
}

export function shouldShowRunningText(stateCode) {
  return VISUAL_CONFIG.runningTextByState[stateCode] !== false;
}
