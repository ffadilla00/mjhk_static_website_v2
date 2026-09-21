-- MJHK TV Phase 4B
-- 01_verify_dashboard_contract.sql
-- READ ONLY.
--
-- Confirms exactly the columns used by admin/tv-admin.js.

select
  id,
  name,
  device_code,
  enabled,
  desired_revision_id,
  applied_revision_id,
  last_seen_at,
  last_sync_at,
  network_status,
  app_version,
  device_model,
  screen_width,
  screen_height,
  is_muted,
  current_state,
  current_slide_index,
  total_slides,
  remaining_seconds,
  last_error,
  last_error_at
from public.tv_devices
order by created_at;

select
  id,
  revision_number,
  status,
  created_at,
  published_at,
  change_summary
from public.tv_config_revisions
order by revision_number desc
limit 8;

select
  id,
  title,
  content_type,
  status,
  updated_at
from public.tv_content
order by updated_at desc
limit 12;

select
  id,
  device_id,
  command_type,
  status,
  delivery_attempts,
  created_at,
  delivered_at,
  completed_at,
  error_message
from public.tv_device_commands
order by created_at desc
limit 20;
