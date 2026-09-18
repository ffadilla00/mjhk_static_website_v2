-- MJHK TV Phase 3B.2E-E
-- 99_restore_previous_desired.sql
--
-- Safe rollback:
-- - only restores desired_revision_id for MJHK TEMP SIMULATOR
-- - DOES NOT manually rewrite applied_revision_id
-- - player should subsequently sync back to the previous desired revision
--   and ACK it normally.

do $$
declare
  v_device public.tv_devices%rowtype;
  v_current public.tv_config_revisions%rowtype;
  v_previous_desired uuid;
begin
  if (
    select count(*)
    from public.tv_devices
    where name = 'MJHK TEMP SIMULATOR'
  ) <> 1 then
    raise exception
      'phase3b2e_e_restore_failed: expected exactly one MJHK TEMP SIMULATOR';
  end if;

  select *
  into strict v_device
  from public.tv_devices
  where name = 'MJHK TEMP SIMULATOR'
  for update;

  select *
  into strict v_current
  from public.tv_config_revisions
  where id = v_device.desired_revision_id;

  if (
    v_current.change_summary ->> 'test_harness'
  ) <> 'phase3b2e_e_final_e2e' then
    raise exception
      'phase3b2e_e_restore_failed: current desired revision is not the E2E harness revision';
  end if;

  begin
    v_previous_desired :=
      (v_current.change_summary ->> 'previous_desired_revision_id')::uuid;
  exception when others then
    raise exception
      'phase3b2e_e_restore_failed: previous desired revision metadata invalid';
  end;

  if not exists (
    select 1
    from public.tv_config_revisions
    where id = v_previous_desired
  ) then
    raise exception
      'phase3b2e_e_restore_failed: previous desired revision no longer exists';
  end if;

  update public.tv_devices
  set
    desired_revision_id = v_previous_desired,
    updated_at = clock_timestamp()
  where id = v_device.id;

  raise notice
    'Phase 3B.2E-E desired revision restored to %',
    v_previous_desired;
end
$$;

select
  d.name,
  d.device_code,
  d.desired_revision_id,
  d.applied_revision_id,
  desired.revision_number as desired_revision_number,
  applied.revision_number as applied_revision_number,
  (d.desired_revision_id = d.applied_revision_id) as currently_in_sync
from public.tv_devices d
left join public.tv_config_revisions desired
  on desired.id = d.desired_revision_id
left join public.tv_config_revisions applied
  on applied.id = d.applied_revision_id
where d.name = 'MJHK TEMP SIMULATOR';
