# Eksekusi Modul Aspirasi Ramadhan 1448 H

1. Buka Supabase Dashboard proyek MJHK.
2. Buka SQL Editor.
3. Jalankan `01_create_aspirasi_ramadhan.sql`.
4. Jalankan `02_verify.sql`.
5. Pastikan hasil verifikasi menampilkan pesan `PASS` dan empat policy.
6. Jalankan build website dari root repository:

   `MJHK_HEADER_PROFILE=safe bash scripts/build-public-dist.sh`

7. Buka `/ramadhan/`, isi satu data uji, lalu pastikan pesan sukses tampil.
8. Login ke `/admin/`, buka menu `Aspirasi Ramadhan`, dan pastikan data uji terlihat.
9. Ubah status data uji menjadi `Dibaca` dan simpan tinjauan.

Gunakan `99_rollback.sql` hanya jika modul perlu dihapus seluruhnya. Perintah tersebut menghapus tabel beserta semua data aspirasi.
