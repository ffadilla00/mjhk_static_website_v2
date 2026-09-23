-- MJHK TV Phase 4D-A2
-- 08_verify_dedicated_screen_source_type.sql
-- READ ONLY.

-- 1) Must include dedicated_screen.
select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.tv_content'::regclass
  and con.conname = 'tv_content_source_type_check';

-- 2) Existing content must remain untouched.
select
  source_type,
  count(*) as total
from public.tv_content
group by source_type
order by source_type;

-- 3) No dedicated rows are expected before the A2 upload editor creates them.
select
  id,
  title,
  source_type,
  source_id,
  storage_bucket,
  storage_path,
  status
from public.tv_content
where source_type = 'dedicated_screen'
order by created_at desc;

-- 4) Existing state mappings remain valid.
select
  state_code,
  content_id,
  enabled,
  notes
from public.tv_state_assets
order by state_code;
