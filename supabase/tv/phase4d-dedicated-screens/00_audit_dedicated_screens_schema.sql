-- MJHK TV Phase 4D-A
-- READ ONLY.

select table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name like 'tv_%'
    or table_name ilike '%screen%'
    or table_name ilike '%prayer%'
    or table_name ilike '%theme%'
    or table_name ilike '%layout%'
  )
order by table_name;

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    table_name in ('tv_config_revisions','tv_devices','tv_content','tv_running_text')
    or table_name ilike '%screen%'
    or table_name ilike '%prayer%'
    or table_name ilike '%theme%'
    or table_name ilike '%layout%'
  )
order by table_name, ordinal_position;

select
  cls.relname as table_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and (
    cls.relname like 'tv_%'
    or cls.relname ilike '%screen%'
    or cls.relname ilike '%prayer%'
    or cls.relname ilike '%theme%'
    or cls.relname ilike '%layout%'
  )
order by cls.relname, con.conname;

select
  routine_name,
  routine_type,
  data_type
from information_schema.routines
where routine_schema = 'public'
  and (
    routine_name like 'tv_%'
    or routine_name ilike '%screen%'
    or routine_name ilike '%prayer%'
    or routine_name ilike '%publish%'
    or routine_name ilike '%revision%'
  )
order by routine_name;

select
  id,
  revision_number,
  status,
  jsonb_object_keys(snapshot) as top_level_key,
  created_at
from public.tv_config_revisions
order by revision_number desc, top_level_key
limit 200;

select
  id,
  revision_number,
  status,
  snapshot
from public.tv_config_revisions
where snapshot ?| array[
  'dedicated_screens','screens','state_screens',
  'visual_config','prayer_settings','theme','layout'
]
order by revision_number desc
limit 10;

select
  id,
  title,
  content_type,
  storage_bucket,
  storage_path,
  storage_url,
  status,
  metadata,
  updated_at
from public.tv_content
order by updated_at desc
limit 50;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
where id in ('tv-content','tv-monitor')
   or name ilike '%tv%'
   or name ilike '%screen%'
   or name ilike '%audio%'
order by name;
