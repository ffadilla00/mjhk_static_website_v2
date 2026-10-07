# Patch Revisi Kuesioner Aspirasi Ramadhan

Patch ini menerapkan masukan Sekretariat MJHK tanpa menghapus data aspirasi lama.

## Perubahan

1. Pertanyaan nomor 1 tetap menggunakan checkbox dengan batas maksimal lima pilihan.
2. Zakat Fitrah, Infak, dan Fidyah dipisahkan dari Santunan Yatim dan Dhuafa.
3. Pertanyaan nomor 2 mendapat pilihan Kualitas Imam dan Khatib Tarawih serta Kualitas MC Tarawih.
4. Pertanyaan nomor 3 menjadi wajib, menggunakan checkbox, maksimal lima pilihan, dan memiliki daftar jawaban yang sama dengan nomor 1.
5. Dashboard publik menampilkan peringkat program yang perlu dipertahankan.
6. Admin menampilkan pilihan program yang perlu dipertahankan pada tabel, detail tinjauan, pencarian, dan CSV.
7. Jawaban bebas nomor 3 dari formulir versi lama tetap tersimpan dan tetap terbaca di admin.

## Pemasangan File

Ekstrak ZIP ini ke root repository `mjhk_static_website_v2`, lalu izinkan penggantian file dengan nama yang sama.

## Migrasi Supabase untuk Database yang Sudah Aktif

Jalankan berurutan melalui SQL Editor:

1. `supabase/ramadhan-smart-form/05_apply_secretariat_questionnaire_revision.sql`
2. `supabase/ramadhan-smart-form/03_create_public_dashboard_rpc.sql`
3. `supabase/ramadhan-smart-form/04_verify_public_dashboard.sql`
4. `supabase/ramadhan-smart-form/06_verify_secretariat_questionnaire_revision.sql`

Migrasi nomor 05 bersifat additive. Migrasi ini tidak menghapus jawaban lama.

## Instalasi Database Baru

Jalankan berurutan:

1. `01_create_aspirasi_ramadhan.sql`
2. `02_verify.sql`
3. `03_create_public_dashboard_rpc.sql`
4. `04_verify_public_dashboard.sql`
5. `06_verify_secretariat_questionnaire_revision.sql`

## Verifikasi Repository

Jalankan dari root repository:

```bash
bash scripts/verify-ramadhan-smart-form.sh
```

Lanjutkan E2E dengan memastikan:

1. Nomor 1 dan nomor 3 menerima satu sampai lima pilihan.
2. Pilihan keenam ditolak oleh form.
3. Pilihan Lainnya mewajibkan keterangan.
4. Form tidak dapat dikirim jika nomor 3 belum dipilih.
5. Data baru tampil pada admin dan dashboard publik.
6. Data aspirasi versi lama tetap tampil di admin.
