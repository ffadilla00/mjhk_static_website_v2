#!/usr/bin/env bash
set -u

echo "=== MJHK TV 3C-E v4 RUNTIME OWNERSHIP AUDIT ==="
echo

echo "--- SUPERVISOR IMPORT / CREATION ---"
grep -n -E \
  'createRuntimeOperationsSupervisor|runtimeOperationsSupervisor' \
  tv-player/assets/js/player.js || true

echo
echo "--- DIRECT HEARTBEAT / COMMAND POLLER STARTS IN PLAYER ---"
grep -n -E \
  'runtimeHeartbeat\.start|runtimeCommandPoller\.start|runtimeHeartbeat\.stop|runtimeCommandPoller\.stop' \
  tv-player/assets/js/player.js || true

echo
echo "--- STARTUP BLOCK ---"
grep -nA6 -B2 \
  'revisionStartupPromise.finally' \
  tv-player/assets/js/player.js || true

echo
echo "--- PAGEHIDE BLOCK ---"
grep -nA6 -B1 \
  'pagehide' \
  tv-player/assets/js/player.js || true

echo
echo "--- SUPERVISOR VERSION ---"
grep -n \
  'SUPERVISOR_VERSION' \
  tv-player/assets/js/runtime-operations-supervisor.js || true

echo
echo "=== END AUDIT ==="
