-- MJHK TV Phase 3C-D
-- 03_verify_sync_now_ack.sql
-- READ ONLY.

select
  c.id,
  c.command_type,
  c.payload,
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
  and c.command_type = 'sync_now'
  and c.payload ->> 'source' =
    'phase3c_d_sync_now_acceptance'
order by c.created_at desc
limit 5;
