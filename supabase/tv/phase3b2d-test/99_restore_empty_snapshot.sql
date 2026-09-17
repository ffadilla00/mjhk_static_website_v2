-- MJHK TV Phase 3B.2D-A.1
-- OPTIONAL cleanup for the temp simulator revision only.
-- Restores the test revision to an empty playlist/running-text snapshot.
-- Do NOT run until Phase 3B.2D schema work is finished.

begin;

do $$
declare
  v_revision_id uuid;
  v_status text;
begin
  select d.desired_revision_id
    into v_revision_id
  from public.tv_devices d
  where d.name = 'MJHK TEMP SIMULATOR';

  if v_revision_id is null then
    raise exception 'Temp simulator or desired revision not found';
  end if;

  select r.status
    into v_status
  from public.tv_config_revisions r
  where r.id = v_revision_id;

  if v_status <> 'draft' then
    raise exception
      'Refusing cleanup of non-draft revision %. status=%',
      v_revision_id,
      v_status;
  end if;

  update public.tv_config_revisions r
  set
    snapshot = jsonb_build_object(
      'schema_version', 1,
      'generated_at', now(),
      'test_mode', true,
      'message', 'Phase 3B temp simulator',
      'playlist_items', '[]'::jsonb,
      'running_text', '[]'::jsonb
    ),
    change_summary =
      (coalesce(r.change_summary, '{}'::jsonb) - 'seeded_at')
      || jsonb_build_object(
        'test_harness', 'phase2c_temp_simulator'
      )
  where r.id = v_revision_id;
end
$$;

commit;

select
  jsonb_array_length(r.snapshot->'playlist_items') as playlist_items_count,
  jsonb_array_length(r.snapshot->'running_text') as running_text_count,
  r.change_summary->>'test_harness' as test_harness
from public.tv_devices d
join public.tv_config_revisions r
  on r.id = d.desired_revision_id
where d.name = 'MJHK TEMP SIMULATOR';
