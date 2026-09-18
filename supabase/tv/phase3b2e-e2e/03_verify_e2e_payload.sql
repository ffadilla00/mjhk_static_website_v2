-- MJHK TV Phase 3B.2E-E
-- 03_verify_e2e_payload.sql
-- Read-only inspection of the newly desired revision.

select
  r.id,
  r.revision_number,
  r.status,
  r.snapshot ->> 'message' as message,
  r.snapshot ->> 'generated_at' as generated_at,
  jsonb_array_length(
    coalesce(r.snapshot -> 'playlist_items', '[]'::jsonb)
  ) as playlist_items_count,
  jsonb_array_length(
    coalesce(r.snapshot -> 'running_text', '[]'::jsonb)
  ) as running_text_count,
  (
    select item -> 'payload' ->> 'heading'
    from jsonb_array_elements(r.snapshot -> 'playlist_items') item
    where item ->> 'id' = 'demo-text-01'
    limit 1
  ) as demo_text_heading,
  (
    select item ->> 'text'
    from jsonb_array_elements(r.snapshot -> 'running_text') item
    where item ->> 'id' = 'demo-running-01'
    limit 1
  ) as demo_running_text,
  r.change_summary
from public.tv_config_revisions r
join public.tv_devices d
  on d.desired_revision_id = r.id
where d.name = 'MJHK TEMP SIMULATOR';
