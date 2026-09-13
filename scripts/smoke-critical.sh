#!/usr/bin/env bash
set -u

# ============================================================
# MJHK Phase 9B.2 - Non-UI Smoke Test
# ============================================================
#
# Usage:
#   bash scripts/smoke-critical.sh
#
# Optional:
#   bash scripts/smoke-critical.sh \
#     http://127.0.0.1:5500 \
#     https://tanya-mjhk.ffadilla-90.workers.dev
#
# Arg 1 = website base URL
# Arg 2 = Tanya MJHK Worker base URL
#
# This script is READ-ONLY:
# - no admin login credential
# - no insert/update/delete to Supabase
# - no destructive action
# ============================================================

WEB_BASE="${1:-http://127.0.0.1:5500}"
WORKER_BASE="${2:-https://tanya-mjhk.ffadilla-90.workers.dev}"
ORIGIN="${WEB_BASE%/}"

PASS=0
WARN=0
FAIL=0

green='\033[0;32m'
yellow='\033[0;33m'
red='\033[0;31m'
cyan='\033[0;36m'
reset='\033[0m'

pass(){ printf "${green}[PASS]${reset} %s\n" "$1"; PASS=$((PASS+1)); }
warn(){ printf "${yellow}[WARN]${reset} %s\n" "$1"; WARN=$((WARN+1)); }
fail(){ printf "${red}[FAIL]${reset} %s\n" "$1"; FAIL=$((FAIL+1)); }
section(){ printf "\n${cyan}=== %s ===${reset}\n" "$1"; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

TMPDIR_SMOKE="${TMPDIR:-/tmp}/mjhk-smoke-$$"
mkdir -p "$TMPDIR_SMOKE"
trap 'rm -rf "$TMPDIR_SMOKE"' EXIT

http_code() {
  curl -sS -L -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null || printf '000'
}

fetch() {
  curl -sS -L --max-time 20 "$1"
}

assert_http_200() {
  local url="$1"
  local label="$2"
  local code
  code="$(http_code "$url")"
  if [ "$code" = "200" ]; then
    pass "$label -> HTTP 200"
  else
    fail "$label -> HTTP $code ($url)"
  fi
}

assert_body_contains() {
  local url="$1"
  local needle="$2"
  local label="$3"
  local out="$TMPDIR_SMOKE/body.txt"

  if fetch "$url" > "$out" 2>/dev/null && grep -Fqi "$needle" "$out"; then
    pass "$label"
  else
    fail "$label"
  fi
}

post_ask() {
  local question="$1"
  curl -sS --max-time 30 \
    -X POST "${WORKER_BASE%/}/ask" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    --data "{\"question\":\"$question\"}"
}

assert_ask_contains() {
  local question="$1"
  local needle="$2"
  local label="$3"
  local out="$TMPDIR_SMOKE/ask.json"

  if post_ask "$question" > "$out" 2>/dev/null && grep -Fqi "$needle" "$out"; then
    pass "$label"
  else
    fail "$label"
    printf "      response: "
    cat "$out" 2>/dev/null || true
    printf "\n"
  fi
}

# ------------------------------------------------------------
section "1. LOCAL SOURCE SYNTAX"
# ------------------------------------------------------------

if node --check admin/admin.js >/dev/null 2>&1; then
  pass "admin/admin.js syntax OK"
else
  fail "admin/admin.js syntax error"
fi

if node --check admin/profile-admin.js >/dev/null 2>&1; then
  pass "admin/profile-admin.js syntax OK"
else
  fail "admin/profile-admin.js syntax error"
fi

JS_FAIL=0
while IFS= read -r js; do
  if ! node --check "$js" >/dev/null 2>&1; then
    echo "      syntax error: $js"
    JS_FAIL=1
  fi
done < <(find assets/js -maxdepth 1 -type f -name '*.js' | sort)

if [ "$JS_FAIL" -eq 0 ]; then
  pass "Semua assets/js/*.js syntax OK"
else
  fail "Ada JS public yang syntax error"
fi

# ------------------------------------------------------------
section "2. PRODUCTION ARTIFACT"
# ------------------------------------------------------------

if bash scripts/build-public-dist.sh > "$TMPDIR_SMOKE/build.log" 2>&1; then
  pass "public-dist build berhasil"
else
  fail "public-dist build gagal"
  sed -n '1,160p' "$TMPDIR_SMOKE/build.log"
fi

for required in \
  public-dist/index.html \
  public-dist/assets/js/app.js \
  public-dist/assets/js/agenda-public.js \
  public-dist/assets/js/share-hotfix.js \
  public-dist/assets/js/tanya-mjhk.js \
  public-dist/assets/js/supabase-client.js \
  public-dist/profile/sejarah.html \
  public-dist/profile/visi-misi.html \
  public-dist/profile/struktur-dkm.html \
  public-dist/profile/program-fasilitas.html \
  public-dist/admin/login.html \
  public-dist/admin/index.html \
  public-dist/admin/profile.html
do
  if [ -e "$required" ]; then
    pass "$required tersedia"
  else
    fail "$required hilang"
  fi
done

FORBIDDEN_FOUND=0
for forbidden in \
  public-dist/.git \
  public-dist/.vscode \
  public-dist/worker-tanya-mjhk \
  public-dist/scripts \
  public-dist/supabase \
  public-dist/node_modules \
  public-dist/.wrangler \
  public-dist/assets/data
do
  if [ -e "$forbidden" ]; then
    echo "      forbidden: $forbidden"
    FORBIDDEN_FOUND=1
  fi
done

if find public-dist -type f \( -name '*.bak' -o -name '*.phase9b.bak' -o -name '.env' -o -name '.dev.vars' \) -print -quit 2>/dev/null | grep -q .; then
  FORBIDDEN_FOUND=1
fi

if [ "$FORBIDDEN_FOUND" -eq 0 ]; then
  pass "Artifact bebas file/folder development terlarang"
else
  fail "Artifact masih mengandung file/folder development"
fi

# ------------------------------------------------------------
section "3. INTERNAL STATIC REFERENCES"
# ------------------------------------------------------------

node > "$TMPDIR_SMOKE/refcheck.txt" <<'NODE'
const fs = require("fs");
const path = require("path");

const root = path.resolve("public-dist");
let errors = [];

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

for (const file of walk(root).filter(x => x.endsWith(".html"))) {
  const html = fs.readFileSync(file, "utf8");
  const re = /\b(?:src|href)=["']([^"'#]+)["']/g;
  let m;

  while ((m = re.exec(html))) {
    const ref = m[1].trim();

    if (
      /^(https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(ref) ||
      ref.startsWith("//")
    ) continue;

    const clean = ref.split("?")[0].split("#")[0];
    if (!clean) continue;

    const target = clean.startsWith("/")
      ? path.join(root, clean.replace(/^\/+/, ""))
      : path.resolve(path.dirname(file), clean);

    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(root,file)} -> ${ref}`);
    }
  }
}

if (errors.length) {
  console.log(errors.join("\n"));
  process.exit(2);
}

console.log("OK");
NODE

if [ $? -eq 0 ]; then
  pass "Semua src/href lokal pada HTML menunjuk file yang tersedia"
else
  fail "Ada internal static reference yang broken:"
  cat "$TMPDIR_SMOKE/refcheck.txt"
fi

# ------------------------------------------------------------
section "4. PUBLIC WEBSITE HTTP"
# ------------------------------------------------------------

assert_http_200 "${WEB_BASE%/}/" "Beranda"
assert_http_200 "${WEB_BASE%/}/profile/sejarah.html" "Profile - Sejarah"
assert_http_200 "${WEB_BASE%/}/profile/visi-misi.html" "Profile - Visi Misi"
assert_http_200 "${WEB_BASE%/}/profile/struktur-dkm.html" "Profile - Struktur DKM"
assert_http_200 "${WEB_BASE%/}/profile/program-fasilitas.html" "Profile - Program & Fasilitas"

assert_http_200 "${WEB_BASE%/}/admin/login.html" "Admin Login page"
assert_http_200 "${WEB_BASE%/}/admin/index.html" "Admin Dashboard static page"
assert_http_200 "${WEB_BASE%/}/admin/profile.html" "Admin Profile CMS static page"

assert_http_200 "${WEB_BASE%/}/assets/js/app.js" "Public app.js"
assert_http_200 "${WEB_BASE%/}/assets/js/agenda-public.js" "Agenda public JS"
assert_http_200 "${WEB_BASE%/}/assets/js/share-hotfix.js" "Share hotfix JS"
assert_http_200 "${WEB_BASE%/}/assets/js/tanya-mjhk.js" "Tanya MJHK JS"
assert_http_200 "${WEB_BASE%/}/assets/images/logo-mjhk.png" "Logo MJHK"

assert_body_contains "${WEB_BASE%/}/" "Kegiatan, Kajian" "Beranda memuat konsep Agenda Kegiatan/Kajian"
assert_body_contains "${WEB_BASE%/}/" "tanya-mjhk.js" "Beranda memuat Tanya MJHK"

# ------------------------------------------------------------
section "5. STATIC FEATURE WIRING"
# ------------------------------------------------------------

if grep -Fq 'agenda_publik' assets/js/agenda-public.js; then
  pass "Agenda public terhubung ke view agenda_publik"
else
  fail "agenda-public.js tidak terlihat menggunakan agenda_publik"
fi

if grep -Eq 'keuangan|keuangan_ringkasan' assets/js/app.js; then
  pass "Public app memiliki wiring keuangan"
else
  warn "Wiring keuangan tidak terdeteksi dengan pola sederhana"
fi

if grep -Fq 'DOMPurify' admin/profile-admin.js; then
  pass "Profile CMS preview menggunakan DOMPurify"
else
  fail "DOMPurify tidak terdeteksi di profile-admin.js"
fi

if grep -Fq 'function escHTML(value)' admin/admin.js; then
  pass "Admin escHTML hardening aktif"
else
  fail "Admin escHTML hardening tidak ditemukan"
fi

if grep -Fq 'setMetaLines(target,lines)' admin/admin.js; then
  pass "Admin safe metadata rendering aktif"
else
  fail "Admin safe metadata rendering tidak ditemukan"
fi

SHARE_COUNT="$(grep -o 'share-hotfix.js' index.html | wc -l | tr -d ' ')"
if [ "$SHARE_COUNT" = "1" ]; then
  pass "share-hotfix.js direferensikan tepat satu kali"
else
  fail "share-hotfix.js direferensikan $SHARE_COUNT kali"
fi

# ------------------------------------------------------------
section "6. TANYA MJHK WORKER"
# ------------------------------------------------------------

HEALTH="$TMPDIR_SMOKE/health.json"
if curl -sS --max-time 20 "${WORKER_BASE%/}/health" > "$HEALTH" 2>/dev/null; then
  if grep -Fq '"ok":true' "$HEALTH" && grep -Fq '"1.3.2"' "$HEALTH"; then
    pass "Worker health OK - v1.3.2"
  else
    fail "Worker health response tidak sesuai v1.3.2"
    cat "$HEALTH"
    echo
  fi
else
  fail "Worker health tidak dapat diakses"
fi

assert_ask_contains \
  "Assalamualaikum" \
  "Wa'alaikumussalam" \
  "Greeting Assalamualaikum"

assert_ask_contains \
  "Assalamualaikum, ada seminar terdekat?" \
  "Seminar" \
  "Greeting + pertanyaan agenda"

assert_ask_contains \
  "Berapa saldo kas MJHK saat ini?" \
  "Rp" \
  "Pertanyaan saldo kas"

assert_ask_contains \
  "Bagaimana keuangan September 2026?" \
  "3" \
  "Rekap keuangan September"

assert_ask_contains \
  "Siapa presiden Indonesia?" \
  "hanya memberikan informasi resmi" \
  "Out-of-scope dibatasi"

# ------------------------------------------------------------
section "7. SECURITY REGRESSION"
# ------------------------------------------------------------

if git ls-files | grep -Eq '(^|/)(\.env($|\.)|\.dev\.vars$|.*\.pem$|.*\.key$|.*\.p12$|.*\.pfx$)'; then
  fail "Sensitive file terdeteksi tracked oleh Git"
else
  pass "Tidak ada common sensitive file tracked"
fi

if git ls-files | grep -Eq '(^|/)(node_modules|\.wrangler)/'; then
  fail "node_modules/.wrangler masih tracked"
else
  pass "node_modules/.wrangler tidak tracked"
fi

SECRET_OUT="$TMPDIR_SMOKE/secret.txt"
git grep -n -I -E \
  'sb_secret_|SUPABASE_SERVICE_ROLE|CLOUDFLARE_API_TOKEN|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
  -- \
  ':!README*.txt' \
  ':!README*.md' \
  ':!scripts/**' \
  ':!worker-tanya-mjhk/node_modules/**' \
  > "$SECRET_OUT" 2>/dev/null || true

if [ -s "$SECRET_OUT" ]; then
  fail "High-risk secret pattern ditemukan di tracked application source:"
  cat "$SECRET_OUT"
else
  pass "Tidak ada high-risk secret pattern pada application source"
fi

# ------------------------------------------------------------
section "8. OPTIONAL SUPABASE READ PROBE"
# ------------------------------------------------------------

SUPABASE_URL="$(grep -RhoE 'https://[A-Za-z0-9-]+\.supabase\.co' assets/js admin 2>/dev/null | head -1 || true)"
PUB_KEY="$(grep -RhoE 'sb_publishable_[A-Za-z0-9._-]+' assets/js admin 2>/dev/null | head -1 || true)"

if [ -n "$SUPABASE_URL" ] && [ -n "$PUB_KEY" ]; then
  AGENDA_CODE="$(curl -sS -o "$TMPDIR_SMOKE/agenda.json" -w '%{http_code}' \
    "$SUPABASE_URL/rest/v1/agenda_publik?select=id&limit=1" \
    -H "apikey: $PUB_KEY" \
    -H "Authorization: Bearer $PUB_KEY" 2>/dev/null || printf '000')"

  if [ "$AGENDA_CODE" = "200" ]; then
    pass "Supabase public read agenda_publik -> HTTP 200"
  else
    warn "Supabase agenda_publik probe -> HTTP $AGENDA_CODE"
  fi

  KEU_CODE="$(curl -sS -o "$TMPDIR_SMOKE/keu.json" -w '%{http_code}' \
    "$SUPABASE_URL/rest/v1/keuangan?select=id&limit=1" \
    -H "apikey: $PUB_KEY" \
    -H "Authorization: Bearer $PUB_KEY" 2>/dev/null || printf '000')"

  if [ "$KEU_CODE" = "200" ]; then
    pass "Supabase public read keuangan -> HTTP 200"
  else
    warn "Supabase keuangan probe -> HTTP $KEU_CODE"
  fi
else
  warn "Publishable Supabase URL/key tidak berhasil diekstrak otomatis; read probe dilewati"
fi

# ------------------------------------------------------------
section "SUMMARY"
# ------------------------------------------------------------

echo "PASS: $PASS"
echo "WARN: $WARN"
echo "FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  printf "${red}RESULT: FAIL${reset}\n"
  exit 2
fi

if [ "$WARN" -gt 0 ]; then
  printf "${yellow}RESULT: PASS WITH REVIEW${reset}\n"
  exit 0
fi

printf "${green}RESULT: ALL CRITICAL SMOKE TESTS PASSED${reset}\n"
