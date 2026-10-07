begin;

create or replace function public.get_ramadhan_public_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select
      created_at,
      program_prioritas,
      coalesce(program_dipertahankan_pilihan, '{}'::text[]) as program_dipertahankan_pilihan,
      area_peningkatan,
      partisipasi,
      usulan_baru
    from public.aspirasi_ramadhan
  ),
  program_counts as (
    select expanded.item as key, count(*)::integer as total
    from base
    cross join lateral unnest(program_prioritas) as expanded(item)
    group by expanded.item
  ),
  improvement_counts as (
    select expanded.item as key, count(*)::integer as total
    from base
    cross join lateral unnest(area_peningkatan) as expanded(item)
    group by expanded.item
  ),
  retained_program_counts as (
    select expanded.item as key, count(*)::integer as total
    from base
    cross join lateral unnest(program_dipertahankan_pilihan) as expanded(item)
    group by expanded.item
  ),
  participation_counts as (
    select partisipasi as key, count(*)::integer as total
    from base
    group by partisipasi
  ),
  public_suggestions as (
    select
      created_at,
      program_prioritas,
      program_dipertahankan_pilihan,
      area_peningkatan,
      partisipasi,
      regexp_replace(
        regexp_replace(
          btrim(usulan_baru),
          '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}',
          '[email disamarkan]',
          'gi'
        ),
        '([+]?62|0)[0-9][0-9 .()/-]{6,}[0-9]',
        '[nomor disamarkan]',
        'g'
      ) as usulan
    from base
    where nullif(btrim(usulan_baru), '') is not null
    order by created_at desc
  )
  select jsonb_build_object(
    'total_aspirasi', (select count(*)::integer from base),
    'masuk_hari_ini', (
      select count(*)::integer
      from base
      where (created_at at time zone 'Asia/Jakarta')::date =
            (now() at time zone 'Asia/Jakarta')::date
    ),
    'bersedia_berpartisipasi', (
      select count(*)::integer
      from base
      where partisipasi in ('relawan', 'donatur', 'relawan_dan_donatur', 'mungkin')
    ),
    'total_usulan_baru', (
      select count(*)::integer
      from base
      where nullif(btrim(usulan_baru), '') is not null
    ),
    'terakhir_diperbarui', (select max(created_at) from base),
    'prioritas_program', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', key, 'count', total)
        order by total desc, key
      )
      from program_counts
    ), '[]'::jsonb),
    'area_peningkatan', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', key, 'count', total)
        order by total desc, key
      )
      from improvement_counts
    ), '[]'::jsonb),
    'program_dipertahankan', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', key, 'count', total)
        order by total desc, key
      )
      from retained_program_counts
    ), '[]'::jsonb),
    'partisipasi', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', key, 'count', total)
        order by total desc, key
      )
      from participation_counts
    ), '[]'::jsonb),
    'usulan_baru', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'created_at', created_at,
          'pengirim', 'Anonim',
          'program_prioritas', program_prioritas,
          'program_dipertahankan_pilihan', program_dipertahankan_pilihan,
          'area_peningkatan', area_peningkatan,
          'partisipasi', partisipasi,
          'usulan', usulan
        )
        order by created_at desc
      )
      from public_suggestions
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_ramadhan_public_dashboard() from public;
grant execute on function public.get_ramadhan_public_dashboard() to anon, authenticated;

comment on function public.get_ramadhan_public_dashboard() is
  'Dashboard publik anonim untuk Aspirasi Ramadhan 1448 H. Tidak mengembalikan nama, WhatsApp, status, atau catatan internal.';

commit;
