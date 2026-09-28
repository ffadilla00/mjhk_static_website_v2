# MJHK Agenda Poster No Ornament Patch v1.2

Patch ini mengembalikan desain poster agenda tanpa ornamen ilustrasi.

Yang dipertahankan:

- Tiga preset warna dan label agenda.
- Warna hijau-cream untuk preset Kajian Kitab / Kajian Umum.
- Font besar pada kutipan, tanggal, waktu, lokasi, dan footer infak.
- Footer dua baris agar teks tidak mengecil.
- Verifier tanpa ketergantungan PIL/Pillow.

Cara implementasi:

1. Ekstrak ZIP dari root repository dan izinkan overwrite.
2. Tidak perlu menjalankan ulang SQL.
3. Jalankan `bash scripts/verify-agenda-poster-template.sh`.
4. Pastikan hasil menunjukkan `Total FAIL: 0`.
5. Lakukan hard refresh pada browser admin.

Jika patch ornamen v1.1 sebelumnya sudah diterapkan, tiga file SVG lama boleh dibiarkan. File tersebut tidak lagi dipanggil oleh HTML, CSS, atau JavaScript.
