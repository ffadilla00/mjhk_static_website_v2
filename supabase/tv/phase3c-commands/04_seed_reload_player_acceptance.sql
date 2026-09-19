-- MJHK TV Phase 3C-D
-- 04_seed_reload_player_acceptance.sql
--
-- Creates one fresh reload_player command for TEMP SIMULATOR.

insert into public.tv_device_commands (
  device_id,
  command_type,
  payload,
  status,
  expires_at
)
select
  id,
  'reload_player',
  jsonb_build_object(
    'source',
    'phase3c_d_reload_player_acceptance'
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
