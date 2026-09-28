# Checklist SQL Agenda Poster Template

1. Buka Supabase SQL Editor pada project production MJHK.
2. Jalankan `01_add_agenda_poster_template_fields.sql`.
3. Jalankan `02_verify.sql`.
4. Pastikan empat kolom tampil, dua constraint tampil, dan seluruh nilai invalid bernilai `0`.
5. Deploy patch website setelah verifikasi SQL berhasil.
6. Jangan jalankan `99_rollback.sql` kecuali rollback darurat sudah disetujui.

Migrasi ini additive. Data agenda lama otomatis menggunakan `poster_mode = 'legacy'`, sedangkan nilai `poster_url` lama tidak berubah.
