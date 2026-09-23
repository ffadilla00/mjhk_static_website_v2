-- MJHK TV Phase 4D-B
-- READ ONLY.

select table_name
from information_schema.tables
where table_schema='public'
  and (
    table_name ilike 'tv%visual%'
    or table_name ilike 'tv%theme%'
    or table_name ilike 'tv%layout%'
    or table_name ilike 'tv%setting%'
    or table_name ilike 'tv%prayer%'
  )
order by table_name;

select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and (
    table_name ilike 'tv%visual%'
    or table_name ilike 'tv%theme%'
    or table_name ilike 'tv%layout%'
    or table_name ilike 'tv%setting%'
    or table_name ilike 'tv%prayer%'
  )
order by table_name, ordinal_position;

select c.relname as table_name,
       con.conname as constraint_name,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and (
    c.relname ilike 'tv%visual%'
    or c.relname ilike 'tv%theme%'
    or c.relname ilike 'tv%layout%'
    or c.relname ilike 'tv%setting%'
    or c.relname ilike 'tv%prayer%'
  )
order by c.relname, con.conname;

select *
from public.tv_system_settings
order by updated_at desc nulls last
limit 20;

select *
from public.tv_prayer_settings
order by updated_at desc nulls last
limit 20;

select id, revision_number, status, snapshot, created_at
from public.tv_config_revisions
where snapshot ?| array['visual_config','theme','layout','prayer_settings']
order by revision_number desc
limit 10;
