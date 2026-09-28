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
check_file ramadhan/dashboard/index.html
check_file assets/css/ramadhan-dashboard.css
check_file assets/js/ramadhan-dashboard.js
check_file admin/ramadhan-admin.js
check_file supabase/ramadhan-smart-form/01_create_aspirasi_ramadhan.sql
check_file supabase/ramadhan-smart-form/03_create_public_dashboard_rpc.sql
check_file supabase/ramadhan-smart-form/04_verify_public_dashboard.sql
check_file supabase/ramadhan-smart-form/98_rollback_public_dashboard.sql

check_text index.html 'href="ramadhan/"'
check_text index.html 'href="ramadhan/dashboard/"'
check_text scripts/build-public-dist.sh 'copy_required "ramadhan"'
check_text admin/index.html 'data-tab="ramadhan"'
check_text admin/index.html 'src="ramadhan-admin.js"'
check_text sitemap.xml 'https://www.mj-harapankita.or.id/ramadhan/'
check_text sitemap.xml 'https://www.mj-harapankita.or.id/ramadhan/dashboard/'
check_text ramadhan/index.html 'href="dashboard/"'
check_text ramadhan/dashboard/index.html 'id="refreshDashboard"'
check_text assets/js/ramadhan-dashboard.js 'get_ramadhan_public_dashboard'
check_text supabase/ramadhan-smart-form/03_create_public_dashboard_rpc.sql 'revoke all on function public.get_ramadhan_public_dashboard() from public'
check_text supabase/ramadhan-smart-form/03_create_public_dashboard_rpc.sql 'grant execute on function public.get_ramadhan_public_dashboard() to anon, authenticated'

node --check assets/js/ramadhan-form.js
node --check assets/js/ramadhan-dashboard.js
node --check admin/ramadhan-admin.js

MJHK_HEADER_PROFILE=safe bash scripts/build-public-dist.sh >/tmp/mjhk-ramadhan-build.log 2>&1
check_file public-dist/ramadhan/dashboard/index.html
check_file public-dist/assets/css/ramadhan-dashboard.css
check_file public-dist/assets/js/ramadhan-dashboard.js

if [ "$fail" -ne 0 ]; then
  echo "[RESULT] VERIFIKASI GAGAL"
  exit 2
fi

echo "[RESULT] VERIFIKASI RAMADHAN SMART FORM LULUS"
