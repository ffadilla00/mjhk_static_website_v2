begin;

alter table public.keuangan
  add column if not exists image_url_page_2 text;

comment on column public.keuangan.image_url_page_2 is
  'URL poster laporan keuangan halaman kedua. NULL untuk laporan satu halaman atau data lama.';

commit;
