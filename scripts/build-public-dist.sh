#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

DIST="${1:-public-dist}"
PROFILE="${MJHK_HEADER_PROFILE:-safe}"

echo "=== MJHK PUBLIC BUILD v9C.3 ==="
echo "Output: $DIST"
echo "Header profile: $PROFILE"

rm -rf "$DIST"
mkdir -p "$DIST"

copy_required() {
  local src="$1"
  if [ ! -e "$src" ]; then
    echo "[FAIL] Required path tidak ditemukan: $src"
    exit 2
  fi
  cp -R "$src" "$DIST/"
}

copy_required "index.html"
copy_required "assets"
copy_required "profile"
copy_required "admin"
copy_required "ramadhan"

[ -f robots.txt ] && cp robots.txt "$DIST/robots.txt"
[ -f sitemap.xml ] && cp sitemap.xml "$DIST/sitemap.xml"
[ -f favicon.ico ] && cp favicon.ico "$DIST/favicon.ico"

case "$PROFILE" in
  safe)
    cp deploy-config/_headers.safe "$DIST/_headers"
    ;;
  report-only)
    cp deploy-config/_headers.report-only "$DIST/_headers"
    ;;
  enforce)
    cp deploy-config/_headers.enforce "$DIST/_headers"
    ;;
  none)
    ;;
  *)
    echo "[FAIL] Unknown MJHK_HEADER_PROFILE: $PROFILE"
    exit 2
    ;;
esac

rm -rf \
  "$DIST/.git" \
  "$DIST/.vscode" \
  "$DIST/worker-tanya-mjhk" \
  "$DIST/scripts" \
  "$DIST/supabase" \
  "$DIST/node_modules" \
  "$DIST/.wrangler"

find "$DIST" -type f \( \
  -name '.env' -o \
  -name '.env.*' -o \
  -name '.dev.vars' -o \
  -name 'README*.txt' -o \
  -name 'README*.md' -o \
  -name '*.phase9b.bak' -o \
  -name '*.phase9c1.bak' -o \
  -name '*.phase9c2.bak' -o \
  -name '*.phase9c3.bak' -o \
  -name '*.bak' \
\) -delete

rm -rf "$DIST/assets/data"
rm -f "$DIST/assets/images"/keuangan-2026-08-*.jpg

FAIL=0

if find "$DIST" -type f -name '*.bak' -print -quit | grep -q .; then
  echo "[FAIL] Backup file masih masuk artifact"
  FAIL=1
else
  echo "[PASS] Backup file tidak ada"
fi

if [ "$PROFILE" != "none" ] && [ ! -f "$DIST/_headers" ]; then
  echo "[FAIL] _headers tidak ikut artifact"
  FAIL=1
else
  echo "[PASS] Header profile artifact konsisten"
fi

SECRET_HITS="$(mktemp)"
trap 'rm -f "$SECRET_HITS"' EXIT

grep -RInE \
  'sb_secret_|SUPABASE_SECRET_KEY[[:space:]]*=[[:space:]]*["'\''][^"'\'']+|SUPABASE_SERVICE_ROLE|CLOUDFLARE_API_TOKEN|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
  "$DIST" \
  --exclude='*.map' \
  > "$SECRET_HITS" 2>/dev/null || true

if [ -s "$SECRET_HITS" ]; then
  echo "[FAIL] Potential secret ditemukan di production artifact:"
  cat "$SECRET_HITS"
  FAIL=1
else
  echo "[PASS] Tidak ditemukan high-risk secret pattern di artifact"
fi

echo
echo "=== BUILD CONTENT ==="
find "$DIST" -type f | sort

echo
if [ "$FAIL" -ne 0 ]; then
  echo "[RESULT] BUILD FAILED SECURITY CHECK"
  exit 2
fi

echo "[RESULT] PUBLIC BUILD CLEAN"
