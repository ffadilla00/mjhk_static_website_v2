#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

PASS=0
WARN=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== PHASE 9C.3 VERIFY ==="

SITE="https://www.mj-harapankita.or.id"

for f in \
  index.html \
  profile/sejarah.html \
  profile/visi-misi.html \
  profile/struktur-dkm.html \
  profile/program-fasilitas.html
do
  if grep -Fq 'rel="canonical"' "$f"; then
    pass "$f canonical tersedia"
  else
    fail "$f canonical tidak ada"
  fi

  if grep -Fq 'property="og:url"' "$f"; then
    pass "$f Open Graph tersedia"
  else
    fail "$f Open Graph tidak ada"
  fi
done

if [ -f sitemap.xml ] && grep -Fq "$SITE/" sitemap.xml; then
  pass "sitemap.xml menggunakan domain production"
else
  fail "sitemap.xml tidak valid/domain salah"
fi

if [ -f robots.txt ] && grep -Fq "Sitemap: $SITE/sitemap.xml" robots.txt; then
  pass "robots.txt menunjuk sitemap production"
else
  fail "robots.txt belum menunjuk sitemap"
fi

for profile in safe report-only enforce; do
  if MJHK_HEADER_PROFILE="$profile" bash scripts/build-public-dist.sh >/tmp/mjhk-9c3-$profile.log 2>&1; then
    pass "Build profile $profile berhasil"
  else
    fail "Build profile $profile gagal"
    cat /tmp/mjhk-9c3-$profile.log
  fi

  case "$profile" in
    safe)
      if grep -Fq "Content-Security-Policy:" public-dist/_headers 2>/dev/null || \
         grep -Fq "Content-Security-Policy-Report-Only:" public-dist/_headers 2>/dev/null; then
        fail "Safe profile tidak boleh mengaktifkan CSP"
      else
        pass "Safe profile tidak mengaktifkan CSP"
      fi
      ;;
    report-only)
      if grep -Fq "Content-Security-Policy-Report-Only:" public-dist/_headers; then
        pass "Report-only profile benar"
      else
        fail "Report-only profile salah"
      fi
      ;;
    enforce)
      if grep -Fq "Content-Security-Policy:" public-dist/_headers; then
        pass "Enforce profile benar"
      else
        fail "Enforce profile salah"
      fi
      ;;
  esac
done

if grep -R -Fq "Strict-Transport-Security" deploy-config/_headers.safe deploy-config/_headers.report-only deploy-config/_headers.enforce 2>/dev/null; then
  warn "HSTS sudah aktif; pastikan HTTPS final sudah diverifikasi"
else
  pass "HSTS belum diaktifkan sesuai rollout aman"
fi

if grep -Fq "X-Robots-Tag: noindex" deploy-config/_headers.safe; then
  pass "Admin noindex ada pada safe profile"
else
  fail "Admin noindex tidak ada"
fi

if grep -Fq "Cache-Control: no-store" deploy-config/_headers.safe; then
  pass "Admin no-store ada pada safe profile"
else
  fail "Admin no-store tidak ada"
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
