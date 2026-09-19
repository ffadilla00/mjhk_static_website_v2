# MJHK TV — Phase 3C-E Runtime Recovery + Final Simulator Acceptance v1

## Goal

Close Phase 3C with recovery behavior around the already-locked runtime
operations.

This phase does not add new command capabilities.

It adds:

```text
command ACK retry
browser offline / online recovery
final locked regression gate
final simulator acceptance
```

## 1. Command ACK recovery

If command execution finishes but command ACK transport fails:

```text
dispatcher → ack_failed
coordinator keeps HOLD
coordinator retries same held batch
bounded backoff:
5s → 15s → 60s → 120s
```

`sync_now` is safe to retry because it is idempotent.

`reload_player` is also safe because the actual page reload occurs only after
ACK succeeds. An ACK failure therefore means no reload happened yet.

When the retry ACK succeeds:

```text
held batch clears
poller HOLD releases
normal polling resumes
```

## 2. Lost ACK response recovery

A network failure can theoretically happen after the server committed the ACK
but before the browser received the response.

A retry can then receive:

```text
COMMAND_NOT_FOUND_OR_ALREADY_FINAL
```

The runtime treats that specific server result as terminal/acknowledged.

This prevents an endless retry loop after an ACK was already committed.

## 3. Browser offline / online recovery

A runtime supervisor owns network lifecycle.

On browser `offline`:

```text
heartbeat stops
command polling stops
LKG presentation keeps rendering
```

On browser `online`:

```text
heartbeat resumes immediately
command polling resumes immediately
held command ACK recovery retries immediately
```

No state-engine reset occurs.

## Apply

```bash
node scripts/apply-tv-phase3ce-runtime-recovery.mjs
bash scripts/verify-tv-phase3ce-runtime-recovery.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Manual network recovery acceptance

Open player with DevTools Network.

Keep the screen in NORMAL mode.

1. Confirm normal heartbeat and command polling.
2. In DevTools Network throttling choose `Offline`.
3. Wait at least 20–30 seconds.
4. Confirm the LKG presentation continues rendering.
5. Console:

```js
document.documentElement.dataset.runtimeNetworkStatus
```

Expected:

```text
offline
```

6. Change throttling back to `No throttling`.
7. Browser fires `online`; runtime operations resume immediately.
8. Console again:

```js
document.documentElement.dataset.runtimeNetworkStatus
```

Expected:

```text
online
```

9. Network should show a fresh heartbeat and command poll without manual page
   refresh.

## Final database acceptance

Run:

```text
supabase/tv/phase3c-final/01_final_runtime_acceptance.sql
```

Required device state:

```text
enabled = true
network_status = online
app_version = mjhk-web-player-3c-b
current_state = NORMAL
revision_in_sync = true
last_seen_at = recent
```

Latest successful command acceptance should include:

```text
sync_now      = done
reload_player = done
```

Historical `failed` / `expired` test rows may remain as audit evidence.

The final active-command query should preferably return zero rows.

## Final Phase 3C acceptance

Phase 3C is complete when all are true:

```text
3C-A audit locked
3C-B heartbeat locked
3C-C command polling locked
3C-D sync_now locked
3C-D reload_player locked
3C-E recovery verifier CLEAN
offline screen keeps rendering
online resumes heartbeat/poll automatically
device desired_revision_id == applied_revision_id
latest sync_now done
latest reload_player done
no unintended active command lease
```

## Deferred capabilities

These remain intentionally outside the browser-safe command set:

```text
mute
unmute
restart_app
refresh_screenshot
```

They should be implemented only with real runtime/Android host capabilities.


## Phase-aware locked verifier update

Phase 3C-E moves heartbeat and command-poller start/stop ownership from direct
calls in `player.js` into `runtime-operations-supervisor.js`.

The locked 3C-B and 3C-C verifiers are updated to accept either:

```text
legacy direct ownership
or
3C-E supervisor ownership
```

Their behavioral invariants remain unchanged. This prevents false regressions
caused only by orchestration ownership moving one layer upward.

# Phase 3C-E Transport Recovery Hotfix v3

## Why v3 exists

DevTools `Offline` can block HTTP transport without reliably changing the
browser/OS connectivity heuristic used by `navigator.onLine`.

Therefore runtime recovery must not depend only on:

```text
window online
window offline
navigator.onLine
```

## New authoritative signal

The authenticated Gateway heartbeat is now the reachability probe.

```text
heartbeat sent
→ transport ONLINE
→ command polling enabled
→ held command ACK retry requested

heartbeat failed
→ command polling paused
→ first failure = DEGRADED
→ repeated failure threshold = OFFLINE
→ heartbeat remains running with its existing bounded backoff

heartbeat succeeds again
→ ONLINE
→ command polling resumes immediately
→ held command recovery retries
```

Browser `online/offline` events remain useful hints, but they are no longer
the only recovery mechanism.

## Acceptance under DevTools Offline

When selecting Network → Offline:

- LKG keeps rendering.
- heartbeat requests can fail with `ERR_INTERNET_DISCONNECTED`.
- after repeated heartbeat failures:

```js
document.documentElement.dataset.runtimeNetworkStatus
```

must become:

```text
offline
```

Command polling should stop while heartbeat continues only as a bounded
recovery probe.

After returning to `No throttling`, the next heartbeat success must set:

```text
online
```

and command polling resumes without page refresh.
