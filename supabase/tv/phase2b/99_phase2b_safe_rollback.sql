-- =============================================================================
-- MJHK TV — Phase 2B SAFE ROLLBACK
--
-- Rolls back Phase 2B only, preserving Phase 2A.
-- Aborts after real device pairing/media operation has begun.
-- =============================================================================

begin;

do $$
declare
  v_count bigint;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='tv_devices'
      and column_name='paired_at'
  ) then
    execute 'select count(*) from public.tv_devices where paired_at is not null'
    into v_count;

    if v_count > 0 then
      raise exception
        'ROLLBACK ABORTED: % paired device(s) detected.',
        v_count;
    end if;
  end if;

  if to_regclass('public.tv_device_pairing_sessions') is not null then
    execute 'select count(*) from public.tv_device_pairing_sessions where claimed_at is not null'
    into v_count;

    if v_count > 0 then
      raise exception
        'ROLLBACK ABORTED: % claimed pairing session(s) detected.',
        v_count;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='tv_content'
      and column_name='storage_path'
  ) then
    execute 'select count(*) from public.tv_content where storage_path is not null'
    into v_count;

    if v_count > 0 then
      raise exception
        'ROLLBACK ABORTED: % content row(s) already use Phase 2B storage_path.',
        v_count;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='tv_device_commands'
      and column_name='delivery_attempts'
  ) then
    execute 'select count(*) from public.tv_device_commands where delivery_attempts > 0'
    into v_count;

    if v_count > 0 then
      raise exception
        'ROLLBACK ABORTED: % command(s) have already been delivered.',
        v_count;
    end if;
  end if;
end $$;

-- Device RPCs
drop function if exists public.tv_device_report_screenshot(text,text,text);
drop function if exists public.tv_device_ack_command(text,text,uuid,text,text);
drop function if exists public.tv_device_pull_commands(text,text,integer);
drop function if exists public.tv_device_ack_revision(text,text,uuid,boolean,text);
drop function if exists public.tv_device_get_revision(text,text,uuid);
drop function if exists public.tv_device_heartbeat(text,text,jsonb);
drop function if exists public.tv_device_bootstrap(text,text);
drop function if exists public.tv_device_claim_pairing(text,jsonb);

-- Admin RPCs
drop function if exists public.tv_admin_revoke_device(uuid,text);
drop function if exists public.tv_admin_publish_config(jsonb);
drop function if exists public.tv_admin_create_pairing_code(uuid,integer,boolean);
drop function if exists public.tv_admin_register_device(text,uuid,integer);

-- Internal helpers
drop function if exists public.tv_require_device(text,text);
drop function if exists public.tv_make_pairing_code();
drop function if exists public.tv_hash_secret(text);

drop index if exists public.ux_tv_one_published_revision;
drop index if exists public.idx_tv_content_storage_path;

drop table if exists public.tv_device_security_events cascade;
drop table if exists public.tv_device_pairing_sessions cascade;

drop trigger if exists trg_tv_device_commands_updated_at
on public.tv_device_commands;

alter table public.tv_device_commands
  drop column if exists updated_at,
  drop column if exists lease_expires_at,
  drop column if exists delivery_attempts,
  drop column if exists expires_at;

alter table public.tv_devices
  drop column if exists last_screenshot_path,
  drop column if exists last_token_rotation_at,
  drop column if exists credential_version,
  drop column if exists paired_at;

alter table public.tv_content
  drop column if exists storage_path,
  drop column if exists storage_bucket;

alter table public.tv_system_settings
  drop column if exists device_offline_after_seconds,
  drop column if exists device_command_poll_seconds,
  drop column if exists device_screenshot_interval_seconds,
  drop column if exists device_heartbeat_interval_seconds;

-- Restore Phase 2A monitoring view.
create or replace view public.tv_admin_device_overview
with (security_invoker = true)
as
select
  d.id,
  d.name,
  d.device_code,
  d.enabled,
  d.network_status,
  d.last_seen_at,
  d.last_sync_at,
  d.last_screenshot_at,
  d.last_screenshot_url,
  d.app_version,
  d.device_model,
  d.screen_width,
  d.screen_height,
  d.is_muted,
  d.current_state,
  d.current_content_id,
  c.title as current_content_title,
  d.current_slide_index,
  d.total_slides,
  d.remaining_seconds,
  d.desired_revision_id,
  desired.revision_number as desired_revision_number,
  d.applied_revision_id,
  applied.revision_number as applied_revision_number,
  d.last_error,
  d.last_error_at
from public.tv_devices d
left join public.tv_content c
  on c.id = d.current_content_id
left join public.tv_config_revisions desired
  on desired.id = d.desired_revision_id
left join public.tv_config_revisions applied
  on applied.id = d.applied_revision_id;

revoke all on public.tv_admin_device_overview from anon;
grant select on public.tv_admin_device_overview to authenticated;

update public.tv_schema_meta
set schema_version = '2A.1.0',
    applied_at = now(),
    notes = 'Rolled back Phase 2B; Phase 2A preserved'
where id = 1;

commit;
