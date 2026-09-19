# MJHK TV — Phase 3C-B Heartbeat Core v1

## Goal

Make the web TV player report bounded runtime telemetry through the existing
authenticated Gateway heartbeat endpoint.

```text
player runtime
→ telemetry allowlist
→ DeviceSessionStore
→ GatewayClient
→ POST /v1/device/heartbeat
→ tv_device_heartbeat
→ tv_devices
```

## Runtime behavior

Heartbeat default interval is 30 seconds.

Allowed interval range is 15 seconds to 5 minutes.

The loop is single-flight. A slow request cannot overlap another heartbeat.

Failures are contained and use bounded exponential delay up to 120 seconds.
A heartbeat failure never blocks player rendering.

## Pure core + adapter split

`runtime-heartbeat-core.js` owns:
- single-flight
- telemetry sanitization
- browser telemetry collection
- backoff
- safe result metadata

`runtime-heartbeat.js` owns only integration with:
- DeviceSessionStore
- GatewayClient
- GATEWAY_CONFIG

This keeps tests independent from browser/Gateway implementation details.

## Telemetry allowlist

Only these keys may leave the player:

```text
app_version
device_model
android_version
screen_width
screen_height
is_muted
current_state
current_content_id
current_slide_index
total_slides
remaining_seconds
last_error
```

Unknown keys are discarded.

`current_content_id` is sent only if it is a UUID. Representative IDs such as
`demo-text-01` are therefore intentionally omitted instead of causing a
PostgreSQL UUID cast failure.

## Simulator metadata

```text
app_version = mjhk-web-player-3c-b
device_model = Web TV Simulator
```

Android host metadata will replace these values in the future APK.

## Apply

```bash
node scripts/apply-tv-phase3cb-heartbeat.mjs
bash scripts/verify-tv-phase3cb-heartbeat.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Browser acceptance

Hard refresh:

```text
Ctrl + F5
```

Open:

```text
http://127.0.0.1:5501/tv-player/
```

Network should show after startup:

```text
POST /v1/device/heartbeat  200
```

and approximately every 30 seconds afterward.

The existing pending `sync_now` command is intentionally NOT consumed in
Phase 3C-B.

## Database acceptance

Run:

```text
supabase/tv/phase3c-heartbeat/01_verify_heartbeat.sql
```

Expected key fields:

```text
network_status = online
app_version = mjhk-web-player-3c-b
device_model = Web TV Simulator
screen_width = 1920
screen_height = 1080
current_state = NORMAL
last_seen_at = recent
desired_revision_id = applied_revision_id
```

Optional content/slide metadata may remain NULL when the presentation layer
does not expose a compatible value.

## Next

Phase 3C-C: command polling core around the existing 60-second command lease,
without command execution yet.
