begin;

alter table public.keuangan
  drop column if exists image_url_page_2;

commit;
