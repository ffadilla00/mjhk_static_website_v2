# MJHK TV — Phase 3B.2E End-to-End Revision Sync Contract

## Goal

Move the player from manual diagnostics into an automatic, safe revision lifecycle:

```text
Device Session
    ↓
Gateway Bootstrap
    ↓
desired_revision_id
    ↓
compare with currently applied/local revision
    ↓
Fetch Desired Revision
    ↓
Validate + Candidate Store
    ↓
Candidate Runtime Preparation
    ↓
Typed Presentation Adapter
    ↓
Atomic Presentation Apply
    ↓
Promote Candidate → Last-Known-Good
    ↓
Revision ACK success
```

On any failure:

```text
candidate fails
    ↓
existing runtime/LKG remains active
    ↓
no destructive promotion
    ↓
Revision ACK failure
    ↓
player keeps serving Last-Known-Good
```

## Important semantic correction

Production sync must not treat a remote candidate as Last-Known-Good merely
because it was fetched successfully.

`LKG` means the revision has passed:

1. transport validation
2. integrity validation
3. runtime validation
4. typed presentation validation
5. successful local apply

Only after that should the candidate be promoted to LKG.

The earlier diagnostic pages intentionally tested these pieces separately.
Phase 3B.2E is where they are composed into the correct production order.

## ACK semantics

A success ACK means:

> This device accepted and locally applied the revision contract.

It does not guarantee every remote image is currently reachable. Media fetch
health is runtime telemetry/fallback behavior, not config acceptance.

A failure ACK should contain only a bounded, non-secret error code/message.

Never send:
- device token
- full snapshot
- arbitrary stack trace
- service-role credentials

## Proposed subphases

### 3B.2E-A — Sync Wiring Audit
Read-only audit of current module APIs and Worker ACK contract.

### 3B.2E-B — Sync Orchestrator Core
Pure orchestration layer with dependency injection and failure isolation.
No player startup hook yet.

### 3B.2E-C — Player Startup Integration
Player boot triggers safe sync:
- bootstrap
- no-op if no revision change
- apply candidate atomically
- preserve existing LKG on failure

### 3B.2E-D — Revision ACK + Recovery
ACK success/failure, stale ACK handling, retry/backoff, and recovery checks.

### 3B.2E-E — End-to-End Simulator
One test command proves:

```text
Gateway → Player → Apply → ACK → final heartbeat sees applied revision
```

## Non-goals in Phase 3B.2E

Still no:
- CMS authoring UI
- Android APK
- direct Supabase from player
- state-engine ownership changes
- prayer transition changes
