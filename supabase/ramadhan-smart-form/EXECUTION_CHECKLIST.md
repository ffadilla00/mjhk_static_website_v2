# Eksekusi Modul Aspirasi Ramadhan 1448 H

1. Buka Supabase Dashboard proyek MJHK.
2. Buka SQL Editor.
3. Jalankan `01_create_aspirasi_ramadhan.sql` jika tabel belum tersedia.
4. Jalankan `02_verify.sql` dan pastikan tabel, RLS, serta empat policy dinyatakan lulus.
5. Jalankan `03_create_public_dashboard_rpc.sql`.
6. Jalankan `04_verify_public_dashboard.sql`.
7. Pastikan verifikasi menyatakan fungsi public tersedia, anonim, dan tidak membuka akses `SELECT` langsung ke tabel.
8. Jalankan build website dari root repository:

   `MJHK_HEADER_PROFILE=safe bash scripts/build-public-dist.sh`

9. Buka `/ramadhan/dashboard/` tanpa login.
10. Pastikan statistik, peringkat, partisipasi, dan usulan kegiatan baru tampil.
11. Klik `Perbarui Data` dan pastikan data dimuat tanpa reload halaman.
12. Pastikan nama, WhatsApp, status peninjauan, serta catatan internal tidak tersedia pada response public.

Gunakan `98_rollback_public_dashboard.sql` jika hanya dashboard public yang perlu dibatalkan. Gunakan `99_rollback.sql` hanya jika seluruh modul Aspirasi Ramadhan harus dihapus. Perintah terakhir menghapus fungsi dashboard, tabel, dan semua data aspirasi.
