# MJHK Agenda Poster Speaker Photo CR v1.1

Patch ini menambahkan dua pilihan konten sisi kanan pada poster otomatis Kegiatan, Kajian & Dakwah:

1. **Default (Kutipan + QRIS)**: perilaku existing tetap dipertahankan.
2. **Upload Foto Pemateri/Ustadz**: foto portrait menggantikan seluruh kotak kutipan dan QRIS.

Footer ajakan infak juga diperbesar. Pada mode foto, teks yang menyebut QRIS otomatis disembunyikan karena QRIS tidak tampil pada poster.

## File yang berubah

- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `scripts/verify-agenda-poster-template.sh`
- `supabase/agenda-poster-template/01_add_agenda_poster_template_fields.sql`
- `supabase/agenda-poster-template/02_verify.sql`
- `supabase/agenda-poster-template/99_rollback.sql`
- `supabase/agenda-poster-template/EXECUTION_CHECKLIST.md`

Asset `assets/images/qris-mjhk.jpg` disertakan tanpa perubahan agar patch dapat diverifikasi sebagai satu paket.

## Urutan implementasi

1. Backup branch dan database production.
2. Salin isi patch ke root repository MJHK dengan mempertahankan struktur folder.
3. Jalankan ulang `supabase/agenda-poster-template/01_add_agenda_poster_template_fields.sql` di Supabase SQL Editor.
4. Jalankan `supabase/agenda-poster-template/02_verify.sql`.
5. Jalankan `bash scripts/verify-agenda-poster-template.sh` dari root repository.
6. Lakukan E2E untuk mode default, mode foto, edit agenda, dan kembali dari mode foto ke default.

## Perubahan database

Migrasi tetap additive dan idempotent. Dua kolom baru ditambahkan:

- `template_content_mode`: `default` atau `speaker_photo`, default `default`.
- `speaker_photo_url`: URL foto asli pada bucket `poster-kajian`.

Data agenda lama tidak diubah. Agenda lama otomatis menggunakan mode konten `default`.

## Skenario E2E minimum

- Buat poster template mode default. Kutipan dan QRIS harus tampil.
- Buat poster template mode foto tanpa memilih foto. Simpan harus ditolak.
- Upload JPG, PNG, dan WebP yang valid. Preview harus menampilkan crop portrait dari tengah atas.
- Simpan agenda mode foto. Poster hasil generate harus 1920 x 1080 dan foto tetap tampil saat agenda diedit kembali.
- Ganti foto pada agenda existing. Foto lama dibersihkan setelah database berhasil diperbarui.
- Hapus foto saat mode foto. Simpan harus ditolak sampai foto baru dipilih atau mode dikembalikan ke default.
- Ubah agenda mode foto ke default. Kutipan dan QRIS kembali tampil, teks footer QRIS kembali tampil, dan foto lama dibersihkan.
- Pastikan upload poster manual dan agenda lama tidak berubah perilakunya.

`99_rollback.sql` hanya untuk rollback darurat karena menghapus kolom template beserta data referensi foto.
