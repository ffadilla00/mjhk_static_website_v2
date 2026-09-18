# MJHK TV — Phase 3B.2E-C Player Startup Integration v1

## Goal

Connect the already-tested Phase 3B.2E-B orchestration core to the real
browser player startup path.

No revision ACK is sent yet.

## Startup flow

```text
player.js
  ↓
startRevisionStartupSync()
  ↓
restore existing LKG into Presentation Bridge
  ↓
load DeviceSessionStore
  ↓
Gateway bootstrap
  ↓
compare desired_revision_id vs local LKG
  ↓
if unchanged: NOOP
  ↓
if changed:
  Gateway revision fetch
  → RevisionStore candidate
  → candidate snapshot validation
  → typed presentation validation
  → transactional bridge apply
  → promote candidate to LKG
  → ACK intent only
```

## Important safety properties

### Existing LKG first

The player restores the current Last-Known-Good before contacting Gateway.
So a network outage never prevents the TV from showing its last valid config.

### Candidate is not promoted before local apply

Candidate presentation is validated and applied locally first.

Only after successful local apply:

```text
RevisionStore.promoteCandidate()
```

is allowed.

### Promotion failure rollback

If local UI apply succeeds but LKG promotion fails, the dependency adapter
restores the previous LKG presentation.

If no previous LKG existed, the bridge returns to the locked Phase 3A
placeholder.

### Bridge apply is transactional

`applyPresentationConfig()` keeps the previous typed config. If the new config
throws during local apply, it attempts to restore the previous config before
propagating the failure.

### No state-engine ownership change

Startup sync never imports or controls `TVStateEngine`.

The existing Phase 3A engine still owns:
- prayer states
- countdown
- transitions
- Friday states

### No ACK yet

3B.2E-C produces ACK intent through the orchestrator result but does not send
it to Gateway.

Network ACK belongs to Phase 3B.2E-D.

## Apply

After extracting this pack into the repo root:

```bash
node scripts/apply-tv-phase3b2ec-player-startup.mjs
```

Then verify:

```bash
bash scripts/verify-tv-phase3b2ec-player-startup.sh
```

Recommended regression:

```bash
bash scripts/smoke-tv-phase3b2ec-locked-regression.sh
```

## Browser test

Because production JS changed, use:

```text
Ctrl + F5
```

Open:

```text
http://127.0.0.1:5501/tv-player/
```

With the current representative revision already promoted to LKG, the expected
startup result is normally:

```text
Revision Sync: NOOP • already_applied
```

The Network tab should show:

```text
GET /v1/device/bootstrap   200
```

and should NOT need to fetch the revision again when
`desired_revision_id == local LKG revision_id`.

If no browser device session exists, expected:

```text
Revision Sync: SKIPPED • no_device_session
```

In both cases the existing LKG presentation remains available.

## Production mode

The small revision-sync status is appended only to the simulator developer
panel. It is not rendered when player mode is production.

## Next

Phase 3B.2E-D:

```text
ACK intent
→ authenticated /v1/device/revision/ack
→ success/failure ACK
→ retry/backoff
→ stale ACK handling
→ recovery verification
```
