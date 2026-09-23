import fs from "node:fs";

const jsFile = "admin/tv-dedicated-screens.js";
const htmlFile = "admin/tv-dedicated-screens.html";
const referenceHtml = "admin/tv-running-text.html";

for (const file of [jsFile, htmlFile, referenceHtml]) {
  if (!fs.existsSync(file)) {
    throw new Error(`File tidak ditemukan: ${file}`);
  }
}

let js = fs.readFileSync(jsFile, "utf8");

js = js.replace(
  /import\s+\{\s*createClient\s*\}\s+from\s+["'][^"']*supabase-js[^"']*["'];?\s*/i,
  ""
);

js = js.replace(
  /import\s+\{\s*SUPABASE_URL\s*,\s*SUPABASE_ANON_KEY\s*\}\s+from\s+["']\.\/config\.js["'];?\s*/i,
  ""
);

js = js.replace(
  /const\s+db\s*=\s*createClient\s*\(\s*SUPABASE_URL\s*,\s*SUPABASE_ANON_KEY\s*\)\s*;?/i,
  'const db = window.mjhkSupabase;\n\nif (!db) {\n  throw new Error("mjhk_supabase_client_unavailable");\n}'
);

if (!js.includes("const db = window.mjhkSupabase;")) {
  throw new Error("Patch global Supabase client tidak berhasil diterapkan.");
}

if (/\.\/config\.js/i.test(js) || /createClient\s*\(/i.test(js)) {
  throw new Error("Legacy dedicated Supabase client wiring masih tersisa.");
}

fs.writeFileSync(jsFile, js, "utf8");
console.log("[PASS] Dedicated Screens JS memakai window.mjhkSupabase.");

const reference = fs.readFileSync(referenceHtml, "utf8");
let target = fs.readFileSync(htmlFile, "utf8");

const referencePageScriptIndex = reference.search(
  /<script[^>]+src=["'][^"']*tv-running-text\.js["'][^>]*><\/script>/i
);

if (referencePageScriptIndex < 0) {
  throw new Error("Reference page script tv-running-text.js tidak ditemukan.");
}

const referenceBeforePageScript = reference.slice(0, referencePageScriptIndex);
const scriptTags = [
  ...referenceBeforePageScript.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)
].map((m) => m[0]);

const dependencyTags = scriptTags.filter((tag) => {
  const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
  if (!srcMatch) return /mjhkSupabase|supabase/i.test(tag);

  const src = srcMatch[1];
  if (/tv-running-text\.js/i.test(src)) return false;
  return true;
});

if (dependencyTags.length === 0) {
  throw new Error("Tidak ada bootstrap dependency sebelum tv-running-text.js.");
}

const targetDedicatedScript =
  '<script type="module" src="tv-dedicated-screens.js"></script>';

if (!target.includes(targetDedicatedScript)) {
  throw new Error("Anchor tv-dedicated-screens.js tidak ditemukan.");
}

for (const tag of dependencyTags) {
  target = target.split(tag).join("");
}

const injected = `${dependencyTags.join("\n  ")}\n  ${targetDedicatedScript}`;
target = target.replace(targetDedicatedScript, injected);

fs.writeFileSync(htmlFile, target, "utf8");

console.log(
  `[PASS] ${dependencyTags.length} existing CMS bootstrap script(s) dipasang sebelum Dedicated Screens JS.`
);
console.log("[INFO] Bootstrap source: admin/tv-running-text.html");
