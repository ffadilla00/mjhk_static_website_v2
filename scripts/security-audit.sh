#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

PASS=0
WARN=0
FAIL=0

green='\033[0;32m'
yellow='\033[0;33m'
red='\033[0;31m'
cyan='\033[0;36m'
reset='\033[0m'

pass() {
  printf "${green}[PASS]${reset} %s\n" "$1"
  PASS=$((PASS+1))
}

warn() {
  printf "${yellow}[WARN]${reset} %s\n" "$1"
  WARN=$((WARN+1))
}

fail() {
  printf "${red}[FAIL]${reset} %s\n" "$1"
  FAIL=$((FAIL+1))
}

section() {
  printf "\n${cyan}=== %s ===${reset}\n" "$1"
}

tmpdir="${TMPDIR:-/tmp}/mjhk-security-audit-$$"
mkdir -p "$tmpdir"
trap 'rm -rf "$tmpdir"' EXIT

section "1. Git working tree"

if git diff --quiet && git diff --cached --quiet; then
  pass "Working tree tidak memiliki perubahan tracked yang belum dicommit."
else
  warn "Ada perubahan tracked yang belum dicommit. Review sebelum production deploy."
  git status --short
fi

section "2. Sensitive files tracked by Git"

sensitive_file_regex='(^|/)(\.env($|\.)|\.dev\.vars$|.*\.pem$|.*\.key$|.*\.p12$|.*\.pfx$|id_rsa$|id_ed25519$|credentials\.json$|secrets?\.json$|service-account.*\.json$)'

tracked_sensitive="$tmpdir/tracked-sensitive.txt"
git ls-files | grep -Ei "$sensitive_file_regex" > "$tracked_sensitive" || true

if [ -s "$tracked_sensitive" ]; then
  fail "Ada file sensitif yang TRACKED oleh Git:"
  cat "$tracked_sensitive"
else
  pass "Tidak ada .env/.dev.vars/private key/credential file yang tracked."
fi

section "3. Secret/token patterns in tracked source"

secret_out="$tmpdir/secrets.txt"

git grep -n -I -E \
  'sb_secret_|service_role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE|CLOUDFLARE_API_TOKEN|CLOUDFLARE_API_KEY|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[0-9A-Za-z]{20,}' \
  -- \
  ':!node_modules/**' \
  ':!worker-tanya-mjhk/node_modules/**' \
  ':!README*.txt' \
  ':!README*.md' \
  ':!scripts/security-audit.sh' \
  > "$secret_out" 2>/dev/null || true

if [ -s "$secret_out" ]; then
  warn "Ditemukan nama/pola secret di source. Review apakah hanya nama variabel/dokumentasi, bukan nilai rahasia:"
  cat "$secret_out"
else
  pass "Tidak ditemukan pola secret bernilai tinggi pada tracked source."
fi

section "4. Node / Wrangler generated directories"

tracked_generated="$tmpdir/generated.txt"
git ls-files | grep -E '(^|/)(node_modules|\.wrangler|dist|coverage)/' > "$tracked_generated" || true

if [ -s "$tracked_generated" ]; then
  fail "Generated directory masih tracked:"
  head -80 "$tracked_generated"
else
  pass "node_modules/.wrangler/dist/coverage tidak tracked."
fi

section "5. Public HTML external scripts/styles"

external_refs="$tmpdir/external-refs.txt"
git grep -n -I -E \
  '<(script|link)[^>]+(src|href)=["'\'']https?://' \
  -- '*.html' \
  > "$external_refs" 2>/dev/null || true

if [ -s "$external_refs" ]; then
  warn "Ada dependency eksternal/CDN pada HTML. Ini perlu masuk CSP allowlist saat production:"
  cat "$external_refs"
else
  pass "Tidak ditemukan script/stylesheet HTTP(S) eksternal pada HTML tracked."
fi

section "6. target=_blank hardening"

blank_refs="$tmpdir/blank.txt"
git grep -n -I -E 'target=["'\'']_blank["'\'']' -- '*.html' '*.js' > "$blank_refs" 2>/dev/null || true

if [ -s "$blank_refs" ]; then
  missing_rel="$tmpdir/missing-rel.txt"
  while IFS= read -r line; do
    printf '%s\n' "$line" | grep -Eqi 'rel=["'\''][^"'\'']*(noopener|noreferrer)' || printf '%s\n' "$line" >> "$missing_rel"
  done < "$blank_refs"

  if [ -s "$missing_rel" ]; then
    warn "Ada target=_blank yang pada baris yang sama belum terlihat rel=noopener/noreferrer:"
    cat "$missing_rel"
  else
    pass "target=_blank yang ditemukan sudah memiliki noopener/noreferrer pada baris yang sama."
  fi
else
  pass "Tidak ada target=_blank statis yang perlu direview."
fi

section "7. Risky browser sinks"

sinks="$tmpdir/sinks.txt"
git grep -n -I -E \
  '(^|[^A-Za-z])(eval\s*\(|new Function\s*\(|document\.write\s*\(|\.innerHTML\s*=|insertAdjacentHTML\s*\()' \
  -- '*.js' \
  ':!worker-tanya-mjhk/node_modules/**' \
  > "$sinks" 2>/dev/null || true

if [ -s "$sinks" ]; then
  warn "Ada DOM sink/dynamic HTML. Tidak otomatis vulnerable, tapi wajib review escaping/sanitization:"
  cat "$sinks"
else
  pass "Tidak ditemukan eval/new Function/document.write/innerHTML sink."
fi

section "8. Public Supabase client"

supabase_client="$tmpdir/supabase-client.txt"
git grep -n -I -E 'SUPABASE_(URL|PUBLISHABLE_KEY)|sb_publishable_' -- '*.js' '*.html' > "$supabase_client" 2>/dev/null || true

if [ -s "$supabase_client" ]; then
  pass "Supabase publishable client reference ditemukan. Ini normal untuk frontend selama RLS aktif."
else
  warn "Supabase publishable config tidak ditemukan lewat pola umum. Pastikan frontend memang menunjuk project production."
fi

section "9. Legacy service-role migration code"

migration_hits="$tmpdir/migration-hits.txt"
git grep -n -I -E 'SUPABASE_SECRET_KEY|service_role' -- 'scripts/**' 'README*' > "$migration_hits" 2>/dev/null || true

if [ -s "$migration_hits" ]; then
  warn "Migration tooling masih menyebut secret/service_role. Jangan host folder scripts/README sebagai bagian public site production:"
  cat "$migration_hits"
else
  pass "Tidak ada migration tooling yang menyebut service-role."
fi

section "10. Public-deploy denylist candidates"

printf "Direkomendasikan TIDAK ikut artifact hosting publik:\n"
printf "  .git/\n"
printf "  .vscode/\n"
printf "  worker-tanya-mjhk/\n"
printf "  scripts/\n"
printf "  supabase/\n"
printf "  README*.txt / README*.md\n"
printf "  node_modules/\n"
printf "  .wrangler/\n"
printf "  .env* / .dev.vars\n"

section "SUMMARY"

printf "PASS: %s\n" "$PASS"
printf "WARN: %s\n" "$WARN"
printf "FAIL: %s\n" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  printf "${red}RESULT: FAIL - jangan production deploy sebelum FAIL direview.${reset}\n"
  exit 2
fi

if [ "$WARN" -gt 0 ]; then
  printf "${yellow}RESULT: REVIEW - tidak ada blocker otomatis, tetapi WARN perlu kita review.${reset}\n"
  exit 0
fi

printf "${green}RESULT: CLEAN${reset}\n"
