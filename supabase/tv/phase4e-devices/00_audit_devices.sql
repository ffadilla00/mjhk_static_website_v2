-- MJHK TV Phase 4E — Devices Audit
-- READ ONLY

select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'tv_devices',
    'tv_device_pairing_sessions',
    'tv_device_commands',
    'tv_device_security_events',
    'tv_admin_device_overview'
  )
order by table_name, ordinal_position;

select
  c.relname as table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'tv_devices',
    'tv_device_pairing_sessions',
    'tv_device_commands',
    'tv_device_security_events'
  )
order by c.relname, con.conname;

select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'tv_devices',
    'tv_device_pairing_sessions',
    'tv_device_commands',
    'tv_device_security_events'
  )
order by tablename, indexname;

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'tv_devices',
    'tv_device_pairing_sessions',
    'tv_device_commands',
    'tv_device_security_events'
  )
order by c.relname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tv_devices',
    'tv_device_pairing_sessions',
    'tv_device_commands',
    'tv_device_security_events'
  )
order by tablename, policyname;

-- Current devices without secret/token columns.
select *
from public.tv_admin_device_overview
order by device_name nulls last, device_code;

-- Pairing sessions: inspect schema/result but do not export secret/token fields manually.
select *
from public.tv_device_pairing_sessions
order by created_at desc
limit 50;

select *
from public.tv_device_commands
order by created_at desc
limit 100;

select *
from public.tv_device_security_events
order by created_at desc
limit 100;

select
  id,
  name,
  is_default,
  prayer_panel_side,
  updated_at
from public.tv_display_profiles
order by is_default desc, name;

select *
from public.tv_publication_state;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like 'tv_device_%'
    or p.proname like 'tv_admin_device_%'
  )
order by p.proname;

select
  pg_get_viewdef('public.tv_admin_device_overview'::regclass, true)
    as tv_admin_device_overview_definition;
