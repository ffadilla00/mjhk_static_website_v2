# MJHK TV — Phase 3B.2E-D Revision ACK & Recovery v1

## Goal

Deliver revision apply results to the authenticated MJHK TV Gateway without making ACK transport part of the atomic local apply transaction.

## Flow

```text
RevisionSyncOrchestrator
    ↓
ack_intent
    ↓
RevisionAckOutbox
    ↓
POST /v1/device/revision/ack
    ↓
success → remove outbox entry
transient failure → keep + backoff
stale/permanent → terminal remove
```

## Recovery case

If local LKG already equals `desired_revision_id` but server `applied_revision_id` is still different or null, startup sends a recovery success ACK without refetching/reapplying the revision.

## ACK semantics

Success means the config revision passed local validation and presentation apply and is now the device Last-Known-Good revision. It does not mean every remote image is reachable; media health remains runtime fallback behavior.

Failure ACK contains only a bounded redacted message.

## Persistent outbox

Storage key:

```text
mjhk.tv.revision-ack-outbox.v1
```

Stores only revision UUID, success boolean, bounded error message, attempt count, and retry timestamps. No device token and no snapshot.

## Retry policy

Transient: network exception, HTTP 408/425/429/5xx → queue with bounded backoff.

Permanent: HTTP 400/401/403/404 → terminal remove.

Stale: HTTP 409 or `stale_revision_ack` → terminal remove.

## Verify

```bash
bash scripts/verify-tv-phase3b2ed-revision-ack.sh
bash scripts/smoke-tv-phase3b2ed-locked-regression.sh
```

## Browser test

Hard refresh the player.

First run, with current local LKG but missing server ACK, should show roughly:

```text
Revision Sync: NOOP • already_applied • ACK SENT
```

Network should show:

```text
GET  /v1/device/bootstrap       200
POST /v1/device/revision/ack    200
```

On the next hard refresh, server should already know the revision:

```text
Revision Sync: NOOP • already_applied • ACK NOT_NEEDED
```

and no duplicate ACK POST should be needed.

## Next

Phase 3B.2E-E will prove the final end-to-end simulator path with a brand-new desired revision:

```text
new desired revision
→ automatic fetch
→ candidate validation
→ local apply
→ LKG promotion
→ ACK
→ next bootstrap confirms applied_revision_id
```
