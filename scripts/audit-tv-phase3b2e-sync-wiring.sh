#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 3B.2E-A END-TO-END SYNC WIRING AUDIT ==="
echo

FILES=(
  "tv-player/assets/js/gateway-client.js"
  "tv-player/assets/js/device-session.js"
  "tv-player/assets/js/revision-store.js"
  "tv-player/assets/js/runtime-config-core.js"
  "tv-player/assets/js/presentation-adapter.js"
  "tv-player/assets/js/presentation-binding.js"
  "tv-player/assets/js/presentation-player-bridge.js"
  "tv-player/assets/js/player.js"
  "worker-tv-mjhk/src/index.js"
)

echo "--- REQUIRED FILES ---"
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    echo "[FOUND] $f"
  else
    echo "[MISS]  $f"
  fi
done

echo
echo "--- GATEWAY CLIENT PUBLIC SURFACE ---"
grep -nEi \
  'export|class |function |async |bootstrap|revision|ack|command|heartbeat|request|fetch' \
  tv-player/assets/js/gateway-client.js 2>/dev/null | head -n 260 || true

echo
echo "--- DEVICE SESSION PUBLIC SURFACE ---"
grep -nEi \
  'export|class |function |load|save|session|deviceCode|deviceToken|clear|has' \
  tv-player/assets/js/device-session.js 2>/dev/null | head -n 220 || true

echo
echo "--- REVISION STORE PUBLIC SURFACE ---"
grep -nEi \
  'export|class |function |candidate|lastKnown|last-known|lkg|promote|clear|load|save|store|integrity|fingerprint' \
  tv-player/assets/js/revision-store.js 2>/dev/null | head -n 320 || true

echo
echo "--- RUNTIME CONFIG CORE ---"
grep -nEi \
  'export|class |function |prepare|runtime|rollback|hydrate|validate|snapshot' \
  tv-player/assets/js/runtime-config-core.js 2>/dev/null | head -n 280 || true

echo
echo "--- TYPED PRESENTATION ADAPTER ---"
grep -nEi \
  'export|function |adaptPresentationConfig|safePresentationMeta|PresentationAdapterError' \
  tv-player/assets/js/presentation-adapter.js 2>/dev/null | head -n 220 || true

echo
echo "--- PRESENTATION BINDER ---"
grep -nEi \
  'export|class |setConfig|setPresentationState|start|stop|render|meta' \
  tv-player/assets/js/presentation-binding.js 2>/dev/null | head -n 260 || true

echo
echo "--- PLAYER BRIDGE ---"
grep -nEi \
  'export|initialize|setPresentationState|refresh|getSafeMeta|RevisionStore|prepareRuntimeConfig|adaptPresentationConfig' \
  tv-player/assets/js/presentation-player-bridge.js 2>/dev/null | head -n 280 || true

echo
echo "--- PLAYER STARTUP / ENGINE EVENT WIRING ---"
grep -nEi \
  'import|presentationBridge|TVStateEngine|renderState|statechange|addEventListener|initialize|bootstrap' \
  tv-player/assets/js/player.js 2>/dev/null | head -n 320 || true

echo
echo "--- WORKER REVISION + ACK ROUTES ---"
grep -nA28 -B8 -Ei \
  'revision/ack|device/revision|tv_device_ack_revision|tv_device_bootstrap' \
  worker-tv-mjhk/src/index.js 2>/dev/null | head -n 420 || true

echo
echo "--- CURRENT SAFE STORAGE KEYS / MARKERS ---"
grep -R -nEi \
  'localStorage|candidate|last-known-good|lastKnownGood|fingerprint|revision_id|applied_revision' \
  tv-player/assets/js/{revision-store.js,runtime-config-core.js,presentation-player-bridge.js} \
  2>/dev/null | head -n 360 || true

echo
echo "--- CHECK: DIRECT SUPABASE IN PLAYER LAYER ---"
if grep -R -nEi \
  'SUPABASE_SERVICE_ROLE|sb_secret_|supabase\.co/rest|supabase\.co/storage' \
  tv-player/assets/js/{gateway-client.js,revision-store.js,runtime-config-core.js,presentation-player-bridge.js,player.js} \
  2>/dev/null
then
  echo "[WARN] Direct Supabase reference found above"
else
  echo "[PASS] Player sync path has no direct Supabase/service-role references"
fi

echo
echo "--- CHECK: ACK CURRENTLY WIRED INTO PLAYER? ---"
if grep -R -nEi \
  'revision/ack|ackRevision|ack_revision|tv_device_ack_revision' \
  tv-player/assets/js/{player.js,presentation-player-bridge.js} \
  2>/dev/null
then
  echo "[INFO] ACK reference already exists in player/bridge"
else
  echo "[PASS] ACK is not yet wired into player/bridge"
fi

echo
echo "=== END PHASE 3B.2E-A AUDIT ==="
