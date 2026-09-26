#!/usr/bin/env bash
set -u

ROOT="${1:-.}"
FUNC="tv_admin_revoke_device"

echo "=== MJHK TV PHASE 4E-B REVOKE DEVICE CONTRACT AUDIT ==="
echo "Root: $ROOT"
echo

echo "## 1. Locate revoke function in repository"
MATCHES="$(grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  "create[[:space:]]+or[[:space:]]+replace[[:space:]]+function[[:space:]]+public\.${FUNC}|${FUNC}\(" \
  "$ROOT" 2>/dev/null || true)"

if [[ -n "$MATCHES" ]]; then
  echo "$MATCHES"
else
  echo "[FAIL] Revoke function reference not found in repository."
fi

echo
echo "## 2. Exact local function body"
FOUND_FILE=""

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  if grep -Eqi \
    "create[[:space:]]+or[[:space:]]+replace[[:space:]]+function[[:space:]]+public\.${FUNC}" \
    "$file"; then
    FOUND_FILE="$file"
    echo "--- SOURCE: $file"

    awk -v fn="$FUNC" '
      BEGIN { printing=0; seen_as=0 }
      {
        low=tolower($0)

        if (!printing &&
            low ~ "create[[:space:]]+or[[:space:]]+replace[[:space:]]+function[[:space:]]+public\\." fn) {
          printing=1
        }

        if (printing) {
          print NR ":" $0

          if ($0 ~ /^[[:space:]]*as[[:space:]]+\$\$[[:space:]]*$/) {
            seen_as=1
          } else if (seen_as &&
                     $0 ~ /^[[:space:]]*\$\$;[[:space:]]*$/) {
            exit
          }
        }
      }
    ' "$file"

    echo
  fi
done < <(
  find "$ROOT" \
    -type f \
    \( -name '*.sql' -o -name '*.txt' -o -name '*.md' \) \
    -not -path '*/node_modules/*' \
    -not -path '*/.git/*' \
    2>/dev/null
)

if [[ -z "$FOUND_FILE" ]]; then
  echo "[WARN] Exact CREATE FUNCTION body not found in local SQL/text files."
  echo "[WARN] Signature/grant may exist without the body in the current checkout."
fi

echo
echo "## 3. Required revoke semantics scan"
if [[ -n "$FOUND_FILE" ]]; then
  echo "Source selected: $FOUND_FILE"

  body="$(
    awk -v fn="$FUNC" '
      BEGIN { printing=0; seen_as=0 }
      {
        low=tolower($0)
        if (!printing &&
            low ~ "create[[:space:]]+or[[:space:]]+replace[[:space:]]+function[[:space:]]+public\\." fn) {
          printing=1
        }

        if (printing) {
          print $0
          if ($0 ~ /^[[:space:]]*as[[:space:]]+\$\$[[:space:]]*$/) {
            seen_as=1
          } else if (seen_as &&
                     $0 ~ /^[[:space:]]*\$\$;[[:space:]]*$/) {
            exit
          }
        }
      }
    ' "$FOUND_FILE"
  )"

  check_body() {
    local label="$1"
    local pattern="$2"

    if printf '%s\n' "$body" | grep -Eqi "$pattern"; then
      echo "[FOUND] $label"
    else
      echo "[MISSING] $label"
    fi
  }

  check_body "Admin authorization guard" \
    'is_mjhk_admin|ADMIN_REQUIRED'

  check_body "Device existence validation" \
    'DEVICE_NOT_FOUND|not found|row_count|found'

  check_body "Disable device enabled=false" \
    'enabled[[:space:]]*=[[:space:]]*false'

  check_body "Invalidate device token" \
    'device_token_hash[[:space:]]*=[[:space:]]*null'

  check_body "Clear paired_at" \
    'paired_at[[:space:]]*=[[:space:]]*null'

  check_body "Set network_status unknown/offline" \
    "network_status[[:space:]]*=[[:space:]]*'(unknown|offline)'"

  check_body "Expire pending pairing sessions" \
    'tv_device_pairing_sessions|expires_at[[:space:]]*=[[:space:]]*now\(\)'

  check_body "Write security event" \
    'tv_device_security_events'

  check_body "Security event type looks like revoke" \
    "device_revoked|revoked|revoke"

  check_body "Reason recorded" \
    'p_reason|reason'

  check_body "Return structured result" \
    'jsonb_build_object|returns[[:space:]]+jsonb'
fi

echo
echo "## 4. Grants and execution boundary"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  "(revoke all on function public\.${FUNC}|grant execute on function public\.${FUNC})" \
  "$ROOT" 2>/dev/null || true

echo
echo "## 5. Device authentication contract"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  'tv_require_device|device_token_hash|enabled[[:space:]]*=[[:space:]]*true|DEVICE_AUTH_FAILED' \
  "$ROOT"/supabase \
  "$ROOT"/worker-tv-mjhk \
  "$ROOT"/scripts \
  2>/dev/null | head -220 || true

echo
echo "## 6. Pairing claim enabled guard"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  'd\.enabled[[:space:]]*=[[:space:]]*true|PAIRING_INVALID_OR_EXPIRED' \
  "$ROOT"/supabase \
  "$ROOT"/scripts \
  2>/dev/null | head -120 || true

echo
echo "## 7. Pending pairing session behavior"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  'tv_device_pairing_sessions|claimed_at[[:space:]]+is[[:space:]]+null|expires_at[[:space:]]*=[[:space:]]*now\(\)' \
  "$ROOT"/supabase \
  "$ROOT"/scripts \
  2>/dev/null | head -220 || true

echo
echo "## 8. Security event schema and revoke event references"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  'tv_device_security_events|device_revoked|revoked|revoke_reason' \
  "$ROOT"/supabase \
  "$ROOT"/scripts \
  2>/dev/null | head -220 || true

echo
echo "## 9. UI wiring boundary"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  'Revoke Device|tv_admin_revoke_device|revokeDevice|revokeReason' \
  "$ROOT"/admin \
  "$ROOT"/scripts \
  2>/dev/null | head -220 || true

echo
echo "## 10. Command history / cascade references"
grep -RniE \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude='*.bak' \
  --exclude='*.before-*' \
  'tv_device_commands|references public\.tv_devices\(id\).*on delete|on delete cascade' \
  "$ROOT"/supabase \
  "$ROOT"/scripts \
  2>/dev/null | head -180 || true

echo
echo "## 11. Audit interpretation checklist"
echo "[CHECK] Revoke should require MJHK admin."
echo "[CHECK] Revoke should NOT delete the tv_devices row."
echo "[CHECK] enabled should become false."
echo "[CHECK] device_token_hash should be cleared."
echo "[CHECK] paired_at should be cleared or otherwise auth must become impossible."
echo "[CHECK] pending unclaimed pairing sessions should be expired."
echo "[CHECK] device-authenticated routes must reject the old credential."
echo "[CHECK] pairing claim must reject a disabled device."
echo "[CHECK] reason should be recorded in security history."
echo "[CHECK] historical telemetry / command / pairing records should remain available."
echo
echo "=== END REVOKE DEVICE CONTRACT AUDIT ==="
