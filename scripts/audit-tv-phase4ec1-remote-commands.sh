#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 4E-C1 REMOTE COMMANDS AUDIT ==="
echo

echo "## 1. UI asset wiring"
grep -nE 'tv-device-commands\.(js|css)' admin/tv-devices.html || true
echo

echo "## 2. Exposed commands"
grep -nE 'sync_now|reload_player|mute|unmute|restart_app|refresh_screenshot' \
  admin/tv-device-commands.js || true
echo

echo "## 3. Command enqueue + history contract"
grep -nE 'tv_device_commands|HISTORY_LIMIT|activeDuplicateExists|expires_at|delivery_attempts' \
  admin/tv-device-commands.js || true
echo

echo "## 4. Lifecycle gates"
grep -nE 'enabled|paired_at|network_status|offline|revok' \
  admin/tv-device-commands.js || true
echo

echo "## 5. Security scan"
grep -nEi 'service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE|device_token_hash|pairing_code_hash' \
  admin/tv-device-commands.js admin/tv-devices.html || true
echo

echo "## 6. Static syntax"
node --check admin/tv-device-commands.js \
  && echo "[PASS] admin/tv-device-commands.js syntax OK" \
  || echo "[FAIL] admin/tv-device-commands.js syntax ERROR"
echo

echo "=== END PHASE 4E-C1 REMOTE COMMANDS AUDIT ==="
