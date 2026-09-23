-- MJHK TV Phase 4D-A1
-- AUDITED v3
-- Source alignment only.
-- Grounded in live schema audit.
--
-- Adds:
--   1) IMSAK state definition
--   2) IMSAK state asset source row
--   3) beep_imsak_count
--
-- Does NOT modify:
--   tv_admin_publish_config
--   desired_revision_id
--   applied_revision_id
--   player runtime
--   existing state codes

begin;

-- 1) Add IMSAK state definition using the real audited column shape.
insert into public.tv_state_definitions (
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
)
select
  'IMSAK',
  'Imsak',
  2,
  'P2',
  null,
  true,
  false,
  'resume_next',
  'Ramadan mode: effective Subuh time - imsak_offset_minutes.',
  'Effective Subuh time reached.',
  true
where not exists (
  select 1
  from public.tv_state_definitions
  where state_code = 'IMSAK'
);

-- 2) Add IMSAK source asset.
-- tv_state_assets.state_code is protected by FK to tv_state_definitions.
insert into public.tv_state_assets (
  state_code,
  content_id,
  enabled,
  notes
)
select
  'IMSAK',
  null,
  true,
  'Dedicated Imsak screen. Effective only when Ramadan mode is active.'
where not exists (
  select 1
  from public.tv_state_assets
  where state_code = 'IMSAK'
);

-- 3) Add IMSAK beep count following existing smallint beep convention.
alter table public.tv_system_settings
  add column if not exists beep_imsak_count smallint;

update public.tv_system_settings
set beep_imsak_count = 5
where beep_imsak_count is null;

alter table public.tv_system_settings
  alter column beep_imsak_count set default 5,
  alter column beep_imsak_count set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tv_system_settings'::regclass
      and conname = 'tv_system_settings_beep_imsak_count_check'
  ) then
    alter table public.tv_system_settings
      add constraint tv_system_settings_beep_imsak_count_check
      check (beep_imsak_count between 0 and 60);
  end if;
end $$;

commit;
