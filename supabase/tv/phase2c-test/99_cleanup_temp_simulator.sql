-- =============================================================================
-- MJHK TV — Phase 2C TEMP SIMULATOR CLEANUP
--
-- Safe cleanup for artifacts created by 00_create_temp_simulator.sql.
-- Does not touch active published revisions or real devices.
-- =============================================================================

begin;

-- Never delete a revision if it somehow became active.
do $$
begin
  if exists (
    select 1
    from public.tv_config_revisions r
    join public.tv_publication_state ps
      on ps.active_revision_id = r.id
    where r.change_summary->>'test_harness' = 'phase2c_temp_simulator'
  ) then
    raise exception
      'CLEANUP ABORTED: a simulator revision is active. Inspect publication state first.';
  end if;
end $$;

delete from public.tv_device_security_events
where device_id in (
  select id
  from public.tv_devices
  where name = 'MJHK TEMP SIMULATOR'
);

-- Cascades remove pairing sessions, commands and assignment rows.
delete from public.tv_devices
where name = 'MJHK TEMP SIMULATOR';

delete from public.tv_config_revisions
where change_summary->>'test_harness' = 'phase2c_temp_simulator'
  and status <> 'published';

-- Screenshot objects are intentionally NOT deleted automatically here.
-- If a simulator screenshot exists, remove the object under tv-monitor
-- after confirming it is from the temporary simulator.

commit;

select
  count(*) as remaining_temp_devices
from public.tv_devices
where name = 'MJHK TEMP SIMULATOR';

select
  count(*) as remaining_temp_revisions
from public.tv_config_revisions
where change_summary->>'test_harness' = 'phase2c_temp_simulator';
