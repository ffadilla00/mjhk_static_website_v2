do $$
begin
  if to_regclass('public.keuangan') is null then
    raise exception 'Tabel public.keuangan tidak ditemukan.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'keuangan'
      and column_name = 'image_url_page_2'
      and data_type = 'text'
  ) then
    raise exception 'Kolom public.keuangan.image_url_page_2 belum tersedia atau tipenya bukan text.';
  end if;
end
$$;

select
  id,
  periode_awal,
  periode_akhir,
  image_url as poster_halaman_1,
  image_url_page_2 as poster_halaman_2,
  case
    when image_url_page_2 is null then 'satu halaman / data lama'
    else 'dua halaman'
  end as format_poster
from public.keuangan
order by periode_akhir desc nulls last, id desc
limit 10;
