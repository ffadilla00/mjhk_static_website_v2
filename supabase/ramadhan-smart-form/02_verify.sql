do $$
declare
  rls_enabled boolean;
  policy_count integer;
begin
  if to_regclass('public.aspirasi_ramadhan') is null then
    raise exception 'FAIL: tabel public.aspirasi_ramadhan belum tersedia';
  end if;

  select relrowsecurity into rls_enabled
  from pg_class
  where oid = 'public.aspirasi_ramadhan'::regclass;

  if not rls_enabled then
    raise exception 'FAIL: RLS aspirasi_ramadhan belum aktif';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'aspirasi_ramadhan';

  if policy_count < 4 then
    raise exception 'FAIL: policy aspirasi_ramadhan tidak lengkap. Ditemukan %', policy_count;
  end if;

  raise notice 'PASS: tabel, RLS, dan % policy aspirasi_ramadhan tersedia', policy_count;
end $$;

select
  table_name,
  privilege_type,
  grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'aspirasi_ramadhan'
  and grantee in ('anon','authenticated')
order by grantee, privilege_type;

select
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'aspirasi_ramadhan'
order by policyname;
