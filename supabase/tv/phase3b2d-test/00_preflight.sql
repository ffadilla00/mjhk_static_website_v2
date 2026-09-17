-- MJHK TV Phase 3B.2D-A.1
-- Preflight only. No data changes.

with target as (
  select
    d.id as device_id,
    d.name as device_name,
    d.device_code,
    d.desired_revision_id,
    d.applied_revision_id,
    r.revision_number,
    r.status,
    r.change_summary,
    jsonb_typeof(r.snapshot) as snapshot_type,
    jsonb_array_length(coalesce(r.snapshot->'playlist_items', '[]'::jsonb)) as playlist_count,
    jsonb_array_length(coalesce(r.snapshot->'running_text', '[]'::jsonb)) as running_text_count
  from public.tv_devices d
  left join public.tv_config_revisions r
    on r.id = d.desired_revision_id
  where d.name = 'MJHK TEMP SIMULATOR'
)
select * from target;

select
  count(*) as temp_device_count
from public.tv_devices
where name = 'MJHK TEMP SIMULATOR';

select
  count(*) as desired_revision_count
from public.tv_devices d
join public.tv_config_revisions r
  on r.id = d.desired_revision_id
where d.name = 'MJHK TEMP SIMULATOR';
