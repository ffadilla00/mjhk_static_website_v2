# CR Laporan Keuangan Dua Halaman

## Urutan eksekusi

1. Buka Supabase SQL Editor untuk project MJHK.
2. Jalankan `01_add_second_poster_url.sql`.
3. Jalankan `02_verify.sql`.
4. Pastikan verifier tidak menampilkan exception.
5. Deploy file website setelah migrasi berhasil.
6. Buat atau edit satu laporan structured dan pastikan dua URL poster terisi.

## Kompatibilitas

- `image_url` tetap menyimpan poster halaman pertama.
- `image_url_page_2` bersifat nullable.
- Laporan lama yang hanya mempunyai `image_url` tetap dapat ditampilkan.
- Mode upload gambar lama tetap menggunakan satu poster.

## Rollback

Jalankan `99_rollback.sql` hanya jika fitur dua halaman benar-benar dibatalkan. Rollback menghapus referensi URL halaman kedua dari database, tetapi tidak otomatis menghapus file JPG di Storage.
