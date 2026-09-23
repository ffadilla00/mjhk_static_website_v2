-- MJHK TV Phase 4D-A2
-- 06_preflight_dedicated_screen_source_type.sql
-- READ ONLY.

-- Current tv_content source_type constraint.
select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.tv_content'::regclass
  and con.conname = 'tv_content_source_type_check';

-- Existing source_type distribution.
select
  source_type,
  count(*) as total
from public.tv_content
group by source_type
order by source_type;

-- Ensure no unexpected dedicated_screen row already exists.
select
  id,
  title,
  content_type,
  source_type,
  source_id,
  storage_bucket,
  storage_path,
  status
from public.tv_content
where source_type = 'dedicated_screen'
order by created_at desc;

-- Current state mapping, for baseline only.
select
  state_code,
  content_id,
  enabled,
  notes,
  updated_at
from public.tv_state_assets
order by state_code;
