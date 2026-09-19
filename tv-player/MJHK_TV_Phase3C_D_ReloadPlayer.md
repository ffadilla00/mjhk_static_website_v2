# MJHK TV — Phase 3C-D reload_player Dispatcher + ACK v1

## Goal

Add a real browser `reload_player` capability while preserving the already
locked `sync_now` behavior.

Critical ordering:

```text
reload_player leased
→ verify browser reload capability
→ POST command ACK done
→ ACK resolves successfully
→ schedule short reload delay
→ window.location.reload()
→ player boots normally again
```

Reload is NEVER executed before ACK succeeds.

## Why ACK first

If the browser reloads first, the command may remain `delivered` without a
final status. After its lease expires it can be pulled again, creating a
reload loop.

The dispatcher therefore prepares the reload action first but executes it only
after Gateway ACK returns successfully.

## Reload delay

Default:

```text
700 ms
```

Allowed injected range:

```text
250–5000 ms
```

The delay gives browser networking and local event processing a short margin
after the ACK promise resolves.

## Failure behavior

If browser reload capability is unavailable:

```text
ACK failed
error_message = reload_player_capability_unavailable
```

If command ACK transport fails:

```text
reload is NOT scheduled
poller HOLD stays active
```

This is intentional because command finalization is uncertain.

## sync_now compatibility

The existing `sync_now` path remains intact.

This phase extends the dispatcher; it does not replace its revision-sync
behavior.

## Apply

Extract pack to repo root.

This pack includes patch payloads used by the apply script. Run:

```bash
node scripts/apply-tv-phase3cd-reload-player.mjs
bash scripts/verify-tv-phase3cd-reload-player.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Acceptance

Seed exactly one fresh reload command:

```text
supabase/tv/phase3c-commands/04_seed_reload_player_acceptance.sql
```

Keep the player open. Do not manually refresh after seeding.

Expected sequence:

```text
GET  /v1/device/commands?limit=5             200
OPTIONS /v1/device/commands/<id>/ack          204
POST /v1/device/commands/<id>/ack             200
~700 ms
browser reloads automatically
GET /v1/device/bootstrap                      200
POST /v1/device/heartbeat                     200
GET /v1/device/commands?limit=5               200
```

The page should visibly reload by itself.

## Database verification

After the automatic reload, run:

```text
supabase/tv/phase3c-commands/05_verify_reload_player_ack.sql
```

Expected newest record:

```text
command_type = reload_player
status = done
delivery_attempts = 1
completed_at = populated
lease_expires_at = NULL
error_message = NULL
```

There must be no second delivery of the same reload command.

## Browser post-reload check

After the automatic reload:

```text
Revision Sync: NOOP • already_applied • ACK NOT_NEEDED
```

Heartbeat and empty command polling should resume normally.

## Locked boundaries

This extension:
- does not access Supabase directly
- does not control TVStateEngine
- does not change revision pipeline semantics
- does not reload before ACK success
