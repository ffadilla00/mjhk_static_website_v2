#!/usr/bin/env bash
set -e

JS_BACKUP="admin/admin.js.finance-typography-v2.bak"
CSS_BACKUP="admin/admin.css.finance-typography-v2.bak"

if [[ ! -f "$JS_BACKUP" || ! -f "$CSS_BACKUP" ]]; then
  echo "[ERROR] Backup Finance Typography v2.0 tidak lengkap."
  exit 1
fi

cp "$JS_BACKUP" admin/admin.js
cp "$CSS_BACKUP" admin/admin.css

echo "[OK] admin.js dan admin.css dikembalikan ke kondisi sebelum Finance Typography v2.0."
