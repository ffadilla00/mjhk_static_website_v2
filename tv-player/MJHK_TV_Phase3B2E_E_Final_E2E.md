# MJHK TV — Phase 3B.2E-E Final End-to-End Simulator v1

## Purpose

Prove the complete automatic revision pipeline against the real TEMP simulator:

```text
Supabase desired revision changes
→ browser boot
→ Gateway bootstrap
→ desired revision fetch
→ candidate integrity
→ typed validation
→ local presentation apply
→ candidate promoted to LKG
→ authenticated revision ACK
→ server applied_revision_id updates
```

## Confirmed baseline before this harness

The supplied database inspection showed:

```text
Device: MJHK TEMP SIMULATOR
Desired revision: #4
Applied revision: #4
Desired == Applied: yes
Revision #4 status: draft
Representative playlist items: 3
Representative running-text items: 2
```

This is the ideal starting condition for an E2E acceptance test.

## Step 1 — Verify local harness

From repository root:

```bash
bash scripts/verify-tv-phase3b2ee-e2e-harness.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Step 2 — Supabase preflight

Run:

```text
supabase/tv/phase3b2e-e2e/00_preflight.sql
```

Required:

```text
simulator_count = 1
enabled = true
baseline_in_sync = true
snapshot_type = object
playlist_items_count = 3
running_text_count = 2
```

Do not continue if `baseline_in_sync` is false.

## Step 3 — Seed a NEW desired revision

Run:

```text
supabase/tv/phase3b2e-e2e/01_seed_e2e_revision.sql
```

Expected immediately after seed:

```text
desired_revision_number = 5
already_applied = false
status = draft
test_harness = phase3b2e_e_final_e2e
```

The script never writes `applied_revision_id`.

## Step 4 — Browser E2E run

Open DevTools → Network, then hard refresh:

```text
Ctrl + F5
```

Player:

```text
http://127.0.0.1:5501/tv-player/
```

Expected network flow:

```text
GET  /v1/device/bootstrap
GET  /v1/device/revision/<new-revision-id>
POST /v1/device/revision/ack
```

Expected developer status:

```text
Revision Sync: APPLIED • revision_applied • rev 5 • ACK SENT
```

The NORMAL presentation should eventually show:

```text
E2E Revision 5 Active
```

and running text:

```text
E2E sync revision 5 applied automatically
```

Image media may still show the intentional graceful fallback because the
representative image URLs use `example.invalid`. That does not fail revision
acceptance.

## Step 5 — Server acceptance

Run:

```text
supabase/tv/phase3b2e-e2e/02_verify_after_player.sql
```

Required:

```text
server_in_sync = true
desired_revision_number = 5
applied_revision_number = 5
test_harness = phase3b2e_e_final_e2e
```

Then inspect content:

```text
supabase/tv/phase3b2e-e2e/03_verify_e2e_payload.sql
```

Expected heading:

```text
E2E Revision 5 Active
```

## Step 6 — Idempotency proof

Hard refresh player ONE MORE TIME.

Expected:

```text
Revision Sync: NOOP • already_applied • ACK NOT_NEEDED
```

Expected Network:

```text
GET /v1/device/bootstrap
```

No revision fetch and no duplicate ACK should be required.

This proves the pipeline is idempotent after convergence.

## Optional rollback

Do NOT run rollback until the E2E acceptance result has been captured.

Run:

```text
supabase/tv/phase3b2e-e2e/99_restore_previous_desired.sql
```

This only restores `desired_revision_id`.

It deliberately does NOT modify `applied_revision_id`.

Then hard refresh player once. The normal pipeline should automatically
re-apply the previous revision and ACK it.

Verify:

```text
supabase/tv/phase3b2e-e2e/100_verify_after_restore_sync.sql
```

Expected:

```text
server_in_sync = true
desired_revision_number = 4
applied_revision_number = 4
```

The E2E revision row is intentionally left in the database as an audit/test
artifact rather than deleted.

## Acceptance criteria

Phase 3B.2E is complete only when all are true:

```text
local harness verifier CLEAN
new desired revision created safely
browser fetches revision automatically
candidate applies successfully
new revision becomes local LKG
success ACK reaches Gateway
server desired == applied
second refresh is NOOP/idempotent
locked regressions remain CLEAN
```
