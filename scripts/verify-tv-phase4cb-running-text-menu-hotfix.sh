#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4C-B RUNNING TEXT MENU HOTFIX VERIFY ==="

for f in \
  admin/tv.html \
  admin/tv-content.html \
  admin/tv-running-text.html \
  scripts/apply-tv-phase4cb-running-text-menu.mjs
do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

node --check scripts/apply-tv-phase4cb-running-text-menu.mjs >/dev/null 2>&1 \
  && pass "apply script syntax OK" \
  || fail "apply script syntax ERROR"

for f in admin/tv.html admin/tv-content.html; do
  COUNT="$(grep -o 'href="tv-running-text.html"' "$f" | wc -l | tr -d ' ')"

  if [[ "$COUNT" == "1" ]]; then
    pass "Running Text link tepat satu kali di $f"
  else
    fail "Running Text link di $f berjumlah $COUNT (expected 1)"
  fi
done

if grep -Eqi \
  '<button[^>]*disabled[^>]*>[^<]*Running Text|Running Text[^<]*<small>Phase 4C' \
  admin/tv.html admin/tv-content.html
then
  fail "Legacy disabled Running Text menu masih ditemukan"
else
  pass "Legacy disabled Running Text menu sudah bersih"
fi

if grep -Fq 'href="tv-content.html"' admin/tv.html \
   && grep -Fq 'href="tv-content.html"' admin/tv-content.html
then
  pass "Slideshow menu tetap tersedia"
else
  fail "Slideshow menu berubah/hilang"
fi

if grep -Fq 'Dashboard TV' admin/tv.html \
   && grep -Fq 'Dashboard TV' admin/tv-content.html
then
  pass "Dashboard TV navigation tetap tersedia"
else
  fail "Dashboard TV navigation berubah/hilang"
fi

if [[ -f scripts/verify-tv-phase4cb-running-text-editor.sh ]]; then
  if bash scripts/verify-tv-phase4cb-running-text-editor.sh \
    >/tmp/mjhk-4cb-menu-reg.log 2>&1
  then
    pass "Phase 4C-B editor verifier CLEAN"
  else
    warn "Phase 4C-B editor verifier belum CLEAN; lihat output berikut"
    cat /tmp/mjhk-4cb-menu-reg.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

[[ "$FAIL" -eq 0 ]] \
  && echo "RESULT: CLEAN" \
  && exit 0

echo "RESULT: FAIL"
exit 1
