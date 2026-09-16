-- =============================================================================
-- MJHK TV — Phase 2C TEMP SIMULATOR VERIFY
-- Run after the Node simulator reports CLEAN.
-- =============================================================================

select
  d.name,
  d.device_code,
  d.enabled,
  d.paired_at is not null as paired,
  d.network_status,
  d.last_seen_at is not null as heartbeat_seen,
  d.last_sync_at is not null as revision_ack_seen,
  d.last_screenshot_at is not null as screenshot_seen,
  d.last_screenshot_path,
  d.applied_revision_id = d.desired_revision_id as desired_revision_applied,
  d.app_version,
  d.device_model,
  d.android_version,
  d.screen_width,
  d.screen_height
from public.tv_devices d
where d.name = 'MJHK TEMP SIMULATOR';

select
  c.command_type,
  c.status,
  c.delivery_attempts,
  c.delivered_at is not null as delivered,
  c.completed_at is not null as completed
from public.tv_device_commands c
join public.tv_devices d on d.id = c.device_id
where d.name = 'MJHK TEMP SIMULATOR'
order by c.created_at;

select
  ps.claimed_at is not null as pairing_claimed,
  ps.expires_at
from public.tv_device_pairing_sessions ps
join public.tv_devices d on d.id = ps.device_id
where d.name = 'MJHK TEMP SIMULATOR'
order by ps.created_at desc;

select
  id,
  status,
  revision_number,
  change_summary
from public.tv_config_revisions
where change_summary->>'test_harness' = 'phase2c_temp_simulator'
order by revision_number desc;
