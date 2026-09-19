-- MJHK TV Phase 3C-B
-- 01_verify_heartbeat.sql
-- READ ONLY.
--
-- Run after opening/hard-refreshing the player and allowing one heartbeat.

select
  id,
  name,
  device_code,
  enabled,
  network_status,
  app_version,
  device_model,
  android_version,
  screen_width,
  screen_height,
  is_muted,
  current_state,
  current_content_id,
  current_slide_index,
  total_slides,
  remaining_seconds,
  desired_revision_id,
  applied_revision_id,
  last_seen_at,
  last_sync_at,
  last_error,
  last_error_at
from public.tv_devices
where name = 'MJHK TEMP SIMULATOR';
