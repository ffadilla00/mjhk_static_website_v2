#!/usr/bin/env bash
set -u
PASS=0; WARN=0; FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
warn(){ echo "[WARN] $1"; WARN=$((WARN+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== MJHK TV PHASE 4D-A DEDICATED SCREENS AUDIT PACK VERIFY ==="

FILES=(
  "scripts/audit-tv-phase4da-dedicated-screens.sh"
  "supabase/tv/phase4d-dedicated-screens/00_audit_dedicated_screens_schema.sql"
  "supabase/tv/phase4d-dedicated-screens/01_audit_revision_snapshot_contract.sql"
  "admin/tv/PHASE4D_A_DEDICATED_SCREENS_ARCHITECTURE_AUDIT.md"
  "tv-player/MJHK_TV_Phase4D_A_DEDICATED_SCREENS_STATE_CONTRACT.md"
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && pass "$f tersedia" || fail "$f tidak ditemukan"
done

bash -n scripts/audit-tv-phase4da-dedicated-screens.sh >/dev/null 2>&1 \
  && pass "audit shell syntax OK" || fail "audit shell syntax ERROR"

grep -Fq 'PRE_ADHAN' tv-player/MJHK_TV_Phase4D_A_DEDICATED_SCREENS_STATE_CONTRACT.md \
  && grep -Fq 'FRIDAY_PRE_ADHAN' tv-player/MJHK_TV_Phase4D_A_DEDICATED_SCREENS_STATE_CONTRACT.md \
  && pass "Locked states terdokumentasi" || fail "Locked state contract tidak lengkap"

grep -Fq 'ADHAN' tv-player/MJHK_TV_Phase4D_A_DEDICATED_SCREENS_STATE_CONTRACT.md \
  && grep -Fq 'FRIDAY_SALAT' tv-player/MJHK_TV_Phase4D_A_DEDICATED_SCREENS_STATE_CONTRACT.md \
  && pass "Editable states terdokumentasi" || fail "Editable state contract tidak lengkap"

if grep -qiE 'create table|alter table|insert into|update public|delete from|drop table|create policy|storage\.create_bucket' \
  supabase/tv/phase4d-dedicated-screens/*.sql
then
  fail "Phase 4D-A audit SQL harus read-only"
else
  pass "Phase 4D-A SQL read-only"
fi

grep -Fq 'No mutation in 4D-A' admin/tv/PHASE4D_A_DEDICATED_SCREENS_ARCHITECTURE_AUDIT.md \
  && pass "4D-A mutation boundary terdokumentasi" || fail "4D-A boundary hilang"

if [[ -f scripts/verify-tv-phase4cb-running-text-editor.sh ]]; then
  if bash scripts/verify-tv-phase4cb-running-text-editor.sh >/tmp/mjhk-4da-4cb.log 2>&1; then
    pass "Locked Phase 4C-B regression CLEAN"
  else
    warn "Phase 4C-B verifier belum CLEAN di working tree"
    cat /tmp/mjhk-4da-4cb.log
  fi
fi

if [[ -f scripts/verify-tv-phase4ca-private-storage-upload.sh ]]; then
  if bash scripts/verify-tv-phase4ca-private-storage-upload.sh >/tmp/mjhk-4da-4ca.log 2>&1; then
    pass "Locked Phase 4C-A regression CLEAN"
  else
    warn "Phase 4C-A verifier belum CLEAN di working tree"
    cat /tmp/mjhk-4da-4ca.log
  fi
fi

if [[ -f scripts/verify-tv-phase4b-cms-dashboard.sh ]]; then
  if bash scripts/verify-tv-phase4b-cms-dashboard.sh >/tmp/mjhk-4da-4b.log 2>&1; then
    pass "Locked Phase 4B regression CLEAN"
  else
    warn "Phase 4B verifier belum CLEAN di working tree"
    cat /tmp/mjhk-4da-4b.log
  fi
fi

echo
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT: CLEAN" && exit 0
echo "RESULT: FAIL"; exit 1
