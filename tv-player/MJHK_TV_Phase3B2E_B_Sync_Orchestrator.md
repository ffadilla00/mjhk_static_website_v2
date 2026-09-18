# MJHK TV — Phase 3B.2E-B Sync Orchestrator Core v1

## Purpose

Provide one safe orchestration state machine for remote revision application,
without yet connecting it to player startup or sending a network ACK.

## Required order

```text
load session
→ bootstrap
→ compare desired vs applied
→ fetch revision
→ save candidate
→ reload/verify candidate
→ prepare candidate
→ apply candidate locally
→ promote candidate to LKG
→ emit success ACK intent
```

The critical invariant is:

```text
applyCandidate MUST succeed before promoteCandidate
```

If any step fails after a candidate was stored:

```text
old LKG remains unchanged
candidate is cleared
negative ACK intent is emitted
```

## Why ACK is only an intent in this phase

3B.2E-B is deliberately pure orchestration.

It returns:

```js
{
  status: "applied" | "failed" | "noop" | "skipped",
  revision_id,
  ack_intent: {
    revision_id,
    success,
    error_message
  }
}
```

The next ACK/recovery phase will decide how and when that intent is delivered
to the Gateway.

This prevents transport behavior from being mixed into the atomic apply
transaction.

## Concurrency

`syncOnce()` is single-flight. Concurrent calls share the same in-flight
operation so the player cannot promote two revisions simultaneously.

## Safety

The core:
- never sees or logs a device token
- never calls Supabase directly
- never imports the state engine
- never performs fetch itself
- never sends ACK itself
- redacts token-like strings from bounded error messages

## Verify

```bash
bash scripts/verify-tv-phase3b2e-b-sync-orchestrator.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Next phase

3B.2E-C will build the real dependency adapter using the audited repository
contracts:

- `DeviceSessionStore`
- `GatewayClient.bootstrap()`
- `GatewayClient.request()` for revision fetch
- `RevisionStore`
- snapshot/runtime validation
- typed presentation adapter
- `PresentationPlayerBridge`

and then attach one safe sync run to player startup.
