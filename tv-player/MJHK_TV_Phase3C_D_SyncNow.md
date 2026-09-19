# MJHK TV — Phase 3C-D sync_now Dispatcher + Command ACK v1

## Goal

Execute `sync_now` using the already-locked Phase 3B revision pipeline, then
ACK the command only after execution settles.

```text
GET commands
→ sync_now
→ exact revision startup pipeline
→ success / NOOP / failure
→ POST /commands/:id/ack
→ done | failed
→ release poller HOLD only after ACK
```

## Important semantic

`sync_now` is successful when revision synchronization returns:

```text
success
noop
```

`noop / already_applied` is success because the device is already converged
to its desired revision.

## Revision pipeline reuse

This phase does NOT implement another revision algorithm.

A small additive export named:

```js
runRevisionSyncNow(...)
```

re-runs the exact existing `startRevisionStartupSync(...)` pipeline.

That pipeline still owns:
- bootstrap
- desired revision decision
- candidate validation
- presentation apply
- LKG promotion
- revision ACK/recovery

The startup function now also returns its already-safe `{ result, ack_result }`
metadata. Existing startup callers remain compatible because adding a resolved
return value does not change their execution semantics.

## Command ACK

Command ACK uses:

```text
POST /v1/device/commands/:command_id/ack
```

Body:

```json
{ "status": "done" }
```

or on execution failure:

```json
{
  "status": "failed",
  "error_message": "<bounded safe reason>"
}
```

No raw exception text, device token, revision snapshot, or secret is sent.

## HOLD semantics

3C-C entered HOLD after leasing a non-empty command batch.

3C-D releases HOLD only when every command in the batch was successfully
ACKnowledged to the Gateway.

If ACK transport fails, HOLD remains active. This prevents immediate
redelivery and duplicate execution while ACK state is uncertain.

## Unsupported commands

For this phase, only:

```text
sync_now
```

has a real browser execution capability.

Other command types are explicitly ACKed:

```text
failed
command_capability_unavailable
```

They are never silently treated as success.

## Apply

Extract to repo root, then:

```bash
node scripts/apply-tv-phase3cd-sync-now.mjs
bash scripts/verify-tv-phase3cd-sync-now.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Acceptance test

Create a fresh command:

```text
supabase/tv/phase3c-commands/02_seed_sync_now_acceptance.sql
```

Then hard refresh the player ONCE.

Expected Network flow:

```text
GET  /v1/device/commands?limit=5                200
GET  /v1/device/bootstrap                       200
POST /v1/device/commands/<command-id>/ack       200
```

Because revision #5 is already applied, revision sync will normally be:

```text
NOOP • already_applied
```

That is expected.

There may be an `OPTIONS 204` preflight before the ACK POST.

## Browser runtime acceptance

Console:

```js
document.documentElement.dataset.runtimeCommandDispatchStatus
```

Expected:

```text
done
```

Then:

```js
document.documentElement.dataset.runtimeCommandDispatchReason
```

Expected commonly:

```text
already_applied
```

## Database acceptance

Run:

```text
supabase/tv/phase3c-commands/03_verify_sync_now_ack.sql
```

Expected newest acceptance command:

```text
command_type = sync_now
status = done
delivery_attempts >= 1
completed_at = populated
error_message = NULL
```

After ACK succeeds, the poller is released from HOLD and may resume empty
command polling.

## Locked boundaries

This phase must not:
- directly access Supabase from player runtime
- control TVStateEngine
- duplicate revision candidate/apply/LKG logic
- bypass Gateway device authentication
