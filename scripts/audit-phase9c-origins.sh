#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

TMP="${TMPDIR:-/tmp}/mjhk-origins-$$"
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

echo "=== PHASE 9C ORIGIN / CSP AUDIT ==="

# Only active source files; ignore local hardening backups.
find index.html admin profile assets \
  -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.css' \) \
  ! -name '*.bak' \
  ! -name '*.phase9c1.bak' \
  -print0 2>/dev/null \
| xargs -0 grep -hoE 'https?://[^"'\'')<[:space:]]+' 2>/dev/null \
| sed 's/[;,]$//' \
| sort -u > "$TMP/urls.txt"

echo
echo "=== EXTERNAL URLS ==="
cat "$TMP/urls.txt" || true

echo
echo "=== UNIQUE ORIGINS ==="
sed -E 's#(https?://[^/]+).*#\1#' "$TMP/urls.txt" | sort -u

echo
echo "=== INLINE SCRIPT COUNTS ==="
ACTIVE_HTML=(
  index.html
  admin/index.html
  admin/login.html
  admin/profile.html
  profile/program-fasilitas.html
  profile/sejarah.html
  profile/struktur-dkm.html
  profile/visi-misi.html
)

for f in "${ACTIVE_HTML[@]}"; do
  [ -f "$f" ] || continue
  total="$(grep -c '<script' "$f" 2>/dev/null || true)"
  external="$(grep -c '<script[^>]*src=' "$f" 2>/dev/null || true)"
  inline=$(( total - external ))
  printf "%-38s total=%-2s external=%-2s inline=%-2s\n" "$f" "$total" "$external" "$inline"
done

echo
echo "=== INLINE STYLE COUNTS ==="
for f in "${ACTIVE_HTML[@]}"; do
  [ -f "$f" ] || continue
  blocks="$(grep -c '<style' "$f" 2>/dev/null || true)"
  attrs="$(grep -o 'style=["'\''][^"'\'']*["'\'']' "$f" 2>/dev/null | wc -l | tr -d ' ')"
  printf "%-38s style-block=%-2s style-attr=%-2s\n" "$f" "$blocks" "$attrs"
done

echo
echo "Catatan:"
echo "- Backup *.phase9c1.bak sengaja tidak ikut audit."
echo "- Output ini menjadi basis CSP final."
echo "- CSP enforcement tetap ditunda sampai hosting + domain final dipilih."
