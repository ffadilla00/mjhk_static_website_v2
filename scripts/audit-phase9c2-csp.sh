#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

echo "=== PHASE 9C.2 CSP SOURCE AUDIT ==="

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

echo
echo "=== INLINE SCRIPT ==="
for f in "${ACTIVE_HTML[@]}"; do
  [ -f "$f" ] || continue
  total="$(grep -c '<script' "$f" 2>/dev/null || true)"
  external="$(grep -c '<script[^>]*src=' "$f" 2>/dev/null || true)"
  inline=$(( total - external ))
  printf "%-38s inline=%s\n" "$f" "$inline"
done

echo
echo "=== INLINE STYLE BLOCK ==="
for f in "${ACTIVE_HTML[@]}"; do
  [ -f "$f" ] || continue
  blocks="$(grep -c '<style' "$f" 2>/dev/null || true)"
  printf "%-38s style-block=%s\n" "$f" "$blocks"
done

echo
echo "=== STYLE ATTRIBUTES ==="
STYLE_ATTR_TOTAL=0
for f in "${ACTIVE_HTML[@]}"; do
  [ -f "$f" ] || continue
  attrs="$(grep -o 'style=["'\''][^"'\'']*["'\'']' "$f" 2>/dev/null | wc -l | tr -d ' ')"
  STYLE_ATTR_TOTAL=$((STYLE_ATTR_TOTAL + attrs))
  printf "%-38s style-attr=%s\n" "$f" "$attrs"
done

echo
echo "=== CSP CANDIDATE ==="
cat deploy-config/csp-policy.txt
echo
echo "Total inline style attributes: $STYLE_ATTR_TOTAL"
echo "Policy sengaja membatasi exception hanya ke style-src-attr 'unsafe-inline'."
