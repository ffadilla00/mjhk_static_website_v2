# Implementasi Aspirasi Ramadhan SMART 1448 H

Patch ini dibuat untuk branch `feature/ramadhan-smart-form` pada commit dasar `ee077a40f35a08a10afa370b09e9fa5f47a50c5d`.

## Fitur

- Halaman publik `/ramadhan/` dengan enam pertanyaan aspirasi.
- Validasi maksimal lima prioritas program dan tiga area peningkatan.
- Penyimpanan jawaban ke tabel Supabase `aspirasi_ramadhan`.
- RLS yang mengizinkan publik mengirim data tanpa dapat membaca jawaban jamaah lain.
- CTA Aspirasi Ramadhan pada beranda.
- Menu admin untuk pencarian, filter, peninjauan, status tindak lanjut, catatan internal, dan ekspor CSV.
- Sitemap dan proses build telah mencakup halaman Ramadhan.

## Cara memasang patch

1. Pastikan terminal berada pada branch `feature/ramadhan-smart-form` dan working tree bersih.
2. Ekstrak isi ZIP patch ke root repository `mjhk_static_website_v2`.
3. Izinkan penggantian file ketika diminta.
4. Periksa perubahan dengan `git status --short`.
5. Jalankan SQL `supabase/ramadhan-smart-form/01_create_aspirasi_ramadhan.sql` melalui Supabase SQL Editor.
6. Jalankan `supabase/ramadhan-smart-form/02_verify.sql`.
7. Jalankan pemeriksaan lokal:

   `bash scripts/verify-ramadhan-smart-form.sh`

8. Jalankan build produksi:

   `MJHK_HEADER_PROFILE=safe bash scripts/build-public-dist.sh`

9. Uji `/ramadhan/` dan menu `Aspirasi Ramadhan` pada `/admin/` sebelum commit.

## File database

- `01_create_aspirasi_ramadhan.sql` membuat tabel, constraint, indeks, hak akses, dan RLS.
- `02_verify.sql` memeriksa tabel, RLS, hak akses, dan policy.
- `99_rollback.sql` menghapus seluruh tabel beserta data aspirasi. Gunakan hanya jika modul harus dibatalkan sepenuhnya.

## Hasil verifikasi sebelum penyerahan

- Build publik: lulus.
- Pemeriksaan rahasia pada artifact: lulus.
- Sintaks JavaScript: lulus.
- Tautan, label form, ID HTML, dan jumlah opsi: lulus.
- Verifier modul Ramadhan: lulus.
