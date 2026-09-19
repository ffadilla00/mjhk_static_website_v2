-- MJHK TV Phase 3C-C
-- 01_verify_command_lease.sql
-- READ ONLY.
--
-- Run after one browser hard-refresh and one successful GET
-- /v1/device/commands?limit=5.

select
  c.id,
  c.command_type,
  c.status,
  c.delivery_attempts,
  c.created_at,
  c.delivered_at,
  c.lease_expires_at,
  c.expires_at,
  c.completed_at,
  c.error_message
from public.tv_device_commands c
join public.tv_devices d
  on d.id = c.device_id
where d.name = 'MJHK TEMP SIMULATOR'
order by c.created_at desc
limit 20;
