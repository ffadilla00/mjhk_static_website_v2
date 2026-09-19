# MJHK TV — Phase 3C Runtime Device Operations Contract

## Objective

Turn the browser player into a managed device runtime without changing
ownership of the locked prayer/state engine or revision pipeline.

Phase 3C scope:

```text
Heartbeat
Command Pull
Command Validation
Safe Command Dispatch
Command ACK
Retry / Recovery
Operational Telemetry
```

Screenshot capture is intentionally deferred because browser capture and the
future Android APK have different security/runtime capabilities.

## Existing server-side contract

Gateway routes already exist for:

```text
POST /v1/device/heartbeat
GET  /v1/device/commands?limit=N
POST /v1/device/commands/:command_id/ack
```

Command ACK accepts:

```text
status = done | failed
```

The command table currently allows:

```text
sync_now
reload_player
mute
unmute
restart_app
refresh_screenshot
```

## Browser execution boundary

Browser-safe first:

```text
sync_now
reload_player
```

`sync_now` must call the locked revision synchronization path.

`reload_player` may use a small injected page-reload capability.

Do not fake success for:

```text
mute
unmute
restart_app
refresh_screenshot
```

until a real capability exists. Unsupported commands must ACK `failed` with a
bounded non-secret error.

## Subphases

### 3C-A — Runtime Operations Wiring Audit
Read-only contract inspection.

### 3C-B — Heartbeat Core
Bounded telemetry snapshot and non-blocking heartbeat loop.

### 3C-C — Command Polling Core
Strict validation, bounded batch, single-flight polling, deduplication.

### 3C-D — Dispatcher + Command ACK
Implement browser-safe commands and explicit failed ACK for unsupported ones.

### 3C-E — Runtime Recovery / Final Simulator
Retry/backoff, online/offline behavior, final end-to-end acceptance.

## Locked boundaries

Phase 3C must not change semantics of:
- TVStateEngine
- prayer/countdown transitions
- typed presentation adapter
- candidate → apply → LKG
- revision ACK

Runtime operations orchestrate around locked modules.
