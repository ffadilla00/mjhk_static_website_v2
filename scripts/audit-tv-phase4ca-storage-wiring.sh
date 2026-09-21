#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 4C-A STORAGE WIRING AUDIT ==="
echo

echo "--- STORAGE BUCKET REFERENCES ---"
grep -RniE \
  'storage\.from|storageUpload|storage_bucket|storage_path|tv-media|tv_monitor|tv-monitor|media/' \
  admin assets tv-player workers supabase scripts \
  --include='*.js' \
  --include='*.mjs' \
  --include='*.sql' \
  --include='*.md' \
  2>/dev/null \
  | sed -n '1,320p'

echo
echo "--- GATEWAY MEDIA ROUTE ---"
grep -RniE \
  '/v1/device/media|tv_content|storage_path|storage_bucket' \
  workers tv-player \
  --include='*.js' \
  --include='*.mjs' \
  2>/dev/null \
  | sed -n '1,260p'

echo
echo "=== END AUDIT ==="
