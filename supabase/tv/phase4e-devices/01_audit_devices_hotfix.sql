-- MJHK TV Phase 4E — Devices Audit Hotfix v1
-- READ ONLY
-- Corrected against actual schema exported during Phase 4E audit.

-- A. Current admin overview.
-- Actual column is `name`, not `device_name`.
select *
from public.tv_admin_device_overview
order by name nulls last, device_code;

-- B. Device source fields needed by Admin CMS but not all exposed by overview.
-- Explicitly excludes device_token_hash and any credential secret material.
select
  id,
  name,
  device_code,
  display_profile_id,
  enabled,
  desired_revision_id,
  applied_revision_id,
  last_seen_at,
  last_sync_at,
  last_screenshot_at,
  last_screenshot_path,
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
  last_error,
  last_error_at,
  paired_at,
  credential_version,
  last_token_rotation_at,
  created_at,
  updated_at
from public.tv_devices
order by name, device_code;

-- C. Pairing lifecycle.
-- The source table stores only the SHA-256 hash of the pairing code.
-- Do not export raw token/credential data.
select
  id,
  device_id,
  expires_at,
  claimed_at,
  created_by,
  created_at
from public.tv_device_pairing_sessions
order by created_at desc
limit 50;

-- D. Command history.
select
  id,
  device_id,
  command_type,
  payload,
  status,
  created_by,
  created_at,
  delivered_at,
  completed_at,
  error_message,
  expires_at,
  delivery_attempts,
  lease_expires_at,
  updated_at
from public.tv_device_commands
order by created_at desc
limit 100;

-- E. Security events.
select
  id,
  device_id,
  event_type,
  detail,
  created_at
from public.tv_device_security_events
order by created_at desc
limit 100;

-- F. Display profiles available for assignment.
select
  id,
  name,
  is_default,
  prayer_panel_side,
  updated_at
from public.tv_display_profiles
order by is_default desc, name;

-- G. Publication state.
select
  id,
  active_revision_id,
  updated_at
from public.tv_publication_state
where id = 1;

-- H. Actual admin view definition.
select
  pg_get_viewdef(
    'public.tv_admin_device_overview'::regclass,
    true
  ) as tv_admin_device_overview_definition;
