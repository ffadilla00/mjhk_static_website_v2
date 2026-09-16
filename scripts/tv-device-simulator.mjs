#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));

const gateway = String(args.gateway || "").replace(/\/+$/, "");
const deviceCode = String(args["device-code"] || "").trim();
const pairingCode = String(args["pairing-code"] || "").trim();
const screenshotPath = String(
  args.screenshot || path.resolve("fixtures/mjhk-tv-simulator-1920x1080.png"),
);

if (!/^https:\/\//i.test(gateway)) {
  die("Missing/invalid --gateway https://...");
}
if (!deviceCode) {
  die("Missing --device-code");
}
if (!pairingCode) {
  die("Missing --pairing-code");
}

let PASS = 0;
let FAIL = 0;

function pass(message) {
  PASS += 1;
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  FAIL += 1;
  console.log(`[FAIL] ${message}`);
}

console.log("=== MJHK TV TEMP DEVICE SIMULATOR ===");
console.log(`Gateway: ${gateway}`);
console.log(`Device : ${deviceCode}`);
console.log("Token  : [never printed]");
console.log();

const deviceInfo = {
  app_version: "simulator-0.1.0",
  device_model: "Windows Desktop TV Simulator",
  android_version: "SIMULATED",
  screen_width: 1920,
  screen_height: 1080,
};

const pairResponse = await request("/v1/pair/claim", {
  method: "POST",
  json: {
    pairing_code: pairingCode,
    device_info: deviceInfo,
  },
  auth: false,
});

if (pairResponse.status !== 200 || !pairResponse.body?.device_token) {
  fail(`Pairing failed (HTTP ${pairResponse.status})`);
  summaryAndExit();
}

const deviceToken = pairResponse.body.device_token;

if (pairResponse.body.device_code !== deviceCode) {
  fail("Pairing returned unexpected device_code");
  summaryAndExit();
}

pass("One-time pairing claim");

const bootstrap = await request("/v1/device/bootstrap", {
  method: "GET",
  token: deviceToken,
});

if (bootstrap.status === 200 && bootstrap.body?.device_code === deviceCode) {
  pass("Authenticated bootstrap");
} else {
  fail(`Bootstrap failed (HTTP ${bootstrap.status})`);
}

const heartbeat = await request("/v1/device/heartbeat", {
  method: "POST",
  token: deviceToken,
  json: {
    ...deviceInfo,
    is_muted: false,
    current_state: "NORMAL",
    current_content_id: null,
    current_slide_index: 0,
    total_slides: 1,
    remaining_seconds: 15,
    last_error: null,
  },
});

if (heartbeat.status === 200) {
  pass("Heartbeat + telemetry");
} else {
  fail(`Heartbeat failed (HTTP ${heartbeat.status})`);
}

const desiredRevisionId =
  heartbeat.body?.desired_revision_id ||
  bootstrap.body?.desired_revision_id ||
  null;

if (desiredRevisionId) {
  const revision = await request(
    `/v1/device/revision/${encodeURIComponent(desiredRevisionId)}`,
    {
      method: "GET",
      token: deviceToken,
    },
  );

  if (
    revision.status === 200 &&
    revision.body?.revision_id === desiredRevisionId &&
    revision.body?.snapshot?.test_mode === true
  ) {
    pass("Desired revision fetched");
  } else {
    fail(`Revision fetch failed (HTTP ${revision.status})`);
  }

  const revisionAck = await request("/v1/device/revision/ack", {
    method: "POST",
    token: deviceToken,
    json: {
      revision_id: desiredRevisionId,
      success: true,
      error_message: null,
    },
  });

  if (revisionAck.status === 200 && revisionAck.body?.acknowledged === true) {
    pass("Revision ACK");
  } else {
    fail(`Revision ACK failed (HTTP ${revisionAck.status})`);
  }
} else {
  fail("No desired revision assigned to simulator");
}

const commands = await request("/v1/device/commands?limit=10", {
  method: "GET",
  token: deviceToken,
});

if (
  commands.status === 200 &&
  Array.isArray(commands.body?.commands) &&
  commands.body.commands.length > 0
) {
  pass(`Command pull (${commands.body.commands.length} command)`);

  for (const command of commands.body.commands) {
    const ack = await request(
      `/v1/device/commands/${encodeURIComponent(command.id)}/ack`,
      {
        method: "POST",
        token: deviceToken,
        json: {
          status: "done",
        },
      },
    );

    if (ack.status === 200 && ack.body?.acknowledged === true) {
      pass(`Command ACK: ${command.command_type}`);
    } else {
      fail(`Command ACK failed: ${command.command_type}`);
    }
  }
} else {
  fail(`No command delivered (HTTP ${commands.status})`);
}

try {
  const screenshot = await fs.readFile(screenshotPath);
  const upload = await request("/v1/device/screenshot", {
    method: "POST",
    token: deviceToken,
    raw: screenshot,
    contentType: "image/png",
  });

  if (upload.status === 201 && upload.body?.stored === true) {
    pass("Screenshot upload");
  } else {
    fail(`Screenshot upload failed (HTTP ${upload.status})`);
  }
} catch (error) {
  fail(`Screenshot fixture unavailable: ${error.message}`);
}

const finalHeartbeat = await request("/v1/device/heartbeat", {
  method: "POST",
  token: deviceToken,
  json: {
    ...deviceInfo,
    is_muted: false,
    current_state: "NORMAL",
    current_content_id: null,
    current_slide_index: 0,
    total_slides: 1,
    remaining_seconds: 10,
    last_error: null,
  },
});

if (
  finalHeartbeat.status === 200 &&
  finalHeartbeat.body?.applied_revision_id === desiredRevisionId
) {
  pass("Final heartbeat sees applied revision");
} else {
  fail("Final heartbeat / applied revision mismatch");
}

summaryAndExit();

async function request(relativePath, options = {}) {
  const headers = {
    "User-Agent": "MJHK-TV-Simulator/0.1.0",
  };

  if (options.auth !== false) {
    headers.Authorization = `Bearer ${options.token}`;
    headers["X-MJHK-Device-Code"] = deviceCode;
    headers["X-MJHK-Player-Version"] = "simulator-0.1.0";
  }

  let body;

  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.raw !== undefined) {
    headers["Content-Type"] = options.contentType || "application/octet-stream";
    body = options.raw;
  }

  try {
    const response = await fetch(`${gateway}${relativePath}`, {
      method: options.method || "GET",
      headers,
      body,
    });

    const text = await response.text();
    let parsed = null;

    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 500) };
      }
    }

    return {
      status: response.status,
      body: parsed,
    };
  } catch (error) {
    return {
      status: 0,
      body: {
        error: error.message,
      },
    };
  }
}

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const value = argv[i + 1];

    if (value && !value.startsWith("--")) {
      result[key] = value;
      i += 1;
    } else {
      result[key] = true;
    }
  }

  return result;
}

function summaryAndExit() {
  console.log();
  console.log("=== SUMMARY ===");
  console.log(`PASS: ${PASS}`);
  console.log(`FAIL: ${FAIL}`);

  if (FAIL === 0) {
    console.log("RESULT: CLEAN");
    process.exit(0);
  }

  console.log("RESULT: FAIL");
  process.exit(1);
}

function die(message) {
  console.error(message);
  process.exit(2);
}
