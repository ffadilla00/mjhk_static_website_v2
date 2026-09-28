#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
WARN=0

pass(){ printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail(){ printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }
warn(){ printf '[WARN] %s\n' "$1"; WARN=$((WARN+1)); }

require_file(){
  if [ -f "$1" ]; then pass "File tersedia: $1"; else fail "File tidak ditemukan: $1"; fi
}

for file in \
  admin/index.html \
  admin/admin.css \
  admin/admin.js \
  assets/images/qris-mjhk.jpg \
  supabase/agenda-poster-template/01_add_agenda_poster_template_fields.sql \
  supabase/agenda-poster-template/02_verify.sql \
  supabase/agenda-poster-template/99_rollback.sql \
  supabase/agenda-poster-template/EXECUTION_CHECKLIST.md; do
  require_file "$file"
done

if [ -f README-AGENDA-POSTER-TEMPLATE-CR.md ]; then
  pass "Panduan implementasi tersedia"
else
  warn "README-AGENDA-POSTER-TEMPLATE-CR.md tidak ditemukan. Fitur tetap dapat dijalankan."
fi

if node --check admin/admin.js >/dev/null; then
  pass "Sintaks JavaScript admin valid"
else
  fail "Sintaks JavaScript admin tidak valid"
fi

if grep -q 'id="posterMode"' admin/index.html \
  && grep -q 'id="templatePreset"' admin/index.html \
  && grep -q 'id="agendaPosterPreview"' admin/index.html \
  && grep -q 'qris-mjhk.jpg' admin/index.html; then
  pass "Form mode poster, preset, preview, dan QRIS tersedia"
else
  fail "Struktur form poster template belum lengkap"
fi

if grep -q 'buildAgendaPosterBlob' admin/admin.js \
  && grep -q 'uploadBlob("poster-kajian"' admin/admin.js \
  && grep -q 'poster_mode:mode' admin/admin.js \
  && grep -q 'x.poster_mode||"legacy"' admin/admin.js; then
  pass "Alur generate, upload, dan kompatibilitas agenda lama terhubung"
else
  fail "Alur lifecycle poster agenda belum lengkap"
fi

if grep -q 'Agenda Poster Template CR START' admin/admin.css \
  && grep -q '.preset-quran' admin/admin.css \
  && grep -q '.preset-kitab' admin/admin.css \
  && grep -q '.preset-kegiatan' admin/admin.css; then
  pass "Tiga preset poster bawaan tersedia"
else
  fail "Style preset poster belum lengkap"
fi

if grep -q 'fitAgendaText($("#agendaPreviewTanggal"),21,15)' admin/admin.js \
  && grep -q 'fitAgendaText($("#agendaPreviewKutipan"),18,12.5)' admin/admin.js \
  && grep -q 'font-size:17px' admin/admin.css; then
  pass "Hotfix keterbacaan tanggal, waktu, lokasi, kutipan, dan footer tersedia"
else
  fail "Hotfix keterbacaan poster agenda belum lengkap"
fi

if grep -q "add column if not exists poster_mode" supabase/agenda-poster-template/01_add_agenda_poster_template_fields.sql \
  && grep -q "default 'legacy'" supabase/agenda-poster-template/01_add_agenda_poster_template_fields.sql \
  && grep -q "kajian_template_preset_check" supabase/agenda-poster-template/02_verify.sql; then
  pass "Migrasi database additive dan memiliki verifier"
else
  fail "Migrasi atau verifier database belum sesuai"
fi

if python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path

class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])

parser = IdParser()
parser.feed(Path("admin/index.html").read_text(encoding="utf-8"))
duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
if duplicates:
    raise SystemExit(f"Duplicate ID: {duplicates}")

data = Path("assets/images/qris-mjhk.jpg").read_bytes()
if data[:2] != b"\xff\xd8":
    raise SystemExit("Aset QRIS bukan file JPEG yang valid")

sof_markers = {
    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
    0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
}
width = height = None
index = 2
while index < len(data):
    while index < len(data) and data[index] == 0xFF:
        index += 1
    if index >= len(data):
        break
    marker = data[index]
    index += 1
    if marker in (0x01, 0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
        continue
    if index + 2 > len(data):
        break
    length = int.from_bytes(data[index:index + 2], "big")
    if length < 2 or index + length > len(data):
        break
    if marker in sof_markers:
        segment = data[index + 2:index + length]
        if len(segment) < 5:
            break
        height = int.from_bytes(segment[1:3], "big")
        width = int.from_bytes(segment[3:5], "big")
        break
    index += length

if width is None or height is None:
    raise SystemExit("Dimensi JPEG QRIS tidak dapat dibaca")
if width < 1500 or height < 1800:
    raise SystemExit(f"Resolusi QRIS terlalu kecil: {width}x{height}")
PY
then
  pass "ID HTML unik dan resolusi aset QRIS memadai"
else
  fail "Validasi HTML atau aset QRIS gagal"
fi

BUILD_ROOT="$(mktemp -d)"
trap 'rm -rf "$BUILD_ROOT"' EXIT
if MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh "$BUILD_ROOT/public-dist" >/tmp/mjhk-agenda-poster-build.log 2>&1 \
  && test -f "$BUILD_ROOT/public-dist/assets/images/qris-mjhk.jpg" \
  && grep -q 'buildAgendaPosterBlob' "$BUILD_ROOT/public-dist/admin/admin.js" \
  && grep -q 'agendaPosterPreview' "$BUILD_ROOT/public-dist/admin/index.html"; then
  pass "Build production bersih dan memuat CR poster agenda"
else
  fail "Build production gagal atau CR tidak ikut artifact"
  tail -n 40 /tmp/mjhk-agenda-poster-build.log 2>/dev/null || true
fi

printf '\nTotal PASS: %d\nTotal WARN: %d\nTotal FAIL: %d\n' "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
printf 'RESULT: AGENDA POSTER TEMPLATE CR VERIFIED\n'
