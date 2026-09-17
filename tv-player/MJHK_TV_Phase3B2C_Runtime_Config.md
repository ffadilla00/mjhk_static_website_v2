# MJHK TV — Phase 3B.2C Atomic Config Hydration + Safe Apply v1

Prerequisites:
- Phase 3B.1 locked
- Phase 3B.2A committed
- Phase 3B.2B committed
- valid LKG exists in browser simulator storage

## Scope

3B.2C hydrates the **LKG snapshot** into an isolated immutable runtime config.

```text
LKG snapshot
   ↓
clone
   ↓
JSON/safety validation
   ↓
deep freeze
   ↓
prepared candidate
   ↓
atomic in-memory swap
   ↓
RuntimeConfigRegistry
```

If preparation/validation fails, the active runtime config is never touched.

## Safety guards

- LKG-only source
- UUID + revision-number validation
- plain JSON object root
- maximum nesting depth
- maximum node count
- maximum array length
- maximum string length
- finite numbers only
- blocks `__proto__`, `prototype`, `constructor`
- immutable deep-frozen runtime config
- rollback to previous runtime config
- metadata-only events / diagnostics

## Important boundary

This phase DOES NOT:
- bind config values to player DOM
- change state engine
- change countdown logic
- change transitions
- send revision ACK

Those remain separate steps so a bad remote config cannot destabilize the locked
Phase 3A player.

## Verify

```bash
bash scripts/verify-tv-phase3b2c-runtime-config.sh
```

Target:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Browser test

Open:

```text
http://127.0.0.1:5501/tv-player/runtime-config-diagnostics.html
```

Run in order:

1. `Analyze Snapshot`
2. Confirm top-level keys are shown, values are not
3. `Apply Runtime Config`
4. Expected `ATOMIC APPLY OK`
5. `Test Failed Candidate`
6. Expected `FAILURE ISOLATED • runtime unchanged`
7. `Rollback Runtime`
   - If only one successful config has ever been applied, a warning that no
     previous runtime exists is expected.
   - Rollback becomes meaningful after a later revision is applied.

## Next

After 3B.2C is clean, the next step is a **typed visual adapter** that maps
approved snapshot fields into the locked Phase 3A/3A.1 presentation contract.
Only after that succeeds do we send the revision ACK.
