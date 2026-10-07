# Eksekusi Modul Aspirasi Ramadhan 1448 H

1. Buka Supabase Dashboard proyek MJHK.
2. Buka SQL Editor.
3. Jika tabel belum tersedia, jalankan `01_create_aspirasi_ramadhan.sql` lalu `02_verify.sql`.
4. Jika tabel sudah tersedia, jalankan `05_apply_secretariat_questionnaire_revision.sql`.
5. Jalankan kembali `03_create_public_dashboard_rpc.sql`.
6. Jalankan `04_verify_public_dashboard.sql`.
7. Jalankan `06_verify_secretariat_questionnaire_revision.sql`.
8. Pastikan verifikasi menyatakan fungsi public tersedia, anonim, memuat program yang perlu dipertahankan, dan tidak membuka akses `SELECT` langsung ke tabel.
9. Jalankan build website dari root repository:

   `MJHK_HEADER_PROFILE=safe bash scripts/build-public-dist.sh`

10. Buka `/ramadhan/dashboard/` tanpa login.
11. Pastikan statistik, prioritas, program yang dipertahankan, peningkatan, partisipasi, dan usulan kegiatan baru tampil.
12. Klik `Perbarui Data` dan pastikan data dimuat tanpa reload halaman.
13. Pastikan nama, WhatsApp, status peninjauan, serta catatan internal tidak tersedia pada response public.

Gunakan `98_rollback_public_dashboard.sql` jika hanya dashboard public yang perlu dibatalkan. Gunakan `99_rollback.sql` hanya jika seluruh modul Aspirasi Ramadhan harus dihapus. Perintah terakhir menghapus fungsi dashboard, tabel, dan semua data aspirasi.
