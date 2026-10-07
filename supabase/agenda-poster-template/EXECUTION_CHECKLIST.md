# Checklist SQL Agenda Poster Template

1. Buka Supabase SQL Editor pada project production MJHK.
2. Jalankan atau jalankan ulang `01_add_agenda_poster_template_fields.sql`. Script bersifat additive dan aman diulang untuk menambah kolom mode foto.
3. Jalankan `02_verify.sql`.
4. Pastikan enam kolom tampil, tiga constraint tampil, dan seluruh nilai invalid/null bernilai `0`.
5. Deploy patch website setelah verifikasi SQL berhasil.
6. Jangan jalankan `99_rollback.sql` kecuali rollback darurat sudah disetujui.

Migrasi ini additive. Data agenda lama otomatis menggunakan `poster_mode = 'legacy'` dan `template_content_mode = 'default'`. Nilai `poster_url` lama tidak berubah.
