-- MJHK TV Phase 4A
-- 01_cms_data_shape_audit.sql
-- READ ONLY.
--
-- Purpose:
-- Show representative JSON/data shapes that CMS must edit safely.

-- Representative TV content rows.
select *
from public.tv_content
order by created_at desc
limit 10;

-- Representative revisions.
select *
from public.tv_config_revisions
order by created_at desc
limit 5;

-- Current simulator device.
select *
from public.tv_devices
where name = 'MJHK TEMP SIMULATOR'
limit 1;

-- Recent commands to understand admin command lifecycle.
select *
from public.tv_device_commands
order by created_at desc
limit 20;
