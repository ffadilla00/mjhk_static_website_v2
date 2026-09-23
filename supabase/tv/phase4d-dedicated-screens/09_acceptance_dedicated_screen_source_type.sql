-- MJHK TV Phase 4D-A2
-- 09_acceptance_dedicated_screen_source_type.sql
-- READ ONLY.

with constraint_check as (
  select pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  where con.conrelid = 'public.tv_content'::regclass
    and con.conname = 'tv_content_source_type_check'
)
select
  case
    when definition ilike '%dedicated_screen%'
      then 'PASS'
    else 'FAIL'
  end as dedicated_screen_allowed,
  definition
from constraint_check;

-- Confirm repository remains compatible with state → content mapping.
select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.tv_state_assets'::regclass
  and con.conname = 'tv_state_assets_content_id_fkey';

-- Confirm unique source identity remains available:
-- one dedicated record per (source_type, source_id).
select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.tv_content'::regclass
  and con.conname = 'tv_content_source_type_source_id_key';
