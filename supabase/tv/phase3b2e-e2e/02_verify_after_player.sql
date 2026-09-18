-- MJHK TV Phase 3B.2E-E
-- 02_verify_after_player.sql
--
-- Run AFTER opening/hard-refreshing the TV player and observing
-- bootstrap → revision fetch → revision ACK.

select
  d.id as device_id,
  d.name,
  d.device_code,
  d.desired_revision_id,
  d.applied_revision_id,
  (d.desired_revision_id = d.applied_revision_id) as server_in_sync,
  desired.revision_number as desired_revision_number,
  applied.revision_number as applied_revision_number,
  desired.status as desired_status,
  desired.change_summary ->> 'test_harness' as test_harness,
  desired.snapshot ->> 'message' as desired_message,
  d.last_seen_at,
  d.last_sync_at,
  d.last_error,
  d.last_error_at
from public.tv_devices d
left join public.tv_config_revisions desired
  on desired.id = d.desired_revision_id
left join public.tv_config_revisions applied
  on applied.id = d.applied_revision_id
where d.name = 'MJHK TEMP SIMULATOR';
