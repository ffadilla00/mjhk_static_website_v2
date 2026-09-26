#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

fail=0

check_file() {
  if [ -f "$1" ]; then
    echo "[PASS] $1"
  else
    echo "[FAIL] File tidak ditemukan: $1"
    fail=1
  fi
}

check_text() {
  if grep -Fq "$2" "$1"; then
    echo "[PASS] $1 memuat $2"
  else
    echo "[FAIL] $1 tidak memuat $2"
    fail=1
  fi
}

check_file ramadhan/index.html
check_file assets/css/ramadhan.css
check_file assets/js/ramadhan-form.js
check_file admin/ramadhan-admin.js
check_file supabase/ramadhan-smart-form/01_create_aspirasi_ramadhan.sql

check_text index.html 'href="ramadhan/"'
check_text scripts/build-public-dist.sh 'copy_required "ramadhan"'
check_text admin/index.html 'data-tab="ramadhan"'
check_text admin/index.html 'src="ramadhan-admin.js"'
check_text sitemap.xml 'https://www.mj-harapankita.or.id/ramadhan/'

node --check assets/js/ramadhan-form.js
node --check admin/ramadhan-admin.js

if [ "$fail" -ne 0 ]; then
  echo "[RESULT] VERIFIKASI GAGAL"
  exit 2
fi

echo "[RESULT] VERIFIKASI RAMADHAN SMART FORM LULUS"
