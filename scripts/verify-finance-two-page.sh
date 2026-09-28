#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

pass(){ printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail(){ printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

require_file(){
  if [ -f "$1" ]; then pass "File tersedia: $1"; else fail "File tidak ditemukan: $1"; fi
}

for file in \
  admin/index.html \
  admin/admin.css \
  admin/admin.js \
  assets/css/style.css \
  assets/js/app.js \
  README-FINANCE-TWO-PAGE-CR.md \
  supabase/finance-two-page/01_add_second_poster_url.sql \
  supabase/finance-two-page/02_verify.sql \
  supabase/finance-two-page/99_rollback.sql \
  supabase/finance-two-page/EXECUTION_CHECKLIST.md; do
  require_file "$file"
done

if node --check admin/admin.js >/dev/null && node --check assets/js/app.js >/dev/null; then
  pass "Sintaks JavaScript admin dan publik valid"
else
  fail "Sintaks JavaScript tidak valid"
fi

if grep -q 'id="financePosterPreviewPage1"' admin/index.html \
  && grep -q 'id="financePosterPreviewPage2"' admin/index.html \
  && grep -q 'id="keuanganImageLamaPage2"' admin/index.html; then
  pass "Dua preview poster dan URL lama halaman kedua tersedia"
else
  fail "Struktur dua preview admin belum lengkap"
fi

if grep -q 'buildFinancePosterBlobs' admin/admin.js \
  && grep -q 'image_url_page_2:newImagePage2' admin/admin.js \
  && grep -q 'removeFile("laporan-keuangan",x.image_url_page_2)' admin/admin.js; then
  pass "Alur generate, simpan, dan hapus poster kedua terhubung"
else
  fail "Alur lifecycle poster kedua belum lengkap"
fi

if grep -q 'data-finance-pages' assets/js/app.js \
  && grep -q 'image_url_page_2' assets/js/app.js \
  && grep -q 'data-auto-rotate="true"' assets/js/app.js; then
  pass "Slider dua halaman publik dan rotasi otomatis tersedia"
else
  fail "Slider publik belum lengkap"
fi

if grep -q 'add column if not exists image_url_page_2 text' supabase/finance-two-page/01_add_second_poster_url.sql \
  && grep -q "column_name = 'image_url_page_2'" supabase/finance-two-page/02_verify.sql; then
  pass "Migrasi database idempotent dan memiliki verifier"
else
  fail "Migrasi atau verifier database belum sesuai"
fi

if grep -q 'Finance Poster Two Page CR START' admin/admin.css \
  && grep -q 'Finance Poster Two Page Readability Hotfix v1.1 START' admin/admin.css \
  && grep -q '.finance-page-controls' assets/css/style.css; then
  pass "Style preview admin, hotfix keterbacaan, dan slider publik tersedia"
else
  fail "Style dua halaman belum lengkap"
fi

if python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path

class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])

for filename in ("admin/index.html", "index.html"):
    parser = IdParser()
    parser.feed(Path(filename).read_text(encoding="utf-8"))
    duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
    if duplicates:
        raise SystemExit(f"Duplicate ID pada {filename}: {duplicates}")
PY
then
  pass "Tidak ada ID HTML duplikat"
else
  fail "Ditemukan ID HTML duplikat"
fi

BUILD_ROOT="$(mktemp -d)"
trap 'rm -rf "$BUILD_ROOT"' EXIT
if MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh "$BUILD_ROOT/public-dist" >/tmp/mjhk-finance-two-page-build.log 2>&1 \
  && grep -q 'image_url_page_2' "$BUILD_ROOT/public-dist/admin/admin.js" \
  && grep -q 'data-finance-pages' "$BUILD_ROOT/public-dist/assets/js/app.js"; then
  pass "Build production bersih dan memuat CR dua halaman"
else
  fail "Build production gagal atau CR tidak ikut artifact"
  tail -n 40 /tmp/mjhk-finance-two-page-build.log 2>/dev/null || true
fi

printf '\nTotal PASS: %d\nTotal FAIL: %d\n' "$PASS" "$FAIL"
if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
printf 'RESULT: FINANCE TWO PAGE CR VERIFIED\n'
