#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

DIST="${1:-public-dist}"

echo "=== MJHK PUBLIC BUILD v9B.1 ==="
echo "Output: $DIST"

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

# Defensive cleanup: source/dev artifacts must never be hosted.
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
  -name '*.bak' \
\) -delete

# Phase 9B verification proved these legacy assets are no longer referenced.
rm -rf "$DIST/assets/data"
rm -f "$DIST/assets/images"/keuangan-2026-08-*.jpg

echo
echo "=== DENYLIST CHECK ==="

FAIL=0

for bad in \
  ".git" ".vscode" "worker-tanya-mjhk" "scripts" "supabase" \
  "node_modules" ".wrangler" ".env" ".dev.vars"
do
  if find "$DIST" -name "$bad" -print -quit | grep -q .; then
    echo "[FAIL] Ditemukan forbidden path: $bad"
    FAIL=1
  else
    echo "[PASS] $bad tidak ada"
  fi
done

if find "$DIST" -type f \( -name '*.bak' -o -name '*.phase9b.bak' \) -print -quit | grep -q .; then
  echo "[FAIL] Backup file masih masuk artifact"
  FAIL=1
else
  echo "[PASS] Backup file tidak ada"
fi

if [ -e "$DIST/assets/data" ]; then
  echo "[FAIL] Legacy assets/data masih ada"
  FAIL=1
else
  echo "[PASS] Legacy assets/data tidak ada"
fi

if find "$DIST/assets/images" -maxdepth 1 -type f -name 'keuangan-2026-08-*.jpg' -print -quit | grep -q .; then
  echo "[FAIL] Legacy finance JPG masih ada"
  FAIL=1
else
  echo "[PASS] Legacy finance JPG tidak ada"
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
