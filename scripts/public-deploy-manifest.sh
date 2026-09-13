#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

echo "=== MJHK PUBLIC DEPLOY CANDIDATES ==="
echo
echo "File/folder yang secara konsep BOLEH masuk static hosting:"
printf '%s\n' \
  "index.html" \
  "assets/" \
  "profile/" \
  "admin/"
echo
echo "Catatan:"
echo "- admin/ boleh di-host karena akses data tetap dijaga Supabase Auth + RLS."
echo "- Tetapi admin URL tetap public secara jaringan; login/authorization adalah pengamannya."
echo
echo "=== JANGAN IKUT STATIC DEPLOY ==="
printf '%s\n' \
  ".git/" \
  ".vscode/" \
  "worker-tanya-mjhk/" \
  "scripts/" \
  "supabase/" \
  "node_modules/" \
  ".wrangler/" \
  ".env*" \
  ".dev.vars" \
  "README*.txt" \
  "README*.md"
echo
echo "=== TRACKED FILE REVIEW ==="
git ls-files | sed -n '1,250p'
echo
echo "Gunakan hasil ini untuk menentukan output directory / deployment include list."
