# MJHK TV — Phase 3B.2D-A Typed Snapshot Schema Audit v1

This phase exists to avoid guessing the remote snapshot contract.

Current top-level snapshot keys already confirmed:

```text
generated_at
message
playlist_items
running_text
schema_version
test_mode
```

The nested structure of `playlist_items` and `running_text` must be audited
before a typed adapter is allowed to bind any remote config into the player.

## Safety

The inspector outputs only:
- field names
- data types
- array lengths
- distinct sample shapes

It never outputs:
- actual strings
- URLs
- messages
- numeric config values
- device tokens

## Verify

```bash
bash scripts/verify-tv-phase3b2d-schema-audit.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Run

Open:

```text
http://127.0.0.1:5501/tv-player/snapshot-schema-diagnostics.html
```

Click:

`Inspect Schema`

Send back:
- Playlist Items
- Running Text
- Full Safe Contract

Because values are redacted by design, this output is safe to use for the next
typed-adapter implementation.

## Next

3B.2D-B will lock the actual nested schema and create a typed presentation
adapter. That adapter still will not modify the locked state engine directly.
