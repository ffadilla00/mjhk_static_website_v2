#!/usr/bin/env node
import fs from "node:fs";

const file = "worker-tv-mjhk/src/index.js";

if (!fs.existsSync(file)) {
  console.error(`[FAIL] ${file} tidak ditemukan`);
  process.exit(1);
}

let text = fs.readFileSync(file, "utf8");

if (text.includes("MJHK_PHASE3B1_CORS_V1")) {
  console.log("[PASS] Phase 3B.1 CORS hotfix sudah terpasang");
  process.exit(0);
}

const required = [
  'const SECURITY_HEADERS = {',
  'if (request.method === "OPTIONS") {',
  'throw new HttpError(405, "method_not_allowed");',
  'function errorResponse(err, requestId) {',
  'function json(body, status, requestId) {',
];

for (const needle of required) {
  if (!text.includes(needle)) {
    console.error(`[FAIL] Expected source marker tidak ditemukan: ${needle}`);
    console.error("Source Worker berbeda dari baseline yang direview. Patch dibatalkan.");
    process.exit(2);
  }
}

text = text.replace(
  'const VERSION = "0.1.1";',
  'const VERSION = "0.1.2";'
);

const securityEnd = `const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};`;

const corsBlock = `${securityEnd}

// MJHK_PHASE3B1_CORS_V1
const CORS_ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5501",
  "http://localhost:5501",
]);

const CORS_ALLOW_METHODS = "GET, POST, OPTIONS";
const CORS_ALLOW_HEADERS = "Content-Type, device-code, authorization";
const CORS_MAX_AGE = "86400";`;

if (!text.includes(securityEnd)) {
  console.error("[FAIL] SECURITY_HEADERS block tidak cocok dengan baseline");
  process.exit(3);
}
text = text.replace(securityEnd, corsBlock);

text = text.replace(
`      if (request.method === "OPTIONS") {
        throw new HttpError(405, "method_not_allowed");
      }`,
`      if (request.method === "OPTIONS") {
        return corsPreflight(request, requestId);
      }`
);

const fetchStart = text.indexOf("export default {");
const fetchEnd = text.indexOf("\n};", fetchStart);

if (fetchStart < 0 || fetchEnd < 0) {
  console.error("[FAIL] Tidak bisa menemukan boundary export default.fetch");
  process.exit(4);
}

let fetchBlock = text.slice(fetchStart, fetchEnd + 3);
fetchBlock = fetchBlock.replace(
  /(\breturn\s+json\([\s\S]*?,\s*requestId)\);/g,
  "$1, request);"
);
fetchBlock = fetchBlock.replace(
  /return\s+errorResponse\(err,\s*requestId\);/g,
  "return errorResponse(err, requestId, request);"
);
text = text.slice(0, fetchStart) + fetchBlock + text.slice(fetchEnd + 3);

text = text.replace(
  "function errorResponse(err, requestId) {",
  "function errorResponse(err, requestId, request) {"
);

text = text.replace(
  "return json({ error: err.code, request_id: requestId }, err.status, requestId);",
  "return json({ error: err.code, request_id: requestId }, err.status, requestId, request);"
);

text = text.replace(
  'return json({ error: "internal_error", request_id: requestId }, 500, requestId);',
  'return json({ error: "internal_error", request_id: requestId }, 500, requestId, request);'
);

text = text.replace(
  "function json(body, status, requestId) {",
  "function json(body, status, requestId, request) {"
);

text = text.replace(
`    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",`,
`    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",`
);

const helperAnchor = "function safeJson(raw) {";
if (!text.includes(helperAnchor)) {
  console.error("[FAIL] safeJson helper anchor tidak ditemukan");
  process.exit(5);
}

const corsHelpers = `function corsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  if (!origin || !CORS_ALLOWED_ORIGINS.has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Max-Age": CORS_MAX_AGE,
    "Vary": "Origin",
  };
}

function corsPreflight(request, requestId) {
  const origin = request.headers.get("Origin") || "";

  if (!CORS_ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, {
      status: 403,
      headers: {
        ...SECURITY_HEADERS,
        "X-MJHK-Request-ID": requestId,
      },
    });
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders(request),
      "X-MJHK-Request-ID": requestId,
    },
  });
}

`;

text = text.replace(helperAnchor, corsHelpers + helperAnchor);
fs.writeFileSync(file, text, "utf8");

console.log("[PASS] CORS allowlist ditambahkan");
console.log("[PASS] OPTIONS sekarang 204 untuk origin yang diizinkan");
console.log("[PASS] Response sukses + error memakai request-scoped CORS");
console.log("[PASS] Security headers existing tetap dipertahankan");
console.log("[PASS] Worker version -> 0.1.2");
console.log("RESULT: APPLIED");
