# MJHK TV — Phase 3B.2D-A.1 Representative Test Revision Seeder v1

Purpose: provide non-empty representative `playlist_items` and `running_text`
inside the EXISTING Phase 2C temp simulator desired revision so the safe
schema inspector can discover nested field/type contracts.

This pack deliberately does **not**:
- create or publish a production revision
- change desired revision pointers
- ACK a revision
- touch player/state engine code
- touch real MJHK content

## Safety scope

Seeder only updates the revision currently referenced by:

```text
tv_devices.name = 'MJHK TEMP SIMULATOR'
```

and aborts unless that revision is still `draft`.

## Representative data

Playlist union examples:
- `image`
- `text`
- `image_text`

Shared fields:
- id
- type
- title
- duration_seconds
- fullscreen
- always_show
- starts_at
- ends_at
- payload

Running text examples:
- id
- text
- enabled
- priority
- starts_at
- ends_at
- state_scope

These are test-contract candidates, not production UI bindings yet.

## Local pack verify

```bash
bash scripts/verify-tv-phase3b2d-a1-seeder-pack.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Supabase execution order

Run:

1. `00_preflight.sql`
2. Confirm exactly one temp device and its revision is `draft`
3. `01_seed_representative_snapshot.sql`
4. `02_verify_seed.sql`

Expected:

```text
playlist_items_count = 3
running_text_count   = 2
test_harness         = phase3b2d_a1_representative_schema
```

## Refresh browser pipeline

Because the revision ID stays the same but the test snapshot changed:

1. 3B.2B:
   - Fetch Candidate
   - Reload + Integrity Check
   - Promote to LKG
   - Reload + Integrity Check
2. 3B.2C:
   - Analyze Snapshot
   - Apply Runtime Config
   - Test Failed Candidate
3. 3B.2D-A:
   - Inspect Schema

Then use the safe contract output to implement the typed adapter.

## Cleanup

Do NOT run `99_restore_empty_snapshot.sql` yet.
Keep the representative snapshot until the typed adapter is implemented and verified.
