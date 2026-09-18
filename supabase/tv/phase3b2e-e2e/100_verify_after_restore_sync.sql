-- MJHK TV Phase 3B.2E-E
-- 100_verify_after_restore_sync.sql
--
-- Run after 99_restore_previous_desired.sql AND one player hard refresh.
-- The player should automatically return to the previous revision and ACK it.

select
  d.name,
  d.device_code,
  d.desired_revision_id,
  d.applied_revision_id,
  desired.revision_number as desired_revision_number,
  applied.revision_number as applied_revision_number,
  (d.desired_revision_id = d.applied_revision_id) as server_in_sync,
  d.last_sync_at,
  d.last_error,
  d.last_error_at
from public.tv_devices d
left join public.tv_config_revisions desired
  on desired.id = d.desired_revision_id
left join public.tv_config_revisions applied
  on applied.id = d.applied_revision_id
where d.name = 'MJHK TEMP SIMULATOR';
