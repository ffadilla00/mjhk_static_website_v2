-- MJHK TV Phase 3B.2E-E
-- 00_preflight.sql
-- Read-only safety check. No mutations.

with simulator as (
  select
    d.id,
    d.name,
    d.device_code,
    d.enabled,
    d.desired_revision_id,
    d.applied_revision_id,
    d.last_seen_at,
    d.last_sync_at
  from public.tv_devices d
  where d.name = 'MJHK TEMP SIMULATOR'
),
desired as (
  select
    r.id,
    r.revision_number,
    r.status,
    r.created_at,
    r.published_at,
    jsonb_typeof(r.snapshot) as snapshot_type,
    jsonb_array_length(
      coalesce(r.snapshot -> 'playlist_items', '[]'::jsonb)
    ) as playlist_items_count,
    jsonb_array_length(
      coalesce(r.snapshot -> 'running_text', '[]'::jsonb)
    ) as running_text_count,
    r.change_summary ->> 'test_harness' as test_harness
  from public.tv_config_revisions r
  join simulator s
    on s.desired_revision_id = r.id
)
select
  (select count(*) from simulator) as simulator_count,
  s.id as device_id,
  s.name,
  s.device_code,
  s.enabled,
  s.desired_revision_id,
  s.applied_revision_id,
  (s.desired_revision_id = s.applied_revision_id) as baseline_in_sync,
  d.revision_number as desired_revision_number,
  d.status as desired_revision_status,
  d.snapshot_type,
  d.playlist_items_count,
  d.running_text_count,
  d.test_harness,
  s.last_seen_at,
  s.last_sync_at
from simulator s
left join desired d on true;
