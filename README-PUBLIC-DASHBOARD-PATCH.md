# MJHK Ramadhan Public Dashboard v1.1

Patch tambahan ini dipasang setelah Ramadhan SMART Form v1.0 pada branch `feature/ramadhan-smart-form`.

## Fitur

- Halaman public `/ramadhan/dashboard/` tanpa login.
- Statistik total, data hari ini, partisipasi, dan jumlah usulan baru.
- Peringkat prioritas program dan area yang perlu ditingkatkan.
- Seluruh isi `usulan_baru` tampil anonim.
- Nama, WhatsApp, status peninjauan, catatan internal, dan identitas admin tidak dikirim ke browser public.
- Email dan nomor telepon yang tertulis di dalam usulan disamarkan oleh fungsi database.
- Tombol `Perbarui Data` mengambil data terbaru tanpa reload halaman.
- Form dan beranda memiliki tautan menuju dashboard public.

## Instalasi

1. Ekstrak patch ke root repository dan izinkan file existing diperbarui.
2. Jalankan `supabase/ramadhan-smart-form/03_create_public_dashboard_rpc.sql` melalui Supabase SQL Editor.
3. Jalankan `supabase/ramadhan-smart-form/04_verify_public_dashboard.sql`.
4. Jalankan verifier lokal:

   `bash scripts/verify-ramadhan-smart-form.sh`

5. Jalankan build production:

   `MJHK_HEADER_PROFILE=safe bash scripts/build-public-dist.sh`

6. Buka `/ramadhan/dashboard/` tanpa login dan klik `Perbarui Data`.

## Rollback aman

Jalankan `supabase/ramadhan-smart-form/98_rollback_public_dashboard.sql` untuk menghapus fungsi dashboard public tanpa menghapus tabel atau data aspirasi.

`99_rollback.sql` menghapus seluruh modul beserta data. Jangan gunakan untuk rollback dashboard saja.
