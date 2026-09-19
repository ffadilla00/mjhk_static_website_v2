-- MJHK TV Phase 3C-E
-- 01_final_runtime_acceptance.sql
-- READ ONLY.

-- Device runtime convergence.
select
  d.id,
  d.name,
  d.device_code,
  d.enabled,
  d.network_status,
  d.app_version,
  d.device_model,
  d.screen_width,
  d.screen_height,
  d.current_state,
  d.remaining_seconds,
  d.desired_revision_id,
  d.applied_revision_id,
  (d.desired_revision_id = d.applied_revision_id)
    as revision_in_sync,
  d.last_seen_at,
  d.last_sync_at,
  d.last_error,
  d.last_error_at
from public.tv_devices d
where d.name = 'MJHK TEMP SIMULATOR';

-- Command lifecycle summary.
select
  c.command_type,
  c.status,
  count(*) as command_count,
  max(c.completed_at) as latest_completed_at
from public.tv_device_commands c
join public.tv_devices d
  on d.id = c.device_id
where d.name = 'MJHK TEMP SIMULATOR'
group by c.command_type, c.status
order by c.command_type, c.status;

-- Latest sync_now acceptance.
select
  c.id,
  c.command_type,
  c.status,
  c.delivery_attempts,
  c.delivered_at,
  c.completed_at,
  c.error_message
from public.tv_device_commands c
join public.tv_devices d
  on d.id = c.device_id
where d.name = 'MJHK TEMP SIMULATOR'
  and c.command_type = 'sync_now'
order by c.created_at desc
limit 3;

-- Latest reload_player acceptance.
select
  c.id,
  c.command_type,
  c.status,
  c.delivery_attempts,
  c.delivered_at,
  c.completed_at,
  c.error_message
from public.tv_device_commands c
join public.tv_devices d
  on d.id = c.device_id
where d.name = 'MJHK TEMP SIMULATOR'
  and c.command_type = 'reload_player'
order by c.created_at desc
limit 3;

-- Commands that are still operationally active.
select
  c.id,
  c.command_type,
  c.status,
  c.delivery_attempts,
  c.created_at,
  c.delivered_at,
  c.lease_expires_at,
  c.expires_at
from public.tv_device_commands c
join public.tv_devices d
  on d.id = c.device_id
where d.name = 'MJHK TEMP SIMULATOR'
  and c.status in ('pending','delivered')
order by c.created_at;
