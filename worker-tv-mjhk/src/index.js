const VERSION = "0.1.1";
const JSON_LIMIT = 32 * 1024;
const PAIR_LIMIT = 16 * 1024;
const SCREENSHOT_LIMIT = 5 * 1024 * 1024;
const SIGNED_MEDIA_TTL = 600;
const UPSTREAM_TIMEOUT_MS = 12000;

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    try {
      assertEnv(env);
      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (request.method === "OPTIONS") {
        throw new HttpError(405, "method_not_allowed");
      }

      if (path === "/health") {
        requireMethod(request, "GET");
        return json({
          ok: true,
          service: "mjhk-tv-gateway",
          version: VERSION,
          time: new Date().toISOString(),
        }, 200, requestId);
      }

      if (path === "/v1/pair/claim") {
        requireMethod(request, "POST");
        requireJson(request);
        const body = await readJson(request, PAIR_LIMIT);
        if (typeof body.pairing_code !== "string" || !body.pairing_code.trim()) {
          throw new HttpError(400, "pairing_code_required");
        }
        const data = await rpc(env, "tv_device_claim_pairing", {
          p_pairing_code: body.pairing_code,
          p_device_info: isObject(body.device_info) ? body.device_info : {},
        });
        return json(data, 200, requestId);
      }

      const auth = readDeviceAuth(request);

      if (path === "/v1/device/bootstrap") {
        requireMethod(request, "GET");
        const data = await bootstrap(env, auth);
        return json(data, 200, requestId);
      }

      if (path === "/v1/device/heartbeat") {
        requireMethod(request, "POST");
        requireJson(request);
        const body = await readJson(request, JSON_LIMIT);
        const data = await rpc(env, "tv_device_heartbeat", {
          p_device_code: auth.deviceCode,
          p_device_token: auth.deviceToken,
          p_telemetry: isObject(body) ? body : {},
        });
        return json(data, 200, requestId);
      }

      // IMPORTANT: exact ACK route must be matched BEFORE the dynamic
      // /v1/device/revision/:revision_id route, otherwise "ack" is treated
      // as a revision id and POST receives HTTP 405.
      if (path === "/v1/device/revision/ack") {
        requireMethod(request, "POST");
        requireJson(request);
        const body = await readJson(request, JSON_LIMIT);
        if (!isUuid(body.revision_id)) throw new HttpError(400, "invalid_revision_id");
        if (typeof body.success !== "boolean") throw new HttpError(400, "success_boolean_required");
        const data = await rpc(env, "tv_device_ack_revision", {
          p_device_code: auth.deviceCode,
          p_device_token: auth.deviceToken,
          p_revision_id: body.revision_id,
          p_success: body.success,
          p_error_message: typeof body.error_message === "string"
            ? body.error_message.slice(0, 1000)
            : null,
        });
        return json(data, 200, requestId);
      }

      if (
        path === "/v1/device/revision" ||
        /^\/v1\/device\/revision\/[0-9a-fA-F-]{36}$/.test(path)
      ) {
        requireMethod(request, "GET");
        let revisionId = null;
        if (path !== "/v1/device/revision") {
          revisionId = path.slice("/v1/device/revision/".length);
          if (!isUuid(revisionId)) throw new HttpError(400, "invalid_revision_id");
        }
        const data = await rpc(env, "tv_device_get_revision", {
          p_device_code: auth.deviceCode,
          p_device_token: auth.deviceToken,
          p_revision_id: revisionId,
        });
        return json(data, 200, requestId);
      }

      if (path === "/v1/device/commands") {
        requireMethod(request, "GET");
        const raw = Number.parseInt(url.searchParams.get("limit") || "10", 10);
        const limit = Number.isFinite(raw) ? Math.max(1, Math.min(raw, 20)) : 10;
        const data = await rpc(env, "tv_device_pull_commands", {
          p_device_code: auth.deviceCode,
          p_device_token: auth.deviceToken,
          p_limit: limit,
        });
        return json(data, 200, requestId);
      }

      const ackMatch = path.match(/^\/v1\/device\/commands\/([0-9a-fA-F-]{36})\/ack$/);
      if (ackMatch) {
        requireMethod(request, "POST");
        requireJson(request);
        const commandId = ackMatch[1];
        const body = await readJson(request, JSON_LIMIT);
        if (!isUuid(commandId)) throw new HttpError(400, "invalid_command_id");
        if (!["done", "failed"].includes(body.status)) {
          throw new HttpError(400, "invalid_command_status");
        }
        const data = await rpc(env, "tv_device_ack_command", {
          p_device_code: auth.deviceCode,
          p_device_token: auth.deviceToken,
          p_command_id: commandId,
          p_status: body.status,
          p_error_message: typeof body.error_message === "string"
            ? body.error_message.slice(0, 1000)
            : null,
        });
        return json(data, 200, requestId);
      }

      if (path === "/v1/device/screenshot") {
        requireMethod(request, "POST");
        const type = (request.headers.get("content-type") || "")
          .split(";")[0].trim().toLowerCase();
        if (!["image/webp", "image/jpeg", "image/png"].includes(type)) {
          throw new HttpError(415, "unsupported_screenshot_type");
        }

        const declared = Number(request.headers.get("content-length") || "0");
        if (declared > SCREENSHOT_LIMIT) throw new HttpError(413, "screenshot_too_large");

        const boot = await bootstrap(env, auth);
        if (!isUuid(boot.device_id)) throw new HttpError(401, "device_auth_failed");

        const bytes = await request.arrayBuffer();
        if (!bytes.byteLength) throw new HttpError(400, "empty_screenshot");
        if (bytes.byteLength > SCREENSHOT_LIMIT) throw new HttpError(413, "screenshot_too_large");

        const ext = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
        const objectPath = `${boot.device_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        await storageUpload(env, "tv-monitor", objectPath, type, bytes);

        const data = await rpc(env, "tv_device_report_screenshot", {
          p_device_code: auth.deviceCode,
          p_device_token: auth.deviceToken,
          p_storage_path: objectPath,
        });
        return json(data, 201, requestId);
      }

      const mediaMatch = path.match(/^\/v1\/device\/media\/([0-9a-fA-F-]{36})$/);
      if (mediaMatch) {
        requireMethod(request, "GET");
        await bootstrap(env, auth);
        const contentId = mediaMatch[1];
        if (!isUuid(contentId)) throw new HttpError(400, "invalid_content_id");

        const content = await fetchPublishedContent(env, contentId);
        if (!content) throw new HttpError(404, "content_not_found");

        if (content.storage_bucket && content.storage_path) {
          const signed = await signObject(
            env,
            content.storage_bucket,
            content.storage_path,
            SIGNED_MEDIA_TTL,
          );
          return json({
            content_id: content.id,
            url: signed,
            expires_in: SIGNED_MEDIA_TTL,
            source: "signed_storage",
          }, 200, requestId);
        }

        if (content.storage_url) {
          return json({
            content_id: content.id,
            url: content.storage_url,
            expires_in: null,
            source: "external_or_legacy",
          }, 200, requestId);
        }

        throw new HttpError(404, "content_media_missing");
      }

      throw new HttpError(404, "not_found");
    } catch (err) {
      return errorResponse(err, requestId);
    }
  },
};

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function assertEnv(env) {
  const url = String(env.SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
  const isNewSecret = key.startsWith("sb_secret_") && key.length >= 35;
  const isLegacyServiceRoleJwt = key.startsWith("eyJ") && key.length >= 80;

  if (!validUrl || (!isNewSecret && !isLegacyServiceRoleJwt)) {
    throw new HttpError(500, "gateway_misconfigured");
  }
}

function normalizePath(path) {
  if (!path || path === "/") return "/";
  return path.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

function requireMethod(request, method) {
  if (request.method !== method) throw new HttpError(405, "method_not_allowed");
}

function requireJson(request) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    throw new HttpError(415, "application_json_required");
  }
}

async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > maxBytes) throw new HttpError(413, "request_too_large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, "request_too_large");
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

function readDeviceAuth(request) {
  const authorization = request.headers.get("authorization") || "";
  const deviceCode = (request.headers.get("x-mjhk-device-code") || "").trim();
  if (!authorization.startsWith("Bearer ")) throw new HttpError(401, "device_auth_required");
  const deviceToken = authorization.slice(7).trim();
  if (!deviceCode || deviceCode.length > 80 || deviceToken.length < 40 || deviceToken.length > 256) {
    throw new HttpError(401, "device_auth_required");
  }
  return { deviceCode, deviceToken };
}

async function bootstrap(env, auth) {
  return rpc(env, "tv_device_bootstrap", {
    p_device_code: auth.deviceCode,
    p_device_token: auth.deviceToken,
  });
}

async function rpc(env, name, payload) {
  const res = await fetchTimed(
    `${env.SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: supabaseHeaders(env, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload || {}),
    },
  );

  const raw = await res.text();
  const data = safeJson(raw);

  if (!res.ok) {
    const message = String(data?.message || data?.error || "");
    throw mapRpcError(message, res.status);
  }

  return data ?? {};
}

