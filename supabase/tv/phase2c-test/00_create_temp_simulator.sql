-- =============================================================================
-- MJHK TV — Phase 2C TEMPORARY DEVICE INTEGRATION SETUP (HOTFIX v2)
--
-- Fix:
-- PostgreSQL data-modifying CTEs share one snapshot. A sibling UPDATE cannot
-- see a row inserted by another CTE in the same statement except through
-- RETURNING. Therefore desired_revision_id is now assigned directly during
-- the device INSERT instead of via a sibling UPDATE.
--
-- Run ONLY after 99_cleanup_temp_simulator.sql returns:
--   remaining_temp_devices   = 0
--   remaining_temp_revisions = 0
-- =============================================================================

do $$
begin
  if exists (
    select 1
    from public.tv_devices
    where name = 'MJHK TEMP SIMULATOR'
  ) then
    raise exception
      'TEMP SIMULATOR ALREADY EXISTS. Run 99_cleanup_temp_simulator.sql first.';
  end if;

  if exists (
    select 1
    from public.tv_config_revisions
    where change_summary->>'test_harness' = 'phase2c_temp_simulator'
  ) then
    raise exception
      'TEMP SIMULATOR REVISION ALREADY EXISTS. Run 99_cleanup_temp_simulator.sql first.';
  end if;
end $$;

with
pairing as (
  select upper(encode(gen_random_bytes(6), 'hex')) as pairing_code
),
revision_insert as (
  insert into public.tv_config_revisions (
    status,
    snapshot,
    change_summary,
    created_by
  )
  values (
    'draft',
    jsonb_build_object(
      'schema_version', '2B.1.0',
      'test_mode', true,
      'generated_at', now(),
      'message', 'MJHK Phase 2C temporary simulator revision',
      'playlist_items', '[]'::jsonb,
      'running_text', '[]'::jsonb
    ),
    jsonb_build_object(
      'test_harness', 'phase2c_temp_simulator'
    ),
    null
  )
  returning id, revision_number
),
device_insert as (
  insert into public.tv_devices (
    name,
    device_code,
    display_profile_id,
    enabled,
    network_status,
    desired_revision_id
  )
  select
    'MJHK TEMP SIMULATOR',
    'MJHK-SIM-' || upper(encode(gen_random_bytes(6), 'hex')),
    (
      select id
      from public.tv_display_profiles
      where is_default = true
      order by created_at
      limit 1
    ),
    true,
    'unknown',
    r.id
  from revision_insert r
  returning id, device_code, desired_revision_id
),
pairing_insert as (
  insert into public.tv_device_pairing_sessions (
    device_id,
    pairing_code_hash,
    expires_at,
    created_by
  )
  select
    d.id,
    encode(extensions.digest(p.pairing_code, 'sha256'), 'hex'),
    now() + interval '30 minutes',
    null
  from device_insert d
  cross join pairing p
  returning device_id
),
command_insert as (
  insert into public.tv_device_commands (
    device_id,
    command_type,
    payload,
    status,
    expires_at,
    created_by
  )
  select
    d.id,
    'sync_now',
    jsonb_build_object(
      'reason', 'Phase 2C temporary simulator integration test'
    ),
    'pending',
    now() + interval '30 minutes',
    null
  from device_insert d
  returning id
)
select
  d.id as device_id,
  d.device_code,
  p.pairing_code,
  now() + interval '30 minutes' as pairing_expires_at,
  r.id as test_revision_id,
  r.revision_number as test_revision_number,
  c.id as test_command_id
from device_insert d
cross join pairing p
cross join pairing_insert pi
cross join revision_insert r
cross join command_insert c;
