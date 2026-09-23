-- MJHK TV Phase 4D-A1
-- AUDITED v3 VERIFY
-- READ ONLY.

select
  state_code,
  display_name,
  priority_rank,
  priority_class,
  default_duration_seconds,
  interrupts_normal_content,
  hide_running_text,
  resume_policy,
  trigger_start_notes,
  trigger_end_notes,
  enabled
from public.tv_state_definitions
where state_code = 'IMSAK';

select
  state_code,
  content_id,
  enabled,
  notes,
  updated_at
from public.tv_state_assets
where state_code = 'IMSAK';

select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tv_system_settings'
  and column_name in (
    'beep_adhan_count',
    'beep_iqamah_count',
    'beep_forbidden_count',
    'beep_isyraq_count',
    'beep_imsak_count'
  )
order by ordinal_position;

select
  beep_adhan_count,
  beep_iqamah_count,
  beep_forbidden_count,
  beep_isyraq_count,
  beep_imsak_count,
  ramadan_mode,
  imsak_offset_minutes,
  syuruq_wait_minutes,
  isyraq_duration_minutes
from public.tv_system_settings;

select
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.tv_system_settings'::regclass
  and conname = 'tv_system_settings_beep_imsak_count_check';

-- Confirm publish function already serializes all three source groups.
select
  p.proname as function_name,
  (
    pg_get_functiondef(p.oid) ilike '%''system_settings''%'
    and pg_get_functiondef(p.oid) ilike '%tv_system_settings%'
  ) as includes_system_settings,
  (
    pg_get_functiondef(p.oid) ilike '%''state_definitions''%'
    and pg_get_functiondef(p.oid) ilike '%tv_state_definitions%'
  ) as includes_state_definitions,
  (
    pg_get_functiondef(p.oid) ilike '%''state_assets''%'
    and pg_get_functiondef(p.oid) ilike '%tv_state_assets%'
  ) as includes_state_assets
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tv_admin_publish_config'
  and p.prokind = 'f';
