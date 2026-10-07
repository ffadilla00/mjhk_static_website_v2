do $$
declare
  retained_type text;
  required_constraints integer;
  payload jsonb;
begin
  select data_type into retained_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'aspirasi_ramadhan'
    and column_name = 'program_dipertahankan_pilihan';

  if retained_type is distinct from 'ARRAY' then
    raise exception 'FAIL: kolom program_dipertahankan_pilihan text[] belum tersedia';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'aspirasi_ramadhan'
      and column_name = 'program_dipertahankan_lainnya'
  ) then
    raise exception 'FAIL: kolom program_dipertahankan_lainnya belum tersedia';
  end if;

  select count(*) into required_constraints
  from pg_constraint
  where conrelid = 'public.aspirasi_ramadhan'::regclass
    and conname in (
      'aspirasi_ramadhan_program_prioritas_check',
      'aspirasi_ramadhan_area_peningkatan_check',
      'aspirasi_ramadhan_program_dipertahankan_pilihan_check',
      'aspirasi_ramadhan_program_dipertahankan_lainnya_check'
    );

  if required_constraints <> 4 then
    raise exception 'FAIL: constraint revisi Sekretariat belum lengkap. Ditemukan %', required_constraints;
  end if;

  if not has_column_privilege(
    'anon',
    'public.aspirasi_ramadhan',
    'program_dipertahankan_pilihan',
    'INSERT'
  ) then
    raise exception 'FAIL: role anon belum dapat mengirim program yang dipertahankan';
  end if;

  select public.get_ramadhan_public_dashboard() into payload;

  if not (payload ? 'program_dipertahankan') then
    raise exception 'FAIL: dashboard public belum memuat peringkat program yang dipertahankan';
  end if;

  raise notice 'PASS: revisi kuesioner Sekretariat, akses insert, dan dashboard public tersedia';
end $$;

select public.get_ramadhan_public_dashboard() -> 'program_dipertahankan'
  as program_dipertahankan_preview;
