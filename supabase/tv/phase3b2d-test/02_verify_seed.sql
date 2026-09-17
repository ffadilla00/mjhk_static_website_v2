-- MJHK TV Phase 3B.2D-A.1
-- Read-only verification. No payload values are printed.

select
  d.device_code,
  d.desired_revision_id,
  d.applied_revision_id,
  r.revision_number,
  r.status,
  jsonb_typeof(r.snapshot) as snapshot_type,
  jsonb_typeof(r.snapshot->'playlist_items') as playlist_items_type,
  jsonb_array_length(coalesce(r.snapshot->'playlist_items', '[]'::jsonb)) as playlist_items_count,
  jsonb_typeof(r.snapshot->'running_text') as running_text_type,
  jsonb_array_length(coalesce(r.snapshot->'running_text', '[]'::jsonb)) as running_text_count,
  r.change_summary->>'test_harness' as test_harness
from public.tv_devices d
join public.tv_config_revisions r
  on r.id = d.desired_revision_id
where d.name = 'MJHK TEMP SIMULATOR';

-- Shape-only contract helpers: field names, never values.
select
  jsonb_object_keys(item) as playlist_item_field
from public.tv_devices d
join public.tv_config_revisions r
  on r.id = d.desired_revision_id
cross join lateral jsonb_array_elements(r.snapshot->'playlist_items') as item
where d.name = 'MJHK TEMP SIMULATOR'
group by 1
order by 1;

select
  jsonb_object_keys(item) as running_text_field
from public.tv_devices d
join public.tv_config_revisions r
  on r.id = d.desired_revision_id
cross join lateral jsonb_array_elements(r.snapshot->'running_text') as item
where d.name = 'MJHK TEMP SIMULATOR'
group by 1
order by 1;
