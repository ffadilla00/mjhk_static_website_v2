-- MJHK TV Phase 4C-B
-- 01_verify_running_text.sql
-- READ ONLY.

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tv_running_text'
order by ordinal_position;

select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.tv_running_text'::regclass
order by con.conname;

select
  id,
  text_content,
  sort_order,
  priority,
  active,
  starts_at,
  ends_at,
  weekdays,
  state_scope,
  created_at,
  updated_at
from public.tv_running_text
order by priority desc, sort_order, created_at;
