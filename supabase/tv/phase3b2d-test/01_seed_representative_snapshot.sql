-- MJHK TV Phase 3B.2D-A.1
-- Representative schema seed for the EXISTING temp simulator desired revision.
-- Safe scope:
--   * only device named 'MJHK TEMP SIMULATOR'
--   * only its current desired_revision_id
--   * only if that revision status = 'draft'
-- This does NOT publish, ACK, or point any other device.

begin;

do $$
declare
  v_device_count integer;
  v_revision_id uuid;
  v_status text;
begin
  select count(*)
    into v_device_count
  from public.tv_devices
  where name = 'MJHK TEMP SIMULATOR';

  if v_device_count <> 1 then
    raise exception
      'Expected exactly 1 MJHK TEMP SIMULATOR device, found %',
      v_device_count;
  end if;

  select d.desired_revision_id
    into v_revision_id
  from public.tv_devices d
  where d.name = 'MJHK TEMP SIMULATOR';

  if v_revision_id is null then
    raise exception 'Temp simulator has no desired_revision_id';
  end if;

  select r.status
    into v_status
  from public.tv_config_revisions r
  where r.id = v_revision_id;

  if v_status is null then
    raise exception 'Desired revision % not found', v_revision_id;
  end if;

  if v_status <> 'draft' then
    raise exception
      'Refusing to mutate non-draft test revision %. Current status=%',
      v_revision_id,
      v_status;
  end if;

  update public.tv_config_revisions r
  set
    snapshot = jsonb_build_object(
      'schema_version', 1,
      'generated_at', now(),
      'test_mode', true,
      'message', 'Phase 3B.2D-A.1 representative typed-schema seed',

      'playlist_items', jsonb_build_array(
        jsonb_build_object(
          'id', 'demo-image-01',
          'type', 'image',
          'title', 'Demo Image',
          'duration_seconds', 15,
          'fullscreen', false,
          'always_show', true,
          'starts_at', null,
          'ends_at', null,
          'payload', jsonb_build_object(
            'image_url', 'https://example.invalid/demo-image.jpg',
            'alt_text', 'Demo image'
          )
        ),

        jsonb_build_object(
          'id', 'demo-text-01',
          'type', 'text',
          'title', 'Demo Text',
          'duration_seconds', 12,
          'fullscreen', false,
          'always_show', true,
          'starts_at', null,
          'ends_at', null,
          'payload', jsonb_build_object(
            'heading', 'Demo heading',
            'body', 'Demo body'
          )
        ),

        jsonb_build_object(
          'id', 'demo-image-text-01',
          'type', 'image_text',
          'title', 'Demo Image + Text',
          'duration_seconds', 20,
          'fullscreen', true,
          'always_show', false,
          'starts_at', now(),
          'ends_at', now() + interval '7 days',
          'payload', jsonb_build_object(
            'image_url', 'https://example.invalid/demo-image-text.jpg',
            'heading', 'Demo heading',
            'body', 'Demo body'
          )
        )
      ),

      'running_text', jsonb_build_array(
        jsonb_build_object(
          'id', 'demo-running-01',
          'text', 'Demo running text',
          'enabled', true,
          'priority', 10,
          'starts_at', null,
          'ends_at', null,
          'state_scope', jsonb_build_array('NORMAL')
        ),
        jsonb_build_object(
          'id', 'demo-running-02',
          'text', 'Demo scheduled running text',
          'enabled', true,
          'priority', 20,
          'starts_at', now(),
          'ends_at', now() + interval '7 days',
          'state_scope', jsonb_build_array('NORMAL', 'PRE_ADHAN')
        )
      )
    ),
    change_summary =
      coalesce(r.change_summary, '{}'::jsonb)
      || jsonb_build_object(
        'test_harness', 'phase3b2d_a1_representative_schema',
        'seeded_at', now()
      )
  where r.id = v_revision_id;
end
$$;

commit;

-- Safe result: metadata/counts only, no payload values.
select
  d.device_code,
  r.id as revision_id,
  r.revision_number,
  r.status,
  jsonb_typeof(r.snapshot) as snapshot_type,
  jsonb_array_length(r.snapshot->'playlist_items') as playlist_items_count,
  jsonb_array_length(r.snapshot->'running_text') as running_text_count,
  r.change_summary->>'test_harness' as test_harness
from public.tv_devices d
join public.tv_config_revisions r
  on r.id = d.desired_revision_id
where d.name = 'MJHK TEMP SIMULATOR';
