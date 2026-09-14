#!/usr/bin/env bash
set -u
SITE="${1:-https://www.mj-harapankita.or.id}"
PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== PHASE 9C.5 PRODUCTION SMOKE ==="
for path in "/" "/assets/js/profile-nav-mobile.js" "/assets/css/profile-nav-mobile.css"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$SITE$path" || true)
  [[ "$code" == "200" ]] && pass "$path -> 200" || fail "$path -> $code"
done

html=$(curl -sS "$SITE/" || true)
grep -Fq 'profile-nav-mobile.js' <<< "$html" && grep -Fq 'profile-nav-mobile.css' <<< "$html" \
  && pass "Homepage production memuat patch mobile nav" \
  || fail "Homepage production belum memuat patch"

grep -q 'nav-dropdown-toggle' <<< "$html" && grep -q 'nav-dropdown-menu' <<< "$html" \
  && pass "Profile dropdown production tersedia" \
  || fail "Profile dropdown production tidak tersedia"

echo
echo "PASS: $PASS"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"
exit 1
