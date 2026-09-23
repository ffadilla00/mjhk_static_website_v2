#!/usr/bin/env bash
set -u
PASS=0; WARN=0; FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A2 DOM STRUCTURE ALIGNMENT VERIFY ==="

for f in \
  admin/tv-dedicated-screens.html \
  admin/tv-dedicated-screens.css \
  admin/tv-dedicated-screens.js \
  scripts/apply-tv-phase4da2-dom-structure-alignment.mjs
do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check scripts/apply-tv-phase4da2-dom-structure-alignment.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" || fail "apply script syntax ERROR"

if grep -Fq 'class="admin-shell"' admin/tv-dedicated-screens.html; then
  fail "Legacy admin-shell masih ada"
else
  pass "Legacy admin-shell sudah hilang"
fi

grep -Fq '<aside class="sidebar">' admin/tv-dedicated-screens.html \
  && pass "Sidebar structure tersedia" || fail "Sidebar structure hilang"

grep -Fq '<main class="content">' admin/tv-dedicated-screens.html \
  && pass "main.content structure tersedia" || fail "main.content structure hilang"

python - <<'PY'
from pathlib import Path
s = Path("admin/tv-dedicated-screens.html").read_text(encoding="utf-8")
a = s.find('<div class="dedicated-page">')
b = s.find('</main>', a)
d = s.find('<dialog id="editorDialog"', a)
ok = a >= 0 and b > a and d > b and s[a:b].count("</div>") >= s[a:b].count("<div")
print("[PASS] dedicated-page ditutup di dalam main.content" if ok else "[FAIL] nesting dedicated-page/main tidak valid")
raise SystemExit(0 if ok else 1)
PY
[[ $? -eq 0 ]] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

if grep -Fq 'PHASE4D-A2 DESKTOP SHELL HOTFIX START' admin/tv-dedicated-screens.css; then
  fail "Legacy desktop grid override masih ada"
else
  pass "Legacy desktop grid override sudah dibersihkan"
fi

grep -Fq 'const db = window.mjhkSupabase;' admin/tv-dedicated-screens.js \
  && pass "Supabase wiring tetap utuh" || fail "Supabase wiring berubah"

grep -Fq 'src="tv-dedicated-screens.js"' admin/tv-dedicated-screens.html \
  && pass "Dedicated Screens JS tetap wired" || fail "JS wiring hilang"

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"; exit 1
