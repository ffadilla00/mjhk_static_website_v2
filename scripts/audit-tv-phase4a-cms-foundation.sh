#!/usr/bin/env bash
set -u

echo "=== MJHK TV PHASE 4A CMS FOUNDATION & WIRING AUDIT ==="
echo

echo "--- REPO / BRANCH ---"
git branch --show-current 2>/dev/null || true
git status --short 2>/dev/null || true
echo

echo "--- ADMIN TREE (max depth 3) ---"
if [[ -d admin ]]; then
  find admin -maxdepth 3 -type f \
    | sort \
    | sed -n '1,240p'
else
  echo "[WARN] admin directory tidak ditemukan"
fi
echo

echo "--- ADMIN ENTRYPOINTS / HTML ---"
find admin -maxdepth 3 -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.mjs' -o -name '*.css' \) \
  2>/dev/null \
  | sort \
  | sed -n '1,240p'
echo

echo "--- ADMIN AUTH / SESSION / ROLE INDICATORS ---"
grep -RniE \
  'auth|session|login|logout|role|admin|supabase|onAuthStateChange|getSession|getUser|signIn|signOut' \
  admin \
  --include='*.js' \
  --include='*.mjs' \
  --include='*.html' \
  2>/dev/null \
  | sed -n '1,260p'
echo

echo "--- EXISTING SUPABASE CLIENT IMPORTS IN ADMIN ---"
grep -RniE \
  '@supabase|createClient|SUPABASE_URL|supabaseClient|supabase\.from|\.from\(' \
  admin \
  --include='*.js' \
  --include='*.mjs' \
  2>/dev/null \
  | sed -n '1,260p'
echo

echo "--- EXISTING ADMIN NAVIGATION / ROUTER HOOKS ---"
grep -RniE \
  'nav|sidebar|menu|router|route|href=.*admin|data-page|data-route|section' \
  admin \
  --include='*.html' \
  --include='*.js' \
  --include='*.mjs' \
  2>/dev/null \
  | sed -n '1,260p'
echo

echo "--- EXISTING TV REFERENCES IN ADMIN/REPO ---"
grep -RniE \
  'tv_devices|tv_config_revisions|tv_content|tv_device_commands|tv_device_pairing_sessions|tv player|tv-player|MJHK TV|revision' \
  admin tv-player scripts supabase \
  --include='*.js' \
  --include='*.mjs' \
  --include='*.html' \
  --include='*.sql' \
  --include='*.md' \
  2>/dev/null \
  | sed -n '1,320p'
echo

echo "--- CSP / SECURITY HEADERS RELEVANT TO ADMIN ---"
grep -RniE \
  'Content-Security-Policy|connect-src|script-src|frame-src|worker-src' \
  . \
  --include='_headers' \
  --include='*.html' \
  --include='*.js' \
  --exclude-dir='.git' \
  --exclude-dir='node_modules' \
  2>/dev/null \
  | sed -n '1,220p'
echo

echo "--- ADMIN FILE SIZE SNAPSHOT ---"
find admin -type f -maxdepth 4 -printf '%p %k KB\n' \
  2>/dev/null \
  | sort \
  | sed -n '1,260p'
echo

echo "--- PHASE 4A STATIC SAFETY CHECK ---"

FAIL=0

if [[ -d admin ]]; then
  echo "[PASS] admin directory tersedia"
else
  echo "[FAIL] admin directory hilang"
  FAIL=$((FAIL+1))
fi

if [[ -d tv-player ]]; then
  echo "[PASS] tv-player directory tersedia"
else
  echo "[FAIL] tv-player directory hilang"
  FAIL=$((FAIL+1))
fi

if [[ -d supabase/tv ]]; then
  echo "[PASS] supabase/tv harness tersedia"
else
  echo "[FAIL] supabase/tv harness hilang"
  FAIL=$((FAIL+1))
fi

echo
echo "FAIL: $FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "RESULT: CLEAN"
  exit 0
fi

echo "RESULT: FAIL"
exit 1
