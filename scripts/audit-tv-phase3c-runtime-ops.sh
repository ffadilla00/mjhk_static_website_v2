#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 3C-A RUNTIME OPERATIONS WIRING AUDIT ==="
echo

echo "--- WORKER HEARTBEAT ROUTE ---"
grep -nA28 -B10 -E \
  'path === "/v1/device/heartbeat"|tv_device_heartbeat' \
  worker-tv-mjhk/src/index.js 2>/dev/null | head -n 180 || true

echo
echo "--- WORKER COMMAND PULL + ACK ROUTES ---"
grep -nA48 -B8 -E \
  'path === "/v1/device/commands"|tv_device_pull_commands|tv_device_ack_command|commands/.+ack' \
  worker-tv-mjhk/src/index.js 2>/dev/null | head -n 260 || true

echo
echo "--- DEVICE RPC DEFINITIONS IN REPO ---"
grep -R -nA90 -B8 -E \
  'create or replace function public\.tv_device_(heartbeat|pull_commands|ack_command)' \
  supabase worker-tv-mjhk 2>/dev/null | head -n 520 || true

echo
echo "--- DEVICE + COMMAND TABLE CONTRACTS ---"
grep -R -nA80 -B10 -E \
  'create table if not exists public\.tv_devices|create table if not exists public\.tv_device_commands' \
  supabase 2>/dev/null | head -n 420 || true

echo
echo "--- CURRENT PLAYER RUNTIME SURFACES ---"
for f in \
  tv-player/assets/js/player.js \
  tv-player/assets/js/presentation-player-bridge.js \
  tv-player/assets/js/revision-sync-startup.js \
  tv-player/assets/js/revision-sync-orchestrator.js \
  tv-player/assets/js/device-session.js \
  tv-player/assets/js/gateway-client.js
do
  if [[ -f "$f" ]]; then
    echo
    echo "### $f"
    grep -nEi \
      'current|state|remaining|slide|content|revision|sync|reload|location|mute|audio|heartbeat|command|telemetry|getSafeMeta|dataset' \
      "$f" | head -n 260 || true
  else
    echo "[MISS] $f"
  fi
done

echo
echo "--- EXISTING HEARTBEAT / COMMAND PLAYER IMPLEMENTATION? ---"
if grep -R -nEi \
  'tv_device_heartbeat|/v1/device/heartbeat|heartbeatLoop|heartbeatTimer|pullCommands|/v1/device/commands|ackCommand|command_type' \
  tv-player/assets/js 2>/dev/null
then
  echo "[INFO] Runtime operations references found above."
else
  echo "[PASS] No player heartbeat/command runtime implementation yet."
fi

echo
echo "--- DIRECT SUPABASE CHECK ---"
if grep -R -nEi \
  'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE|SUPABASE_URL|createClient[[:space:]]*\(|https://[^"'\'']*\.supabase\.co|/rest/v1/' \
  tv-player/assets/js 2>/dev/null
then
  echo "[WARN] Direct Supabase indicator found above."
else
  echo "[PASS] Player layer has no direct Supabase access."
fi

echo
echo "--- LOCKED REVISION PIPELINE FILES ---"
for f in \
  tv-player/assets/js/revision-sync-orchestrator.js \
  tv-player/assets/js/revision-sync-startup.js \
  tv-player/assets/js/revision-ack-delivery.js \
  tv-player/assets/js/revision-ack-outbox.js \
  tv-player/assets/js/presentation-player-bridge.js \
  tv-player/assets/js/engine.js
do
  [[ -f "$f" ]] && echo "[FOUND] $f" || echo "[MISS] $f"
done

echo
echo "=== END PHASE 3C-A AUDIT ==="
