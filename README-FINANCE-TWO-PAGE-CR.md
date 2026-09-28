# CR Laporan Keuangan Pekanan Dua Halaman

## Hasil perubahan

Laporan keuangan structured sekarang menghasilkan dua poster Full HD 1920 × 1080:

1. Halaman 1 menampilkan ringkasan dan rincian pemasukan.
2. Halaman 2 menampilkan rincian pengeluaran, total pengeluaran, saldo kas saat ini, dan catatan.

Ukuran teks rincian diperbesar karena setiap jenis transaksi memakai satu halaman penuh. Preview admin menyediakan tombol untuk berpindah antara kedua halaman.

## Kompatibilitas data

- `keuangan.image_url` tetap menjadi URL poster halaman pertama.
- Kolom nullable `keuangan.image_url_page_2` menyimpan URL poster halaman kedua.
- Laporan lama dan mode Legacy Upload Gambar tetap menggunakan satu poster.
- Website publik hanya menampilkan kontrol halaman jika URL poster kedua tersedia.

## Urutan implementasi

1. Pastikan perubahan diterapkan pada branch `feature/ramadhan-smart-form`.
2. Jalankan `supabase/finance-two-page/01_add_second_poster_url.sql` di Supabase SQL Editor.
3. Jalankan `supabase/finance-two-page/02_verify.sql`.
4. Jalankan verifier lokal:

   ```bash
   bash scripts/verify-finance-two-page.sh
   ```

5. Build artifact website:

   ```bash
   MJHK_HEADER_PROFILE=report-only bash scripts/build-public-dist.sh
   ```

6. Deploy website dengan prosedur yang saat ini digunakan MJHK.

## E2E yang perlu dilakukan

1. Login ke Admin lalu buka Laporan Keuangan Pekanan.
2. Buat laporan mode Structured.
3. Isi beberapa pemasukan dan pengeluaran.
4. Pastikan tombol Halaman 1 dan Halaman 2 menampilkan preview yang sesuai.
5. Simpan laporan.
6. Pastikan dua JPG muncul di bucket `laporan-keuangan`.
7. Pastikan row `keuangan` memiliki `image_url` dan `image_url_page_2`.
8. Buka website publik dan pastikan tombol sebelumnya atau berikutnya berpindah poster.
9. Tunggu 12 detik pada laporan terbaru dan pastikan halaman berganti otomatis.
10. Buka laporan lama dan pastikan tetap tampil sebagai satu gambar tanpa kontrol halaman.
11. Edit laporan baru lalu pastikan kedua poster terganti.
12. Hapus data uji lalu pastikan kedua file poster ikut terhapus dari Storage.

## File yang berubah

- `admin/index.html`
- `admin/admin.css`
- `admin/admin.js`
- `assets/css/style.css`
- `assets/js/app.js`
- `scripts/verify-finance-two-page.sh`
- `supabase/finance-two-page/01_add_second_poster_url.sql`
- `supabase/finance-two-page/02_verify.sql`
- `supabase/finance-two-page/99_rollback.sql`
- `supabase/finance-two-page/EXECUTION_CHECKLIST.md`

## Rollback

1. Kembalikan lima file website utama ke versi sebelum patch.
2. Jalankan `supabase/finance-two-page/99_rollback.sql` jika kolom halaman kedua benar-benar tidak digunakan lagi.
3. File JPG halaman kedua yang sudah terunggah perlu dihapus manual dari Storage setelah URL-nya dicatat.
