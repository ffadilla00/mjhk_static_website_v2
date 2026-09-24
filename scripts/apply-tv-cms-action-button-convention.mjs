#!/usr/bin/env node
import fs from "node:fs";

const adminCss = "admin/tv-admin.css";
const prayerHtml = "admin/tv-prayer-settings.html";
const themeHtml = "admin/tv-theme-layout.html";

for (const f of [adminCss, prayerHtml, themeHtml]) {
  if (!fs.existsSync(f)) throw new Error(`${f} missing`);
}

const SAVE_CLASS = "btn-save";
const CANCEL_CLASS = "btn-cancel";

function addClassToButtonById(html, id, className) {
  const re = new RegExp(
    `(<button\\b[^>]*\\bid=["']${id}["'][^>]*\\bclass=["'])([^"']*)(["'][^>]*>)`,
    "i"
  );

  if (!re.test(html)) {
    // support class before id
    const reverse = new RegExp(
      `(<button\\b[^>]*\\bclass=["'])([^"']*)(["'][^>]*\\bid=["']${id}["'][^>]*>)`,
      "i"
    );

    if (!reverse.test(html)) {
      throw new Error(`button #${id} not found with class attribute`);
    }

    return html.replace(reverse, (_, a, classes, b) => {
      const set = new Set(classes.split(/\s+/).filter(Boolean));
      set.add(className);
      return `${a}${[...set].join(" ")}${b}`;
    });
  }

  return html.replace(re, (_, a, classes, b) => {
    const set = new Set(classes.split(/\s+/).filter(Boolean));
    set.add(className);
    return `${a}${[...set].join(" ")}${b}`;
  });
}

function addClassToButtonByText(html, text, className) {
  const re = new RegExp(
    `(<button\\b[^>]*\\bclass=["'])([^"']*)(["'][^>]*>\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<\\/button>)`,
    "i"
  );

  if (!re.test(html)) {
    throw new Error(`button text "${text}" not found`);
  }

  return html.replace(re, (_, a, classes, b) => {
    const set = new Set(classes.split(/\s+/).filter(Boolean));
    set.add(className);
    return `${a}${[...set].join(" ")}${b}`;
  });
}

// Prayer Settings: exact known IDs.
let prayer = fs.readFileSync(prayerHtml, "utf8");
prayer = addClassToButtonById(prayer, "saveGlobalBtn", SAVE_CLASS);
prayer = addClassToButtonById(prayer, "savePrayerRulesBtn", SAVE_CLASS);
fs.writeFileSync(prayerHtml, prayer);
console.log("[PASS] Prayer Settings save buttons styled");

// Theme & Layout: use visible text to avoid coupling to an old button id.
let theme = fs.readFileSync(themeHtml, "utf8");
theme = addClassToButtonByText(theme, "Simpan Perubahan", SAVE_CLASS);
fs.writeFileSync(themeHtml, theme);
console.log("[PASS] Theme & Layout save button styled");

// Canonical shared UI convention.
let css = fs.readFileSync(adminCss, "utf8");
const marker = "/* MJHK TV CMS action button convention v1 */";

if (!css.includes(marker)) {
  css += `

${marker}
.btn.btn-save,
button.btn-save {
  background: #1f7a4d;
  border-color: #1f7a4d;
  color: #ffffff;
}

.btn.btn-save:hover:not(:disabled),
button.btn-save:hover:not(:disabled) {
  background: #19643f;
  border-color: #19643f;
}

.btn.btn-cancel,
button.btn-cancel {
  background: #d97706;
  border-color: #d97706;
  color: #ffffff;
}

.btn.btn-cancel:hover:not(:disabled),
button.btn-cancel:hover:not(:disabled) {
  background: #b85f05;
  border-color: #b85f05;
}

.btn.btn-save:disabled,
.btn.btn-cancel:disabled,
button.btn-save:disabled,
button.btn-cancel:disabled {
  opacity: .62;
  cursor: not-allowed;
}
`;
  fs.writeFileSync(adminCss, css);
  console.log("[PASS] canonical save/cancel color convention appended");
} else {
  console.log("[SKIP] action button convention already present");
}
