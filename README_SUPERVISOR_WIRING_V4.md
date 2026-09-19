# MJHK TV Phase 3C-E Supervisor Wiring Hotfix v4

## Root cause

The browser test showed:

```text
runtimeNetworkStatus = undefined
command polling continued while DevTools transport was Offline
```

That combination proves the transport supervisor was not the active owner of
heartbeat / command polling in the executing `player.js`.

The v3 supervisor logic itself was valid, but runtime ownership had not been
normalized reliably across the incremental 3C-B → 3C-C → 3C-D → 3C-E patches.

## v4 fix

The v4 apply script is intentionally self-healing.

It does not assume a specific prior patch state. It:

1. installs the known-good transport-driven supervisor;
2. ensures the supervisor import exists;
3. ensures the supervisor instance exists;
4. replaces the entire `revisionStartupPromise.finally(...)` body with:

```js
runtimeOperationsSupervisor.start();
```

5. replaces pagehide cleanup with supervisor ownership;
6. verifies `player.js` no longer directly starts heartbeat or command polling.

## Runtime marker

The supervisor now stamps:

```js
document.documentElement.dataset.runtimeSupervisorVersion
```

Expected:

```text
3c-e-v4
```

and immediately publishes:

```js
document.documentElement.dataset.runtimeNetworkStatus
```

Expected during normal startup:

```text
probing
```

then after first successful heartbeat:

```text
online
```

Therefore an `undefined` value now immediately proves the active browser page
did not load the v4 runtime.

## Apply

```bash
node scripts/apply-tv-phase3ce-supervisor-wiring-hotfix.mjs
bash scripts/verify-tv-phase3ce-supervisor-wiring-hotfix.sh
```

Optional audit:

```bash
bash scripts/audit-tv-phase3ce-runtime-ownership.sh
```

Then hard-refresh the browser with DevTools Disable cache enabled.
