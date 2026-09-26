#!/usr/bin/env bash
set -u

node <<'NODE'
const OFFLINE_MS = 90 * 1000;

function effective(device, nowMs) {
  if (!device || device.enabled === false) return "unknown";
  if (!device.paired_at) return "unknown";
  if (!device.last_seen_at) return "unknown";

  const lastSeenMs =
    new Date(device.last_seen_at).getTime();

  if (!Number.isFinite(lastSeenMs)) return "unknown";

  const ageMs =
    Math.max(0, nowMs - lastSeenMs);

  return ageMs <= OFFLINE_MS
    ? "online"
    : "offline";
}

const now =
  Date.parse("2026-09-25T18:15:00+07:00");

const cases = [
  [
    "paired, last_seen 30s",
    {
      enabled: true,
      paired_at: "2026-09-25T18:00:00+07:00",
      last_seen_at: "2026-09-25T18:14:30+07:00",
    },
    "online",
  ],
  [
    "paired, exactly 90s",
    {
      enabled: true,
      paired_at: "2026-09-25T18:00:00+07:00",
      last_seen_at: "2026-09-25T18:13:30+07:00",
    },
    "online",
  ],
  [
    "paired, 91s stale",
    {
      enabled: true,
      paired_at: "2026-09-25T18:00:00+07:00",
      last_seen_at: "2026-09-25T18:13:29+07:00",
    },
    "offline",
  ],
  [
    "unpaired",
    {
      enabled: true,
      paired_at: null,
      last_seen_at: null,
    },
    "unknown",
  ],
  [
    "paired but never seen",
    {
      enabled: true,
      paired_at: "2026-09-25T18:00:00+07:00",
      last_seen_at: null,
    },
    "unknown",
  ],
];

let fail = 0;

for (const [name, device, expected] of cases) {
  const actual = effective(device, now);

  if (actual === expected) {
    console.log(`[PASS] ${name} -> ${actual}`);
  } else {
    fail++;
    console.log(
      `[FAIL] ${name} -> ${actual}, expected ${expected}`
    );
  }
}

console.log("");
console.log(`FAIL: ${fail}`);
console.log(
  fail === 0 ? "RESULT: CLEAN" : "RESULT: FAILED"
);

process.exit(fail === 0 ? 0 : 1);
NODE
