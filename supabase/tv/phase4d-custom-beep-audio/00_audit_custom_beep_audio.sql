-- MJHK TV Phase 4D-C3 Custom Beep Audio Audit
-- READ ONLY

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tv_system_settings'
  and column_name like 'beep_%'
order by ordinal_position;

select
  c.relname as table_name,
  con.conname,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'tv_system_settings'
  and pg_get_constraintdef(con.oid) ilike '%beep%'
order by con.conname;

select
  id,
  beep_adhan_count,
  beep_iqamah_count,
  beep_forbidden_count,
  beep_isyraq_count,
  beep_imsak_count,
  updated_at
from public.tv_system_settings
where id = 1;

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    table_name ilike '%audio%'
    or column_name ilike '%audio%'
    or column_name ilike '%sound%'
    or column_name ilike '%beep%'
  )
order by table_name, ordinal_position;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    tablename = 'tv_system_settings'
    or tablename ilike '%audio%'
  )
order by tablename, policyname;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
order by name;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    pg_get_functiondef(p.oid) ilike '%beep_%'
    or pg_get_functiondef(p.oid) ilike '%tv_audio_rules%'
    or pg_get_functiondef(p.oid) ilike '%tv_system_settings%'
  )
order by p.proname;
