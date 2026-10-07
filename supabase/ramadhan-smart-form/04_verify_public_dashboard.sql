do $$
declare
  function_exists boolean;
  security_definer_enabled boolean;
  anon_can_execute boolean;
  anon_can_select_table boolean;
  payload jsonb;
begin
  select to_regprocedure('public.get_ramadhan_public_dashboard()') is not null
  into function_exists;

  if not function_exists then
    raise exception 'FAIL: fungsi public.get_ramadhan_public_dashboard belum tersedia';
  end if;

  select prosecdef
  into security_definer_enabled
  from pg_proc
  where oid = 'public.get_ramadhan_public_dashboard()'::regprocedure;

  if not security_definer_enabled then
    raise exception 'FAIL: fungsi dashboard public belum menggunakan SECURITY DEFINER';
  end if;

  select has_function_privilege(
    'anon',
    'public.get_ramadhan_public_dashboard()',
    'EXECUTE'
  ) into anon_can_execute;

  if not anon_can_execute then
    raise exception 'FAIL: role anon belum dapat menjalankan fungsi dashboard public';
  end if;

  select has_table_privilege('anon', 'public.aspirasi_ramadhan', 'SELECT')
  into anon_can_select_table;

  if anon_can_select_table then
    raise exception 'FAIL: role anon tidak boleh memiliki SELECT langsung ke tabel aspirasi_ramadhan';
  end if;

  select public.get_ramadhan_public_dashboard() into payload;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'FAIL: payload dashboard public tidak valid';
  end if;

  if not (payload ? 'program_dipertahankan') then
    raise exception 'FAIL: payload dashboard belum memuat program yang perlu dipertahankan';
  end if;

  if payload::text ~ '"(nama|whatsapp|catatan_internal|reviewed_by|reviewed_at)"[[:space:]]*:' then
    raise exception 'FAIL: payload dashboard public memuat field privat';
  end if;

  raise notice 'PASS: fungsi dashboard public tersedia, anonim, dan tidak membuka SELECT tabel';
end $$;

select public.get_ramadhan_public_dashboard() as dashboard_public_preview;
