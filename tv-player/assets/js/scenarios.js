import { TV_STATES } from "./states.js";

export const SCENARIOS = Object.freeze({
  NORMAL_PREVIEW: {
    label: "Normal slideshow",
    steps: [
      { state: TV_STATES.NORMAL, duration: 12 },
    ],
  },
  DAILY_PRAYER_CYCLE: {
    label: "Daily: Adhan → Iqamah → Salat",
    steps: [
      { state: TV_STATES.NORMAL, duration: 4 },
      { state: TV_STATES.PRE_ADHAN, duration: 8 },
      { state: TV_STATES.ADHAN, duration: 5 },
      { state: TV_STATES.IQAMAH_COUNTDOWN, duration: 10 },
      { state: TV_STATES.IQAMAH, duration: 4 },
      { state: TV_STATES.SALAT, duration: 10 },
      { state: TV_STATES.NORMAL, duration: 5 },
    ],
  },
  SYURUQ_ISYRAQ_CYCLE: {
    label: "Syuruq → Isyraq",
    steps: [
      { state: TV_STATES.NORMAL, duration: 4 },
      { state: TV_STATES.SYURUQ, duration: 10 },
      { state: TV_STATES.ISYRAQ, duration: 6 },
      { state: TV_STATES.NORMAL, duration: 5 },
    ],
  },
  RAMADAN_IMSAK: {
    label: "Ramadan: Imsak display",
    ramadan: true,
    steps: [
      { state: TV_STATES.NORMAL, duration: 4 },
      { state: TV_STATES.IMSAK, duration: 8 },
      { state: TV_STATES.NORMAL, duration: 5 },
    ],
  },
  FRIDAY_CYCLE: {
    label: "Friday: Pre-Adhan → Khutbah → Salat",
    steps: [
      { state: TV_STATES.NORMAL, duration: 4 },
      { state: TV_STATES.FRIDAY_PRE_ADHAN, duration: 8 },
      { state: TV_STATES.FRIDAY_KHUTBAH, duration: 12 },
      { state: TV_STATES.FRIDAY_SALAT, duration: 10 },
      { state: TV_STATES.NORMAL, duration: 5 },
    ],
  },
});
