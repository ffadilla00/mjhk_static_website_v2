-- MJHK TV Phase 4A
-- 00_cms_schema_contract_audit.sql
-- READ ONLY.
--
-- Goal:
-- Audit current TV tables/functions/policies before CMS writes are introduced.

-- 1. Columns for CMS-relevant TV tables.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default,
  identity_generation
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'tv_content',
    'tv_config_revisions',
    'tv_devices',
    'tv_device_commands',
    'tv_device_pairing_sessions'
  )
order by table_name, ordinal_position;

-- 2. Constraints / keys.
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.constraint_schema = tc.constraint_schema
where tc.table_schema = 'public'
  and tc.table_name in (
    'tv_content',
    'tv_config_revisions',
    'tv_devices',
    'tv_device_commands',
    'tv_device_pairing_sessions'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 3. Indexes.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'tv_content',
    'tv_config_revisions',
    'tv_devices',
    'tv_device_commands',
    'tv_device_pairing_sessions'
  )
order by tablename, indexname;

-- 4. RLS enabled?
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'tv_content',
    'tv_config_revisions',
    'tv_devices',
    'tv_device_commands',
    'tv_device_pairing_sessions'
  )
order by tablename;

-- 5. Policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tv_content',
    'tv_config_revisions',
    'tv_devices',
    'tv_device_commands',
    'tv_device_pairing_sessions'
  )
order by tablename, policyname;

-- 6. Existing TV functions/RPCs.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'tv_%'
order by p.proname, arguments;

-- 7. Recent revisions.
select
  id,
  revision_number,
  status,
  created_at,
  published_at,
  change_summary
from public.tv_config_revisions
order by created_at desc
limit 10;

-- 8. Current devices.
select
  id,
  name,
  device_code,
  enabled,
  network_status,
  desired_revision_id,
  applied_revision_id,
  last_seen_at
from public.tv_devices
order by created_at;

-- 9. Content inventory.
select
  id,
  content_type,
  title,
  enabled,
  created_at,
  updated_at
from public.tv_content
order by created_at desc
limit 50;
