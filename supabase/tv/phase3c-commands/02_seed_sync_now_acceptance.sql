-- MJHK TV Phase 3C-D
-- 02_seed_sync_now_acceptance.sql
--
-- Creates one fresh sync_now command for TEMP SIMULATOR.

insert into public.tv_device_commands (
  device_id,
  command_type,
  payload,
  status,
  expires_at
)
select
  id,
  'sync_now',
  jsonb_build_object(
    'source',
    'phase3c_d_sync_now_acceptance'
  ),
  'pending',
  now() + interval '30 minutes'
from public.tv_devices
where name = 'MJHK TEMP SIMULATOR'
returning
  id,
  command_type,
  status,
  delivery_attempts,
  created_at,
  expires_at;