async function fetchPublishedContent(env, id) {
  const qs = new URLSearchParams({
    id: `eq.${id}`,
    status: "eq.published",
    select: "id,storage_bucket,storage_path,storage_url",
    limit: "1",
  });

  const res = await fetchTimed(`${env.SUPABASE_URL}/rest/v1/tv_content?${qs.toString()}`, {
    headers: supabaseHeaders(env),
  });

  const data = safeJson(await res.text());
  if (!res.ok) throw new HttpError(502, "upstream_content_lookup_failed");
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function storageUpload(env, bucket, path, contentType, bytes) {
  const url = `${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`;
  const res = await fetchTimed(url, {
    method: "POST",
    headers: supabaseHeaders(env, {
      "Content-Type": contentType,
      "x-upsert": "true",
    }),
    body: bytes,
  });
  if (!res.ok) throw new HttpError(502, "screenshot_upload_failed");
}

async function signObject(env, bucket, path, expiresIn) {
  const url = `${env.SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`;
  const res = await fetchTimed(url, {
    method: "POST",
    headers: supabaseHeaders(env, { "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn }),
  });

  const data = safeJson(await res.text());
  if (!res.ok || !data?.signedURL) throw new HttpError(502, "media_sign_failed");
  return /^https:\/\//i.test(data.signedURL)
    ? data.signedURL
    : `${env.SUPABASE_URL}${data.signedURL}`;
}

function supabaseHeaders(env, extra = {}) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const headers = {
    apikey: key,
    ...extra,
  };

  // Legacy service_role JWTs can be sent as Bearer tokens.
  // New sb_secret_* API keys are API keys, not JWTs, so they stay on apikey only.
  if (key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}

async function fetchTimed(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) throw new HttpError(504, "upstream_timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function mapRpcError(message, status) {
  const known = [
    ["PAIRING_INVALID_OR_EXPIRED", 401, "pairing_invalid_or_expired"],
    ["DEVICE_AUTH_FAILED", 401, "device_auth_failed"],
    ["ADMIN_REQUIRED", 403, "admin_required"],
    ["REVISION_NOT_ALLOWED", 403, "revision_not_allowed"],
    ["STALE_REVISION_ACK", 409, "stale_revision_ack"],
    ["COMMAND_NOT_FOUND_OR_ALREADY_FINAL", 409, "command_conflict"],
    ["INVALID_COMMAND_ACK_STATUS", 400, "invalid_command_status"],
    ["INVALID_SCREENSHOT_PATH", 400, "invalid_screenshot_path"],
    ["DEVICE_NOT_FOUND", 404, "device_not_found"],
  ];

  for (const [needle, httpStatus, code] of known) {
    if (message.includes(needle)) return new HttpError(httpStatus, code);
  }

  if (status === 401 || status === 403) return new HttpError(502, "upstream_authorization_failed");
  return new HttpError(502, "upstream_rpc_failed");
}

function errorResponse(err, requestId) {
  if (err instanceof HttpError) {
    return json({ error: err.code, request_id: requestId }, err.status, requestId);
  }

  console.error(JSON.stringify({
    level: "error",
    request_id: requestId,
    type: err instanceof Error ? err.name : "unknown",
  }));

  return json({ error: "internal_error", request_id: requestId }, 500, requestId);
}

function json(body, status, requestId) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "X-MJHK-Request-ID": requestId,
    },
  });
}

function safeJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function encodePath(path) {
  return String(path).split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
