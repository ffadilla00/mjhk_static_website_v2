MJHK Tahap 3 - Migrasi JSON ke Supabase

Letakkan folder scripts ini di root project:

mjhk_static_website_v2/
  scripts/
    migrate-to-supabase.js

Script membaca:
assets/data/kajian.json
assets/data/media.json
assets/data/keuangan.json

Gunakan Node.js 18+.

PowerShell:
$env:SUPABASE_URL = "https://PROJECT.supabase.co"
$env:SUPABASE_SECRET_KEY = "SECRET_KEY_ANDA"

Dry run:
node scripts/migrate-to-supabase.js --dry-run

Migrasi final:
node scripts/migrate-to-supabase.js

Fungsi script:
- Semua data JSON dimigrasikan.
- Duplicate tidak diinsert ulang.
- Field `hari` pada kajian tidak dikirim.
- Poster kajian lama memakai poster_url jika tersedia, jika tidak null.
- Gambar laporan lama diupload ke bucket laporan-keuangan/archive/.
- image_url database menjadi URL Supabase Storage.
- Jika record keuangan duplicate, file tidak diupload.
- Jika upload file baru berhasil tetapi INSERT database gagal, file baru dihapus sebagai rollback.
- JSON dan gambar lokal tidak dihapus.

PENTING:
Jangan taruh SUPABASE_SECRET_KEY di frontend.
Jangan commit secret key.
Gunakan environment variable lokal saja.
