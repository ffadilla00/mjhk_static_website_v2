-- =============================================================================
-- MJHK TV — Phase 2B VERIFY
-- Run after 01_phase2b_secure_device_rpc.sql
-- =============================================================================

do $$
declare
  v_version text;
  v_rls_off integer;
begin
  select schema_version into v_version
  from public.tv_schema_meta
  where id = 1;

  if v_version is distinct from '2B.1.0' then
    raise exception 'VERIFY FAILED: expected schema 2B.1.0, got %.', coalesce(v_version,'NULL');
  end if;

  if to_regclass('public.tv_device_pairing_sessions') is null then
    raise exception 'VERIFY FAILED: tv_device_pairing_sessions missing.';
  end if;

  if to_regclass('public.tv_device_security_events') is null then
    raise exception 'VERIFY FAILED: tv_device_security_events missing.';
  end if;

  select count(*) into v_rls_off
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('tv_device_pairing_sessions','tv_device_security_events')
    and c.relrowsecurity = false;

  if v_rls_off <> 0 then
    raise exception 'VERIFY FAILED: new Phase 2B tables must have RLS enabled.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='tv_devices'
      and column_name='paired_at'
  ) then
    raise exception 'VERIFY FAILED: tv_devices.paired_at missing.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='tv_device_commands'
      and column_name='lease_expires_at'
  ) then
    raise exception 'VERIFY FAILED: command lease columns missing.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='tv_content'
      and column_name='storage_path'
  ) then
    raise exception 'VERIFY FAILED: tv_content.storage_path missing.';
  end if;

  if to_regprocedure('public.tv_admin_publish_config(jsonb)') is null then
    raise exception 'VERIFY FAILED: admin publish RPC missing.';
  end if;

  if to_regprocedure('public.tv_device_claim_pairing(text,jsonb)') is null then
    raise exception 'VERIFY FAILED: device claim RPC missing.';
  end if;

  if to_regprocedure('public.tv_device_heartbeat(text,text,jsonb)') is null then
    raise exception 'VERIFY FAILED: heartbeat RPC missing.';
  end if;

  if to_regprocedure('public.tv_device_pull_commands(text,text,integer)') is null then
    raise exception 'VERIFY FAILED: command pull RPC missing.';
  end if;

  if has_function_privilege(
      'anon',
      'public.tv_device_claim_pairing(text,jsonb)',
      'EXECUTE'
    ) then
    raise exception 'VERIFY FAILED: anon must NOT execute device claim RPC.';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.tv_device_heartbeat(text,text,jsonb)',
      'EXECUTE'
    ) then
    raise exception 'VERIFY FAILED: authenticated role must NOT execute device heartbeat RPC.';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.tv_device_heartbeat(text,text,jsonb)',
      'EXECUTE'
    ) then
    raise exception 'VERIFY FAILED: service_role must execute device heartbeat RPC.';
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.tv_admin_publish_config(jsonb)',
      'EXECUTE'
    ) then
    raise exception 'VERIFY FAILED: authenticated must execute admin publish RPC.';
  end if;

  if has_function_privilege(
      'anon',
      'public.tv_admin_publish_config(jsonb)',
      'EXECUTE'
    ) then
    raise exception 'VERIFY FAILED: anon must NOT execute admin publish RPC.';
  end if;
end $$;

-- Human-readable report.

select
  'schema_version' as check_name,
  schema_version as value
from public.tv_schema_meta
where id = 1;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and (
    routine_name like 'tv_admin_%'
    or routine_name like 'tv_device_%'
  )
order by routine_name;

select
  'anon_device_claim_execute' as privilege,
  has_function_privilege(
    'anon',
    'public.tv_device_claim_pairing(text,jsonb)',
    'EXECUTE'
  ) as allowed

union all

select
  'authenticated_heartbeat_execute',
  has_function_privilege(
    'authenticated',
    'public.tv_device_heartbeat(text,text,jsonb)',
    'EXECUTE'
  )

union all

select
  'service_role_heartbeat_execute',
  has_function_privilege(
    'service_role',
    'public.tv_device_heartbeat(text,text,jsonb)',
    'EXECUTE'
  )

union all

select
  'authenticated_admin_publish_execute',
  has_function_privilege(
    'authenticated',
    'public.tv_admin_publish_config(jsonb)',
    'EXECUTE'
  );

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public'
  and c.relname in (
    'tv_device_pairing_sessions',
    'tv_device_security_events'
  )
order by c.relname;

select
  device_heartbeat_interval_seconds,
  device_screenshot_interval_seconds,
  device_command_poll_seconds,
  device_offline_after_seconds
from public.tv_system_settings
where id = 1;

select
  id,
  public,
  file_size_limit
from storage.buckets
where id in ('tv-content','tv-monitor')
order by id;
