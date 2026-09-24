#!/usr/bin/env bash
set -u

PASS=0
FAIL=0
pass(){ echo "[PASS] $1"; PASS=$((PASS+1)); }
fail(){ echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

HTML="admin/tv-prayer-settings.html"
CSS="admin/tv-prayer-settings.css"
JS="admin/tv-beep-audio.js"
SQL="supabase/tv/phase4d-custom-beep-audio/01_add_beep_audio_config.sql"

echo "=== MJHK TV PHASE 4D-C3 CUSTOM BEEP AUDIO SOURCE VERIFY ==="

for f in "$HTML" "$CSS" "$JS" "$SQL"; do
  [[ -f "$f" ]] && pass "$f exists" || fail "$f missing"
done

grep -Fq 'src="tv-beep-audio.js"' "$HTML" \
  && pass "beep audio JS wired to Prayer Settings" \
  || fail "beep audio JS not wired"

grep -Fq 'Phase 4D-C3 Custom Beep Audio' "$CSS" \
  && pass "beep audio CSS present" \
  || fail "beep audio CSS missing"

grep -Fq 'const beepDb = window.mjhkSupabase;' "$JS" \
  && pass "canonical Supabase client reused" \
  || fail "Supabase client mismatch"

grep -Fq 'BEEP_STORAGE_BUCKET = "tv-content"' "$JS" \
  && pass "existing private tv-content bucket reused" \
  || fail "tv-content bucket not reused"

grep -Fq 'cms-beep-audio' "$JS" \
  && pass "dedicated beep storage prefix present" \
  || fail "beep storage prefix missing"

grep -Fq '"audio/mpeg"' "$JS" \
  && grep -Fq '"audio/mp4"' "$JS" \
  && grep -Fq '"audio/ogg"' "$JS" \
  && pass "audio MIME allowlist aligned" \
  || fail "audio MIME allowlist mismatch"

grep -Fq '5 * 1024 * 1024' "$JS" \
  && pass "5MB application upload limit present" \
  || fail "application upload limit missing"

grep -Fq 'createSignedUrl' "$JS" \
  && pass "private preview uses signed URL" \
  || fail "signed preview missing"

grep -Fq 'URL.createObjectURL' "$JS" \
  && pass "local pending-file preview available" \
  || fail "local preview missing"

grep -Fq 'btn-save' "$JS" \
  && pass "save action uses green convention" \
  || fail "save action convention missing"

grep -Fq 'btn-cancel' "$JS" \
  && pass "cancel action uses orange convention" \
  || fail "cancel action convention missing"

grep -Fq 'class="btn danger"' "$JS" \
  && pass "delete keeps danger styling" \
  || fail "danger styling missing"

grep -Fq '.from("tv_system_settings")' "$JS" \
  && grep -Fq 'beep_audio_config' "$JS" \
  && pass "source config writes tv_system_settings.beep_audio_config" \
  || fail "beep source write contract missing"

if grep -Fq '.from("tv_audio_rules")' "$JS"; then
  fail "deferred tv_audio_rules must remain untouched"
else
  pass "Pre-Adhan audio boundary preserved"
fi

if grep -E \
  'tv_config_revisions|tv_publication_state|desired_revision_id|active_revision_id|publish_revision|revisionAck|revision/ack' \
  "$JS" >/dev/null 2>&1; then
  fail "4D-C3 source editor must not publish/ACK revisions"
else
  pass "revision/publication boundary preserved"
fi

if grep -E \
  'TVStateEngine|engine\.setState|engine\.runScenario|engine\.addEventListener' \
  "$JS" >/dev/null 2>&1; then
  fail "CMS beep source must not control player engine"
else
  pass "state-engine boundary preserved"
fi

grep -Fq 'add column if not exists beep_audio_config jsonb' "$SQL" \
  && pass "JSONB source column migration present" \
  || fail "beep_audio_config migration missing"

grep -Fq 'tv_system_settings_beep_audio_config_object_check' "$SQL" \
  && pass "JSON object constraint present" \
  || fail "JSON object constraint missing"

node --check "$JS" >/dev/null 2>&1 \
  && pass "beep audio JS syntax clean" \
  || fail "beep audio JS syntax error"

grep -Fq '<link rel="stylesheet" href="tv-admin.css">' "$HTML" \
  && pass "canonical Prayer Settings template retained" \
  || fail "canonical template missing"

echo "=== RESULT: PASS=$PASS FAIL=$FAIL ==="
[[ "$FAIL" -eq 0 ]]
