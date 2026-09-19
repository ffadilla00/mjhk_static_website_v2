# MJHK TV — Phase 3C-C Command Polling Core v1

## Goal

Add safe authenticated command polling without executing or ACKing commands.

```text
player startup settled
→ GET /v1/device/commands?limit=5
→ normalize strict command contract
→ hold first non-empty leased batch
→ publish safe runtime event
```

## Why the hold exists

The server leases commands for 60 seconds and increments `delivery_attempts`
each time an expired lease is pulled again.

Phase 3C-C intentionally has no dispatcher and no ACK yet. If polling simply
continued forever, the same command could be redelivered repeatedly and burn
through its allowed delivery attempts before Phase 3C-D is installed.

Therefore:

```text
empty batch      → keep polling
non-empty batch  → enter HOLD
```

While held, `pollNow()` returns a local held result and does not make another
Gateway request.

3C-D will become the consumer/dispatcher and will own command ACK.

## Polling defaults

```text
interval = 15 seconds
limit    = 5
```

Server enforces maximum limit 20.

## Allowed command contract

The poller accepts only:

```text
sync_now
reload_player
mute
unmute
restart_app
refresh_screenshot
```

Acceptance does NOT mean execution.

No command execution API exists in this phase.

## Payload rules

Command payload is shallow-sanitized.

Allowed scalar value types:

```text
string <= 500 chars
finite number
boolean
null
```

Nested objects and arrays are discarded.

## Security boundaries

3C-C:
- uses DeviceSessionStore + GatewayClient
- has no direct Supabase
- logs no credentials
- does not execute commands
- does not ACK commands
- does not control TVStateEngine
- does not alter revision sync

## Apply

```bash
node scripts/apply-tv-phase3cc-command-poller.mjs
bash scripts/verify-tv-phase3cc-command-poller.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Browser acceptance

Hard refresh once:

```text
Ctrl + F5
```

Expected Network:

```text
GET /v1/device/commands?limit=5   200
```

Because the simulator currently has a pending `sync_now`, the first non-empty
batch should move the poller into local HOLD.

Do not keep manually refreshing during this test because each fresh page has a
fresh in-memory poller and may cause another server pull after the lease
expires.

## Database acceptance

Run:

```text
supabase/tv/phase3c-commands/01_verify_command_lease.sql
```

Expected for the pending test command:

```text
command_type = sync_now
status = delivered
delivery_attempts >= 1
delivered_at = populated
lease_expires_at = populated
completed_at = NULL
```

`completed_at = NULL` is important because Phase 3C-C must not ACK it.

## Next

Phase 3C-D will add:
- safe dispatcher
- `sync_now`
- `reload_player`
- explicit failed result for unsupported browser capabilities
- command ACK `done|failed`
- stale/idempotent ACK handling
