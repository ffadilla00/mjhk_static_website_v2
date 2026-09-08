MJHK PROFILE CMS MODULE

1. Jalankan supabase/profile-cms.sql di Supabase SQL Editor.

2. Buat Storage bucket baru:
   Name: profile-content
   Public: ON
   Max file size: 5 MB
   Allowed MIME:
   image/jpeg
   image/png
   image/webp

3. Replace file:
   index.html
   assets/css/style.css
   assets/js/app.js

4. Tambahkan file baru:
   profile/sejarah.html
   profile/visi-misi.html
   profile/struktur-dkm.html
   profile/program-fasilitas.html
   assets/css/profile-page.css
   assets/js/profile-page.js
   admin/profile.html
   admin/profile-admin.css
   admin/profile-admin.js

5. Buka:
   http://127.0.0.1:5500/admin/profile.html

6. Login menggunakan akun Admin MJHK yang sama.

7. Isi setiap halaman menggunakan Markdown.
   Contoh:
   ## Visi
   Menjadi masjid...

   ## Misi
   - Memakmurkan masjid
   - Mengembangkan kegiatan jamaah

   Table:
   | Jabatan | Nama |
   | --- | --- |
   | Ketua DKM | Nama |

8. Upload gambar dari tombol Upload Image.
   URL gambar otomatis dimasukkan ke Markdown.

CATATAN:
- Konten public hanya tampil jika status Publish.
- Markdown dirender dengan marked.js.
- HTML hasil render disanitasi dengan DOMPurify.
- Jangan masukkan secret key ke frontend.
- Admin profile saat ini berupa halaman terpisah agar tidak merusak dashboard CRUD yang sudah stabil.
