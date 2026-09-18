-- MJHK TV Phase 3B.2E-E
-- 01_seed_e2e_revision.sql
-- IDENTITY HOTFIX v1
--
-- revision_number is GENERATED ALWAYS.
-- This script deliberately DOES NOT insert revision_number manually.
-- PostgreSQL allocates it and we capture it with:
--   RETURNING id, revision_number
--
-- Safety:
-- - exactly one MJHK TEMP SIMULATOR
-- - baseline desired == applied
-- - source snapshot must be representative typed schema
-- - new revision stays draft
-- - applied_revision_id is NEVER written
-- - only TEMP SIMULATOR desired_revision_id is changed

do $$
declare
  v_device public.tv_devices%rowtype;
  v_source public.tv_config_revisions%rowtype;
  v_new_revision_id uuid;
  v_new_revision_number public.tv_config_revisions.revision_number%type;
  v_snapshot jsonb;
  v_items jsonb;
  v_running jsonb;
begin
  if (
    select count(*)
    from public.tv_devices
    where name = 'MJHK TEMP SIMULATOR'
  ) <> 1 then
    raise exception
      'phase3b2e_e_precondition_failed: expected exactly one MJHK TEMP SIMULATOR';
  end if;

  select *
  into strict v_device
  from public.tv_devices
  where name = 'MJHK TEMP SIMULATOR'
  for update;

  if v_device.enabled is not true then
    raise exception
      'phase3b2e_e_precondition_failed: simulator is disabled';
  end if;

  if v_device.desired_revision_id is null
     or v_device.applied_revision_id is null then
    raise exception
      'phase3b2e_e_precondition_failed: desired/applied revision must both exist';
  end if;

  if v_device.desired_revision_id <> v_device.applied_revision_id then
    raise exception
      'phase3b2e_e_precondition_failed: baseline desired/applied must already match';
  end if;

  select *
  into strict v_source
  from public.tv_config_revisions
  where id = v_device.desired_revision_id;

  if jsonb_typeof(v_source.snapshot) <> 'object' then
    raise exception
      'phase3b2e_e_precondition_failed: source snapshot must be an object';
  end if;

  if jsonb_typeof(v_source.snapshot -> 'playlist_items') <> 'array'
     or jsonb_typeof(v_source.snapshot -> 'running_text') <> 'array' then
    raise exception
      'phase3b2e_e_precondition_failed: representative arrays missing';
  end if;

  if (
    v_source.change_summary ->> 'test_harness'
  ) = 'phase3b2e_e_final_e2e' then
    raise exception
      'phase3b2e_e_already_seeded: current desired revision is already the E2E test revision';
  end if;

  -- First create the draft revision.
  -- revision_number is GENERATED ALWAYS, so the database owns numbering.
  insert into public.tv_config_revisions (
    status,
    snapshot,
    change_summary
  )
  values (
    'draft',
    v_source.snapshot,
    jsonb_build_object(
      'test_harness', 'phase3b2e_e_final_e2e',
      'seeded_at', clock_timestamp(),
      'previous_desired_revision_id', v_device.desired_revision_id,
      'previous_applied_revision_id', v_device.applied_revision_id,
      'source_revision_number', v_source.revision_number,
      'purpose', 'final automatic revision sync and ACK acceptance test'
    )
  )
  returning id, revision_number
  into v_new_revision_id, v_new_revision_number;

  -- Now that PostgreSQL has assigned the actual revision number,
  -- build the visible representative test content with that exact number.
  v_snapshot := v_source.snapshot;

  v_snapshot := jsonb_set(
    v_snapshot,
    '{message}',
    to_jsonb('Phase 3B.2E-E final automatic revision sync test'::text),
    true
  );

  v_snapshot := jsonb_set(
    v_snapshot,
    '{generated_at}',
    to_jsonb(clock_timestamp()::text),
    true
  );

  select coalesce(
    jsonb_agg(
      case
        when item ->> 'id' = 'demo-text-01' then
          jsonb_set(
            jsonb_set(
              item,
              '{payload,heading}',
              to_jsonb(
                ('E2E Revision ' || v_new_revision_number || ' Active')::text
              ),
              true
            ),
            '{payload,body}',
            to_jsonb(
              'Automatic Gateway → Candidate → Apply → LKG → ACK test.'::text
            ),
            true
          )
        else item
      end
      order by ord
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(v_snapshot -> 'playlist_items')
       with ordinality as t(item, ord);

  v_snapshot := jsonb_set(
    v_snapshot,
    '{playlist_items}',
    v_items,
    true
  );

  select coalesce(
    jsonb_agg(
      case
        when item ->> 'id' = 'demo-running-01' then
          jsonb_set(
            item,
            '{text}',
            to_jsonb(
              ('E2E sync revision ' || v_new_revision_number || ' applied automatically')::text
            ),
            true
          )
        else item
      end
      order by ord
    ),
    '[]'::jsonb
  )
  into v_running
  from jsonb_array_elements(v_snapshot -> 'running_text')
       with ordinality as t(item, ord);

  v_snapshot := jsonb_set(
    v_snapshot,
    '{running_text}',
    v_running,
    true
  );

  -- Update only the revision row we just created.
  update public.tv_config_revisions
  set
    snapshot = v_snapshot,
    change_summary = jsonb_build_object(
      'test_harness', 'phase3b2e_e_final_e2e',
      'seeded_at', clock_timestamp(),
      'previous_desired_revision_id', v_device.desired_revision_id,
      'previous_applied_revision_id', v_device.applied_revision_id,
      'source_revision_number', v_source.revision_number,
      'assigned_revision_number', v_new_revision_number,
      'purpose', 'final automatic revision sync and ACK acceptance test'
    )
  where id = v_new_revision_id;

  -- Point ONLY the simulator's desired revision to the new draft.
  -- applied_revision_id remains untouched and must be updated only via ACK.
  update public.tv_devices
  set
    desired_revision_id = v_new_revision_id,
    updated_at = clock_timestamp()
  where id = v_device.id;

  raise notice
    'Phase 3B.2E-E seeded. PostgreSQL assigned revision_number=%, revision_id=%',
    v_new_revision_number,
    v_new_revision_id;
end
$$;

-- Post-seed acceptance snapshot.
select
  d.id as device_id,
  d.name,
  d.device_code,
  d.desired_revision_id,
  d.applied_revision_id,
  (d.desired_revision_id = d.applied_revision_id) as already_applied,
  r.revision_number as desired_revision_number,
  r.status,
  r.change_summary,
  r.snapshot ->> 'message' as snapshot_message,
  (
    select item -> 'payload' ->> 'heading'
    from jsonb_array_elements(r.snapshot -> 'playlist_items') item
    where item ->> 'id' = 'demo-text-01'
    limit 1
  ) as e2e_heading,
  (
    select item ->> 'text'
    from jsonb_array_elements(r.snapshot -> 'running_text') item
    where item ->> 'id' = 'demo-running-01'
    limit 1
  ) as e2e_running_text
from public.tv_devices d
join public.tv_config_revisions r
  on r.id = d.desired_revision_id
where d.name = 'MJHK TEMP SIMULATOR';
