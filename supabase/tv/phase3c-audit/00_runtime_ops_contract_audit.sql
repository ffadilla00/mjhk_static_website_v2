-- MJHK TV Phase 3C-A
-- Runtime Operations DB Contract Audit
-- READ ONLY. No mutation.

select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  is_identity,
  identity_generation
from information_schema.columns
where table_schema = 'public'
  and table_name in ('tv_devices','tv_device_commands')
order by table_name, ordinal_position;

select
  c.conrelid::regclass::text as table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c
where c.conrelid in (
  'public.tv_devices'::regclass,
  'public.tv_device_commands'::regclass
)
order by c.conrelid::regclass::text, c.conname;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tv_device_heartbeat',
    'tv_device_pull_commands',
    'tv_device_ack_command'
  )
order by p.proname;

select
  id,
  name,
  device_code,
  enabled,
  network_status,
  app_version,
  device_model,
  android_version,
  screen_width,
  screen_height,
  is_muted,
  current_state,
  current_content_id,
  current_slide_index,
  total_slides,
  remaining_seconds,
  desired_revision_id,
  applied_revision_id,
  last_seen_at,
  last_sync_at,
  last_error,
  last_error_at
from public.tv_devices
where name = 'MJHK TEMP SIMULATOR';

select
  c.id,
  c.command_type,
  c.payload,
  c.status,
  c.created_at,
  c.delivered_at,
  c.completed_at,
  c.error_message
from public.tv_device_commands c
join public.tv_devices d on d.id = c.device_id
where d.name = 'MJHK TEMP SIMULATOR'
order by c.created_at desc
limit 20;
