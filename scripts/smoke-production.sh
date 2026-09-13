#!/usr/bin/env bash
set -u

SITE="${1:-https://www.mj-harapankita.or.id}"
APEX="${2:-https://mj-harapankita.or.id}"
WORKER="${3:-https://tanya-mjhk.ffadilla-90.workers.dev}"
EXPECTED_PROFILE="${4:-safe}"

PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

TMP="${TMPDIR:-/tmp}/mjhk-prod-smoke-$$"
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

echo "=== MJHK PRODUCTION SMOKE ==="
echo "Site: $SITE"
echo "Expected header profile: $EXPECTED_PROFILE"

check_200(){
  local url="$1"
  local label="$2"
  local code
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' --max-time 20 "$url" 2>/dev/null || printf '000')"
  [ "$code" = "200" ] && pass "$label -> 200" || fail "$label -> $code"
}

check_header(){
  local url="$1"
  local name="$2"
  local needle="$3"
  local label="$4"
  local out="$TMP/headers.txt"
  curl -sS -I --max-time 20 "$url" > "$out" 2>/dev/null || true
  if grep -Eqi "^${name}:.*${needle}" "$out"; then
    pass "$label"
  else
    fail "$label"
  fi
}

check_200 "$SITE/" "Beranda"
check_200 "$SITE/profile/sejarah.html" "Profile Sejarah"
check_200 "$SITE/profile/visi-misi.html" "Profile Visi Misi"
check_200 "$SITE/profile/struktur-dkm.html" "Profile Struktur DKM"
check_200 "$SITE/profile/program-fasilitas.html" "Profile Program/Fasilitas"
check_200 "$SITE/robots.txt" "robots.txt"
check_200 "$SITE/sitemap.xml" "sitemap.xml"

check_header "$SITE/" "x-content-type-options" "nosniff" "nosniff aktif"
check_header "$SITE/" "referrer-policy" "strict-origin-when-cross-origin" "Referrer-Policy aktif"
check_header "$SITE/" "x-frame-options" "DENY" "X-Frame-Options aktif"
check_header "$SITE/admin/login.html" "x-robots-tag" "noindex" "Admin noindex header aktif"
check_header "$SITE/admin/login.html" "cache-control" "no-store" "Admin no-store aktif"

HEADERS="$TMP/site-headers.txt"
curl -sS -I --max-time 20 "$SITE/" > "$HEADERS" 2>/dev/null || true

case "$EXPECTED_PROFILE" in
  safe)
    if grep -Eqi '^content-security-policy(-report-only)?:' "$HEADERS"; then
      fail "Safe profile seharusnya belum mengirim CSP"
    else
      pass "Safe profile: CSP belum enforcement/report-only"
    fi
    ;;
  report-only)
    grep -Eqi '^content-security-policy-report-only:' "$HEADERS" \
      && pass "CSP Report-Only aktif" \
      || fail "CSP Report-Only belum aktif"
    ;;
  enforce)
    grep -Eqi '^content-security-policy:' "$HEADERS" \
      && pass "CSP enforcement aktif" \
      || fail "CSP enforcement belum aktif"
    ;;
esac

# Apex should eventually redirect to canonical www.
APEX_HEADERS="$TMP/apex.txt"
curl -sS -I --max-time 20 "$APEX/" > "$APEX_HEADERS" 2>/dev/null || true
if grep -Eqi '^HTTP/[^ ]+ 30[1278]' "$APEX_HEADERS" && \
   grep -Eqi '^location: https://www\.mj-harapankita\.or\.id/' "$APEX_HEADERS"; then
  pass "Apex redirect -> canonical www"
else
  warn "Apex redirect belum sesuai/propagasi belum selesai"
fi

# Tanya MJHK CORS/origin production.
ASK_OUT="$TMP/ask.json"
ASK_CODE="$(curl -sS -o "$ASK_OUT" -w '%{http_code}' --max-time 30 \
  -X POST "$WORKER/ask" \
  -H "Origin: $SITE" \
  -H "Content-Type: application/json" \
  --data '{"question":"Assalamualaikum"}' 2>/dev/null || printf '000')"

if [ "$ASK_CODE" = "200" ] && grep -Fqi "Wa'alaikumussalam" "$ASK_OUT"; then
  pass "Tanya MJHK menerima production Origin"
else
  warn "Tanya MJHK production Origin belum diizinkan (HTTP $ASK_CODE)"
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL"
  exit 2
fi
if [ "$WARN" -gt 0 ]; then
  echo "RESULT: PASS WITH REVIEW"
  exit 0
fi
echo "RESULT: CLEAN"
