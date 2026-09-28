# MJHK Agenda Poster Template CR v1.0

Patch ini menambahkan generator poster Full HD pada menu **Kegiatan, Kajian & Dakwah** tanpa menghapus alur upload poster manual.

## Cakupan

- Dua metode poster: Template Otomatis dan Upload Poster Manual.
- Tiga preset bawaan: Tafsir & Al-Qur'an, Kajian Kitab / Kajian Umum, serta Kegiatan & Dakwah.
- Kutipan dan sumber kutipan opsional.
- QRIS MJHK tetap tertanam pada seluruh preset.
- Ekspor JPG 1920 × 1080 ke bucket `poster-kajian`.
- Halaman publik tetap membaca kolom `poster_url` yang sudah ada.
- Agenda lama tetap kompatibel dan otomatis dianggap sebagai mode `legacy`.

## Urutan Implementasi

1. Jalankan `supabase/agenda-poster-template/01_add_agenda_poster_template_fields.sql`.
2. Jalankan `supabase/agenda-poster-template/02_verify.sql` dan pastikan semua invalid count bernilai `0`.
3. Deploy seluruh file patch ke branch `feature/ramadhan-smart-form`.
4. Jalankan `bash scripts/verify-agenda-poster-template.sh` dari root project.
5. Login admin, buka menu Kegiatan, Kajian & Dakwah, lalu tambah agenda menggunakan Template Otomatis.

## E2E Wajib

- Buat masing-masing satu poster untuk preset `quran`, `kitab`, dan `kegiatan`.
- Pastikan file hasil tersimpan sebagai JPG Full HD dan tampil di halaman publik.
- Edit agenda hasil template dan pastikan poster digenerate ulang.
- Edit satu agenda lama. Pastikan mode terbaca sebagai Upload Poster Manual dan posternya tidak berubah jika file baru tidak dipilih.
- Buat agenda manual baru dan pastikan validasi mewajibkan file poster.
- Uji scan QRIS dari hasil poster final pada HP dan dari layar TV/proyektor pada jarak jamaah yang realistis.
- Pastikan nomor BSI `7197058042` dan nama Masjid Jami' Harapan Kita terbaca jelas.

## Catatan Rollback

Rollback kode dapat dilakukan dengan mengembalikan file patch. SQL `99_rollback.sql` hanya untuk kondisi darurat karena akan menghapus metadata template, tetapi tidak menghapus `poster_url` yang sudah tersimpan.
