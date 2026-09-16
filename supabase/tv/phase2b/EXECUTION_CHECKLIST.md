# MJHK TV Phase 2B — Controlled Migration Checklist

## A. Before migration

1. Confirm Phase 2A is locked and production smoke is clean.
2. Keep Phase 2A rollback file unchanged.
3. Extract this pack into repository root.
4. Run:

```bash
bash scripts/verify-tv-phase2b-pack.sh
```

Target:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## B. Supabase pre-flight

Run:

`supabase/tv/phase2b/00_phase2b_preflight.sql`

Expected:
- schema version `2A.1.0`
- Phase 2A tables present
- 2 private TV buckets
- no unexpected Phase 2B device RPCs

If schema version is not exactly `2A.1.0`, stop.

## C. Apply Phase 2B

Run entire:

`01_phase2b_secure_device_rpc.sql`

Do not run sections individually.

Expected:
`Success. No rows returned`

## D. Verify

Run:

`02_phase2b_verify.sql`

Critical target:
- schema `2B.1.0`
- new tables RLS enabled
- `anon_device_claim_execute = false`
- `authenticated_heartbeat_execute = false`
- `service_role_heartbeat_execute = true`
- `authenticated_admin_publish_execute = true`
- private buckets still `public=false`

## E. Regression smoke

Run existing tests unchanged:

```bash
bash scripts/smoke-critical.sh \
  https://www.mj-harapankita.or.id \
  https://tanya-mjhk.ffadilla-90.workers.dev
```

Then:

```bash
bash scripts/smoke-production.sh \
  https://www.mj-harapankita.or.id \
  https://mj-harapankita.or.id \
  https://tanya-mjhk.ffadilla-90.workers.dev \
  report-only
```

Target:
- WARN 0
- FAIL 0
- CLEAN

## F. Commit

Only after verify + regression smoke are clean:

```bash
git add supabase/tv/phase2b scripts/verify-tv-phase2b-pack.sh
git commit -m "feat: add secure MJHK TV device RPC layer"
git push origin main
```

## G. Do NOT yet

Do not:
- put service-role key in Android
- expose device RPCs to anon
- upload screenshots directly from TV to Supabase with privileged credentials
- pair a production TV until Worker gateway exists
- start Admin UI device pairing before Worker contract is implemented

Phase 2B SQL prepares the secure backend contract.
The next implementation step is the `worker-tv-mjhk` gateway.
