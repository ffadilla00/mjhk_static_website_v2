-- MJHK TV Phase 4D-A2
-- 11_verify_dedicated_media_runtime.sql
-- READ ONLY.

select
  id,
  title,
  content_type,
  source_type,
  source_id,
  storage_bucket,
  storage_path,
  status,
  updated_at
from public.tv_content
where source_type = 'dedicated_screen'
order by source_id;

select
  a.state_code,
  a.content_id,
  a.enabled,
  c.source_type,
  c.source_id,
  c.storage_bucket,
  c.storage_path
from public.tv_state_assets a
left join public.tv_content c
  on c.id = a.content_id
where a.content_id is not null
order by a.state_code;

-- Expected: no rows.
select
  a.state_code,
  a.content_id,
  c.source_type,
  c.source_id
from public.tv_state_assets a
join public.tv_content c
  on c.id = a.content_id
where c.source_type = 'dedicated_screen'
  and c.source_id is distinct from a.state_code;

select
  bucket_id,
  name,
  created_at,
  updated_at
from storage.objects
where bucket_id = 'tv-content'
  and name like 'cms-dedicated-screen/%'
order by updated_at desc
limit 50;
