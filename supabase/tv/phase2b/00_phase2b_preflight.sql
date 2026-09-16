-- =============================================================================
-- MJHK TV — Phase 2B PRE-FLIGHT
-- Read-only checks before Secure Device API/RPC migration.
-- Requires Phase 2A to be fully applied.
-- =============================================================================

do $$
declare
  v_version text;
begin
  if to_regprocedure('public.is_mjhk_admin()') is null then
    raise exception 'PRE-FLIGHT FAILED: public.is_mjhk_admin() tidak ditemukan.';
  end if;

  if to_regclass('public.tv_schema_meta') is null then
    raise exception 'PRE-FLIGHT FAILED: tv_schema_meta tidak ditemukan. Phase 2A belum terpasang.';
  end if;

  select schema_version into v_version
  from public.tv_schema_meta
  where id = 1;

  if v_version is distinct from '2A.1.0' then
    raise exception 'PRE-FLIGHT FAILED: expected schema 2A.1.0, got %.', coalesce(v_version,'NULL');
  end if;

  if to_regclass('public.tv_devices') is null
     or to_regclass('public.tv_config_revisions') is null
     or to_regclass('public.tv_device_commands') is null then
    raise exception 'PRE-FLIGHT FAILED: Phase 2A TV tables incomplete.';
  end if;
end $$;

select
  'schema_version' as check_name,
  schema_version as value
from public.tv_schema_meta
where id = 1;

select
  'registered_devices' as check_name,
  count(*)::text as value
from public.tv_devices;

select
  'published_revisions' as check_name,
  count(*)::text as value
from public.tv_config_revisions
where status = 'published';

select
  'private_tv_buckets' as check_name,
  count(*)::text as value
from storage.buckets
where id in ('tv-content','tv-monitor')
  and public = false;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name like 'tv_device_%'
order by routine_name;
