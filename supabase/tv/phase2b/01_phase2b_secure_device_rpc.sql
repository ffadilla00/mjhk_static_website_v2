-- =============================================================================
-- MJHK TV — Phase 2B SECURE DEVICE API / RPC
-- Schema version: 2B.1.0
--
-- Architecture:
--   Android TV -> Cloudflare Worker TV API -> Supabase RPC
--
-- Security decisions:
--   * Android TV never receives Supabase service-role credentials.
--   * Device-facing RPCs are NOT executable by anon/authenticated users.
--   * Device-facing RPCs are executable only by service_role (API gateway).
--   * Each TV receives a random 256-bit token exactly once at pairing.
--   * Database stores SHA-256 token hash only.
--   * Pairing codes are random, short-lived, one-time, and stored hashed.
--   * Existing Phase 2A RLS remains enabled.
-- =============================================================================

begin;

do $$
declare
  v_version text;
begin
  if to_regprocedure('public.is_mjhk_admin()') is null then
    raise exception 'Phase 2B aborted: public.is_mjhk_admin() is required.';
  end if;

  select schema_version into v_version
  from public.tv_schema_meta
  where id = 1;

  if v_version is distinct from '2A.1.0' then
    raise exception 'Phase 2B aborted: expected schema 2A.1.0, got %.', coalesce(v_version,'NULL');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Global device runtime intervals
-- ---------------------------------------------------------------------------

alter table public.tv_system_settings
  add column if not exists device_heartbeat_interval_seconds smallint
    not null default 30;

alter table public.tv_system_settings
  add column if not exists device_screenshot_interval_seconds smallint
    not null default 60;

alter table public.tv_system_settings
  add column if not exists device_command_poll_seconds smallint
    not null default 15;

alter table public.tv_system_settings
  add column if not exists device_offline_after_seconds smallint
    not null default 90;

-- ---------------------------------------------------------------------------
-- 2. Private media addressing
-- ---------------------------------------------------------------------------

alter table public.tv_content
  add column if not exists storage_bucket text;

alter table public.tv_content
  add column if not exists storage_path text;

create index if not exists idx_tv_content_storage_path
  on public.tv_content(storage_bucket, storage_path);

-- ---------------------------------------------------------------------------
-- 3. Device credential / pairing metadata
-- ---------------------------------------------------------------------------

alter table public.tv_devices
  add column if not exists paired_at timestamptz;

alter table public.tv_devices
  add column if not exists credential_version integer
    not null default 0;

alter table public.tv_devices
  add column if not exists last_token_rotation_at timestamptz;

alter table public.tv_devices
  add column if not exists last_screenshot_path text;

create table if not exists public.tv_device_pairing_sessions (
  id uuid primary key default gen_random_uuid(),

  device_id uuid not null
    references public.tv_devices(id)
    on delete cascade,

  pairing_code_hash text not null
    check (pairing_code_hash ~ '^[a-f0-9]{64}$'),

  expires_at timestamptz not null,
  claimed_at timestamptz,

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_tv_pairing_lookup
  on public.tv_device_pairing_sessions(pairing_code_hash, expires_at);

create index if not exists idx_tv_pairing_device
  on public.tv_device_pairing_sessions(device_id, created_at desc);

create table if not exists public.tv_device_security_events (
  id bigint generated always as identity primary key,

  device_id uuid
    references public.tv_devices(id)
    on delete set null,

  event_type text not null,

  detail jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_tv_device_security_events_device
  on public.tv_device_security_events(device_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Reliable command delivery
-- ---------------------------------------------------------------------------

alter table public.tv_device_commands
  add column if not exists expires_at timestamptz
    not null default (now() + interval '15 minutes');

alter table public.tv_device_commands
  add column if not exists delivery_attempts smallint
    not null default 0;

alter table public.tv_device_commands
  add column if not exists lease_expires_at timestamptz;

alter table public.tv_device_commands
  add column if not exists updated_at timestamptz
    not null default now();

drop trigger if exists trg_tv_device_commands_updated_at
on public.tv_device_commands;

create trigger trg_tv_device_commands_updated_at
before update on public.tv_device_commands
for each row execute function public.tv_touch_updated_at();

-- One published configuration revision at a time.
create unique index if not exists ux_tv_one_published_revision
on public.tv_config_revisions ((1))
where status = 'published';

-- ---------------------------------------------------------------------------
-- 5. Internal secret helpers
-- ---------------------------------------------------------------------------

create or replace function public.tv_hash_secret(p_value text)
returns text
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select encode(digest(coalesce(p_value,''), 'sha256'), 'hex')
$$;

create or replace function public.tv_make_pairing_code()
returns text
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select upper(encode(gen_random_bytes(6), 'hex'))
$$;

create or replace function public.tv_require_device(
  p_device_code text,
  p_device_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
begin
  if p_device_code is null
     or btrim(p_device_code) = ''
     or p_device_token is null
     or length(p_device_token) < 40 then
    raise exception 'DEVICE_AUTH_FAILED';
  end if;

  select d.id
  into v_device_id
  from public.tv_devices d
  where d.device_code = p_device_code
    and d.enabled = true
    and d.device_token_hash is not null
    and d.device_token_hash = public.tv_hash_secret(p_device_token)
  limit 1;

  if v_device_id is null then
    raise exception 'DEVICE_AUTH_FAILED';
  end if;

  return v_device_id;
end;
$$;

-- Internal helpers are never API entry points.
revoke all on function public.tv_hash_secret(text)
  from public, anon, authenticated, service_role;

revoke all on function public.tv_make_pairing_code()
  from public, anon, authenticated, service_role;

revoke all on function public.tv_require_device(text,text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Admin RPC: register a new TV + one-time pairing code
-- ---------------------------------------------------------------------------

create or replace function public.tv_admin_register_device(
  p_name text,
  p_display_profile_id uuid default null,
  p_pairing_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_device_code text;
  v_profile_id uuid;
  v_pairing_code text;
  v_expires_at timestamptz;
begin
  if not public.is_mjhk_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'DEVICE_NAME_REQUIRED';
  end if;

  if p_pairing_ttl_minutes < 1 or p_pairing_ttl_minutes > 60 then
    raise exception 'PAIRING_TTL_OUT_OF_RANGE';
  end if;

  v_profile_id := p_display_profile_id;

  if v_profile_id is null then
    select id into v_profile_id
    from public.tv_display_profiles
    where is_default = true
    order by created_at
    limit 1;
  end if;

  v_device_code := 'MJHK-' || upper(encode(gen_random_bytes(8), 'hex'));

  insert into public.tv_devices(
    name,
    device_code,
    display_profile_id,
    enabled,
    network_status
  )
  values(
    btrim(p_name),
    v_device_code,
    v_profile_id,
    true,
    'unknown'
  )
  returning id into v_device_id;

  v_pairing_code := public.tv_make_pairing_code();
  v_expires_at := now() + make_interval(mins => p_pairing_ttl_minutes);

  insert into public.tv_device_pairing_sessions(
    device_id,
    pairing_code_hash,
    expires_at,
    created_by
  )
  values(
    v_device_id,
    public.tv_hash_secret(v_pairing_code),
    v_expires_at,
    auth.uid()
  );

  insert into public.tv_device_security_events(device_id,event_type,detail)
  values(
    v_device_id,
    'device_registered',
    jsonb_build_object(
      'display_profile_id', v_profile_id,
      'pairing_expires_at', v_expires_at
    )
  );

  return jsonb_build_object(
    'device_id', v_device_id,
    'device_code', v_device_code,
    'pairing_code', v_pairing_code,
    'pairing_expires_at', v_expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Admin RPC: generate a fresh pairing code for an existing TV
-- ---------------------------------------------------------------------------

create or replace function public.tv_admin_create_pairing_code(
  p_device_id uuid,
  p_pairing_ttl_minutes integer default 15,
  p_invalidate_existing_token boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pairing_code text;
  v_expires_at timestamptz;
  v_device_code text;
begin
  if not public.is_mjhk_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_pairing_ttl_minutes < 1 or p_pairing_ttl_minutes > 60 then
    raise exception 'PAIRING_TTL_OUT_OF_RANGE';
  end if;

  select device_code into v_device_code
  from public.tv_devices
  where id = p_device_id;

  if v_device_code is null then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  update public.tv_device_pairing_sessions
  set expires_at = now()
  where device_id = p_device_id
    and claimed_at is null
    and expires_at > now();

  if p_invalidate_existing_token then
    update public.tv_devices
    set device_token_hash = null,
        paired_at = null,
        network_status = 'unknown'
    where id = p_device_id;
  end if;

  v_pairing_code := public.tv_make_pairing_code();
  v_expires_at := now() + make_interval(mins => p_pairing_ttl_minutes);

  insert into public.tv_device_pairing_sessions(
    device_id,
    pairing_code_hash,
    expires_at,
    created_by
  )
  values(
    p_device_id,
    public.tv_hash_secret(v_pairing_code),
    v_expires_at,
    auth.uid()
  );

  insert into public.tv_device_security_events(device_id,event_type,detail)
  values(
    p_device_id,
    'pairing_code_created',
    jsonb_build_object(
      'pairing_expires_at', v_expires_at,
      'existing_token_invalidated', p_invalidate_existing_token
    )
  );

  return jsonb_build_object(
    'device_id', p_device_id,
    'device_code', v_device_code,
    'pairing_code', v_pairing_code,
    'pairing_expires_at', v_expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Admin RPC: atomically publish current editable TV config
-- ---------------------------------------------------------------------------

create or replace function public.tv_admin_publish_config(
  p_change_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_snapshot jsonb;
  v_revision_id uuid;
  v_revision_number bigint;
  v_devices_targeted integer;
begin
  if not public.is_mjhk_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if (select count(*) from public.tv_prayer_rules) <> 6 then
    raise exception 'CONFIG_INVALID_PRAYER_RULE_COUNT';
  end if;

  v_snapshot := jsonb_build_object(
    'schema_version',
      (select schema_version from public.tv_schema_meta where id = 1),

    'generated_at',
      now(),

    'system_settings',
      coalesce(
        (select to_jsonb(s) - 'created_at' - 'updated_at'
         from public.tv_system_settings s
         where s.id = 1),
        '{}'::jsonb
      ),

    'display_profiles',
      coalesce(
        (select jsonb_agg(to_jsonb(d) - 'created_at' - 'updated_at' order by d.name)
         from public.tv_display_profiles d),
        '[]'::jsonb
      ),

    'prayer_rules',
      coalesce(
        (select jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at'
                          order by case p.prayer_code
                            when 'subuh' then 1
                            when 'dzuhur' then 2
                            when 'ashar' then 3
                            when 'maghrib' then 4
                            when 'isya' then 5
                            when 'jumat' then 6
                            else 99 end)
         from public.tv_prayer_rules p
         where p.enabled = true),
        '[]'::jsonb
      ),

    'audio_rules',
      coalesce(
        (select jsonb_agg(to_jsonb(a) - 'updated_at' order by a.prayer_code)
         from public.tv_audio_rules a),
        '[]'::jsonb
      ),

    'state_definitions',
      coalesce(
        (select jsonb_agg(to_jsonb(st) - 'created_at' - 'updated_at'
                          order by st.priority_rank, st.state_code)
         from public.tv_state_definitions st
         where st.enabled = true),
        '[]'::jsonb
      ),

    'state_assets',
      coalesce(
        (select jsonb_agg(to_jsonb(sa) - 'updated_at' order by sa.state_code)
         from public.tv_state_assets sa
         where sa.enabled = true),
        '[]'::jsonb
      ),

    'content',
      coalesce(
        (select jsonb_agg(to_jsonb(c) - 'created_by' - 'created_at' - 'updated_at'
                          order by c.title)
         from public.tv_content c
         where c.status = 'published'),
        '[]'::jsonb
      ),

    'playlist_items',
      coalesce(
        (select jsonb_agg(to_jsonb(pi) - 'created_at' - 'updated_at'
                          order by pi.priority desc, pi.sort_order, pi.id)
         from public.tv_playlist_items pi
         where pi.active = true),
        '[]'::jsonb
      ),

    'playlist_item_devices',
      coalesce(
        (select jsonb_agg(to_jsonb(pid)
                          order by pid.playlist_item_id, pid.device_id)
         from public.tv_playlist_item_devices pid),
        '[]'::jsonb
      ),

    'running_text',
      coalesce(
        (select jsonb_agg(to_jsonb(rt) - 'created_at' - 'updated_at'
                          order by rt.priority desc, rt.sort_order, rt.id)
         from public.tv_running_text rt
         where rt.active = true),
        '[]'::jsonb
      ),

    'running_text_devices',
      coalesce(
        (select jsonb_agg(to_jsonb(rtd)
                          order by rtd.running_text_id, rtd.device_id)
         from public.tv_running_text_devices rtd),
        '[]'::jsonb
      )
  );

  update public.tv_config_revisions
  set status = 'superseded'
  where status = 'published';

  insert into public.tv_config_revisions(
    status,
    snapshot,
    change_summary,
    created_by,
    published_at
  )
  values(
    'published',
    v_snapshot,
    coalesce(p_change_summary,'{}'::jsonb),
    auth.uid(),
    now()
  )
  returning id, revision_number
  into v_revision_id, v_revision_number;

  update public.tv_publication_state
  set active_revision_id = v_revision_id
  where id = 1;

  update public.tv_devices
  set desired_revision_id = v_revision_id
  where enabled = true;

  get diagnostics v_devices_targeted = row_count;

  insert into public.tv_device_security_events(device_id,event_type,detail)
  values(
    null,
    'config_published',
    jsonb_build_object(
      'revision_id', v_revision_id,
      'revision_number', v_revision_number,
      'devices_targeted', v_devices_targeted
    )
  );

  return jsonb_build_object(
    'revision_id', v_revision_id,
    'revision_number', v_revision_number,
    'devices_targeted', v_devices_targeted
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Admin RPC: revoke a device
-- ---------------------------------------------------------------------------

create or replace function public.tv_admin_revoke_device(
  p_device_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_code text;
begin
  if not public.is_mjhk_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select device_code into v_device_code
  from public.tv_devices
  where id = p_device_id;

  if v_device_code is null then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  update public.tv_devices
  set enabled = false,
      device_token_hash = null,
      network_status = 'offline'
  where id = p_device_id;

  update public.tv_device_pairing_sessions
  set expires_at = now()
  where device_id = p_device_id
    and claimed_at is null
    and expires_at > now();

  update public.tv_device_commands
  set status = 'expired',
      completed_at = now()
  where device_id = p_device_id
    and status in ('pending','delivered');

  insert into public.tv_device_security_events(device_id,event_type,detail)
  values(
    p_device_id,
    'device_revoked',
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object(
    'device_id', p_device_id,
    'device_code', v_device_code,
    'revoked', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Device RPC: claim one-time pairing code
--     Called only by trusted TV API gateway using service_role.
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_claim_pairing(
  p_pairing_code text,
  p_device_info jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_normalized_code text;
  v_session_id uuid;
  v_device_id uuid;
  v_device_code text;
  v_device_token text;
begin
  v_normalized_code :=
    upper(regexp_replace(coalesce(p_pairing_code,''), '[^A-Fa-f0-9]', '', 'g'));

  if length(v_normalized_code) <> 12 then
    raise exception 'PAIRING_INVALID_OR_EXPIRED';
  end if;

  select ps.id, ps.device_id, d.device_code
  into v_session_id, v_device_id, v_device_code
  from public.tv_device_pairing_sessions ps
  join public.tv_devices d on d.id = ps.device_id
  where ps.pairing_code_hash = public.tv_hash_secret(v_normalized_code)
    and ps.claimed_at is null
    and ps.expires_at > now()
    and d.enabled = true
  order by ps.created_at desc
  limit 1
  for update of ps;

  if v_session_id is null then
    raise exception 'PAIRING_INVALID_OR_EXPIRED';
  end if;

  v_device_token := encode(gen_random_bytes(32), 'hex');

  update public.tv_devices
  set device_token_hash = public.tv_hash_secret(v_device_token),
      credential_version = credential_version + 1,
      paired_at = now(),
      last_token_rotation_at = now(),
      last_seen_at = now(),
      network_status = 'online',
      app_version = coalesce(p_device_info->>'app_version', app_version),
      device_model = coalesce(p_device_info->>'device_model', device_model),
      android_version = coalesce(p_device_info->>'android_version', android_version),
      screen_width = coalesce(nullif(p_device_info->>'screen_width','')::integer, screen_width),
      screen_height = coalesce(nullif(p_device_info->>'screen_height','')::integer, screen_height)
  where id = v_device_id;

  update public.tv_device_pairing_sessions
  set claimed_at = now()
  where id = v_session_id;

  -- Expire any other outstanding pairing sessions for the same device.
  update public.tv_device_pairing_sessions
  set expires_at = now()
  where device_id = v_device_id
    and id <> v_session_id
    and claimed_at is null
    and expires_at > now();

  insert into public.tv_device_security_events(device_id,event_type,detail)
  values(
    v_device_id,
    'pairing_claimed',
    coalesce(p_device_info,'{}'::jsonb)
  );

  return jsonb_build_object(
    'device_id', v_device_id,
    'device_code', v_device_code,
    'device_token', v_device_token,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Device RPC: bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_bootstrap(
  p_device_code text,
  p_device_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_result jsonb;
begin
  v_device_id := public.tv_require_device(p_device_code,p_device_token);

  update public.tv_devices
  set last_seen_at = now(),
      network_status = 'online'
  where id = v_device_id;

  select jsonb_build_object(
    'server_time', now(),
    'device_id', d.id,
    'device_code', d.device_code,
    'device_name', d.name,
    'display_profile_id', d.display_profile_id,
    'desired_revision_id', d.desired_revision_id,
    'desired_revision_number', desired.revision_number,
    'applied_revision_id', d.applied_revision_id,
    'applied_revision_number', applied.revision_number,
    'active_revision_id', ps.active_revision_id,
    'active_revision_number', active_rev.revision_number,
    'heartbeat_interval_seconds', s.device_heartbeat_interval_seconds,
    'screenshot_interval_seconds', s.device_screenshot_interval_seconds,
    'command_poll_seconds', s.device_command_poll_seconds,
    'offline_after_seconds', s.device_offline_after_seconds
  )
  into v_result
  from public.tv_devices d
  cross join public.tv_system_settings s
  left join public.tv_config_revisions desired on desired.id = d.desired_revision_id
  left join public.tv_config_revisions applied on applied.id = d.applied_revision_id
  left join public.tv_publication_state ps on ps.id = 1
  left join public.tv_config_revisions active_rev on active_rev.id = ps.active_revision_id
  where d.id = v_device_id
    and s.id = 1;

  return coalesce(v_result,'{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Device RPC: heartbeat / telemetry
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_heartbeat(
  p_device_code text,
  p_device_token text,
  p_telemetry jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_desired_revision_id uuid;
  v_desired_revision_number bigint;
  v_applied_revision_id uuid;
  v_applied_revision_number bigint;
  v_pending_commands integer;
begin
  v_device_id := public.tv_require_device(p_device_code,p_device_token);

  update public.tv_device_commands
  set status = 'expired',
      completed_at = coalesce(completed_at,now())
  where device_id = v_device_id
    and status in ('pending','delivered')
    and expires_at <= now();

  update public.tv_devices
  set last_seen_at = now(),
      network_status = 'online',

      app_version =
        case when p_telemetry ? 'app_version'
          then nullif(p_telemetry->>'app_version','')
          else app_version end,

      device_model =
        case when p_telemetry ? 'device_model'
          then nullif(p_telemetry->>'device_model','')
          else device_model end,

      android_version =
        case when p_telemetry ? 'android_version'
          then nullif(p_telemetry->>'android_version','')
          else android_version end,

      screen_width =
        case when p_telemetry ? 'screen_width'
          then nullif(p_telemetry->>'screen_width','')::integer
          else screen_width end,

      screen_height =
        case when p_telemetry ? 'screen_height'
          then nullif(p_telemetry->>'screen_height','')::integer
          else screen_height end,

      is_muted =
        case when p_telemetry ? 'is_muted'
          then (p_telemetry->>'is_muted')::boolean
          else is_muted end,

      current_state =
        case when p_telemetry ? 'current_state'
          then nullif(p_telemetry->>'current_state','')
          else current_state end,

      current_content_id =
        case when p_telemetry ? 'current_content_id'
          then nullif(p_telemetry->>'current_content_id','')::uuid
          else current_content_id end,

      current_slide_index =
        case when p_telemetry ? 'current_slide_index'
          then nullif(p_telemetry->>'current_slide_index','')::integer
          else current_slide_index end,

      total_slides =
        case when p_telemetry ? 'total_slides'
          then nullif(p_telemetry->>'total_slides','')::integer
          else total_slides end,

      remaining_seconds =
        case when p_telemetry ? 'remaining_seconds'
          then nullif(p_telemetry->>'remaining_seconds','')::integer
          else remaining_seconds end,

      last_error =
        case when p_telemetry ? 'last_error'
          then nullif(p_telemetry->>'last_error','')
          else last_error end,

      last_error_at =
        case
          when p_telemetry ? 'last_error'
               and nullif(p_telemetry->>'last_error','') is not null
            then now()
          when p_telemetry ? 'last_error'
            then null
          else last_error_at
        end
  where id = v_device_id;

  select
    d.desired_revision_id,
    desired.revision_number,
    d.applied_revision_id,
    applied.revision_number
  into
    v_desired_revision_id,
    v_desired_revision_number,
    v_applied_revision_id,
    v_applied_revision_number
  from public.tv_devices d
  left join public.tv_config_revisions desired on desired.id = d.desired_revision_id
  left join public.tv_config_revisions applied on applied.id = d.applied_revision_id
  where d.id = v_device_id;

  select count(*)
  into v_pending_commands
  from public.tv_device_commands c
  where c.device_id = v_device_id
    and c.expires_at > now()
    and (
      c.status = 'pending'
      or (
        c.status = 'delivered'
        and (c.lease_expires_at is null or c.lease_expires_at <= now())
        and c.delivery_attempts < 5
      )
    );

  return jsonb_build_object(
    'server_time', now(),
    'desired_revision_id', v_desired_revision_id,
    'desired_revision_number', v_desired_revision_number,
    'applied_revision_id', v_applied_revision_id,
    'applied_revision_number', v_applied_revision_number,
    'pending_commands', v_pending_commands
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Device RPC: get desired/applied/active revision
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_get_revision(
  p_device_code text,
  p_device_token text,
  p_revision_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_requested_revision_id uuid;
  v_allowed boolean;
  v_result jsonb;
begin
  v_device_id := public.tv_require_device(p_device_code,p_device_token);

  select coalesce(
    p_revision_id,
    d.desired_revision_id,
    ps.active_revision_id
  )
  into v_requested_revision_id
  from public.tv_devices d
  left join public.tv_publication_state ps on ps.id = 1
  where d.id = v_device_id;

  if v_requested_revision_id is null then
    return jsonb_build_object(
      'config_available', false,
      'server_time', now()
    );
  end if;

  select (
    v_requested_revision_id = d.desired_revision_id
    or v_requested_revision_id = d.applied_revision_id
    or v_requested_revision_id = ps.active_revision_id
  )
  into v_allowed
  from public.tv_devices d
  left join public.tv_publication_state ps on ps.id = 1
  where d.id = v_device_id;

  if not coalesce(v_allowed,false) then
    raise exception 'REVISION_NOT_ALLOWED';
  end if;

  select jsonb_build_object(
    'config_available', true,
    'revision_id', r.id,
    'revision_number', r.revision_number,
    'status', r.status,
    'published_at', r.published_at,
    'snapshot', r.snapshot
  )
  into v_result
  from public.tv_config_revisions r
  where r.id = v_requested_revision_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'config_available', false,
      'server_time', now()
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Device RPC: acknowledge config revision
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_ack_revision(
  p_device_code text,
  p_device_token text,
  p_revision_id uuid,
  p_success boolean,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_desired_revision_id uuid;
begin
  v_device_id := public.tv_require_device(p_device_code,p_device_token);

  select desired_revision_id
  into v_desired_revision_id
  from public.tv_devices
  where id = v_device_id;

  if p_success and p_revision_id is distinct from v_desired_revision_id then
    raise exception 'STALE_REVISION_ACK';
  end if;

  if p_success then
    update public.tv_devices
    set applied_revision_id = p_revision_id,
        last_sync_at = now(),
        last_error = null,
        last_error_at = null
    where id = v_device_id;
  else
    update public.tv_devices
    set last_error = coalesce(nullif(p_error_message,''),'REVISION_APPLY_FAILED'),
        last_error_at = now()
    where id = v_device_id;

    insert into public.tv_device_security_events(device_id,event_type,detail)
    values(
      v_device_id,
      'revision_apply_failed',
      jsonb_build_object(
        'revision_id', p_revision_id,
        'error', p_error_message
      )
    );
  end if;

  return jsonb_build_object(
    'acknowledged', true,
    'success', p_success,
    'revision_id', p_revision_id,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Device RPC: pull commands with 60-second lease
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_pull_commands(
  p_device_code text,
  p_device_token text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_limit integer;
  v_commands jsonb;
begin
  v_device_id := public.tv_require_device(p_device_code,p_device_token);
  v_limit := greatest(1,least(coalesce(p_limit,10),20));

  update public.tv_device_commands
  set status = 'expired',
      completed_at = coalesce(completed_at,now())
  where device_id = v_device_id
    and status in ('pending','delivered')
    and (
      expires_at <= now()
      or (
        status = 'delivered'
        and delivery_attempts >= 5
        and (lease_expires_at is null or lease_expires_at <= now())
      )
    );

  with picked as (
    select id
    from public.tv_device_commands
    where device_id = v_device_id
      and expires_at > now()
      and (
        status = 'pending'
        or (
          status = 'delivered'
          and (lease_expires_at is null or lease_expires_at <= now())
          and delivery_attempts < 5
        )
      )
    order by created_at
    limit v_limit
    for update skip locked
  ),
  leased as (
    update public.tv_device_commands c
    set status = 'delivered',
        delivered_at = coalesce(c.delivered_at,now()),
        lease_expires_at = now() + interval '60 seconds',
        delivery_attempts = c.delivery_attempts + 1
    from picked
    where c.id = picked.id
    returning
      c.id,
      c.command_type,
      c.payload,
      c.created_at,
      c.expires_at,
      c.delivery_attempts
  )
  select coalesce(
    jsonb_agg(to_jsonb(leased) order by leased.created_at),
    '[]'::jsonb
  )
  into v_commands
  from leased;

  update public.tv_devices
  set last_seen_at = now(),
      network_status = 'online'
  where id = v_device_id;

  return jsonb_build_object(
    'server_time', now(),
    'lease_seconds', 60,
    'commands', v_commands
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. Device RPC: acknowledge command
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_ack_command(
  p_device_code text,
  p_device_token text,
  p_command_id uuid,
  p_status text,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_updated integer;
begin
  v_device_id := public.tv_require_device(p_device_code,p_device_token);

  if p_status not in ('done','failed') then
    raise exception 'INVALID_COMMAND_ACK_STATUS';
  end if;

  update public.tv_device_commands
  set status = p_status,
      completed_at = now(),
      lease_expires_at = null,
      error_message =
        case when p_status = 'failed'
          then coalesce(nullif(p_error_message,''),'COMMAND_FAILED')
          else null end
  where id = p_command_id
    and device_id = v_device_id
    and status in ('pending','delivered');

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'COMMAND_NOT_FOUND_OR_ALREADY_FINAL';
  end if;

  return jsonb_build_object(
    'acknowledged', true,
    'command_id', p_command_id,
    'status', p_status,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. Device RPC: report screenshot metadata after Worker upload
-- ---------------------------------------------------------------------------

create or replace function public.tv_device_report_screenshot(
  p_device_code text,
  p_device_token text,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
begin
  v_device_id := public.tv_require_device(p_device_code,p_device_token);

  if p_storage_path is null
     or btrim(p_storage_path) = ''
     or position(v_device_id::text || '/' in p_storage_path) <> 1 then
    raise exception 'INVALID_SCREENSHOT_PATH';
  end if;

  update public.tv_devices
  set last_screenshot_path = p_storage_path,
      last_screenshot_at = now(),
      last_seen_at = now(),
      network_status = 'online'
  where id = v_device_id;

  return jsonb_build_object(
    'stored', true,
    'storage_path', p_storage_path,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 18. RLS for new Phase 2B tables
-- ---------------------------------------------------------------------------

alter table public.tv_device_pairing_sessions enable row level security;
alter table public.tv_device_security_events enable row level security;

drop policy if exists "MJHK TV admin full access"
on public.tv_device_pairing_sessions;

create policy "MJHK TV admin full access"
on public.tv_device_pairing_sessions
for all to authenticated
using (public.is_mjhk_admin())
with check (public.is_mjhk_admin());

drop policy if exists "MJHK TV admin full access"
on public.tv_device_security_events;

create policy "MJHK TV admin full access"
on public.tv_device_security_events
for all to authenticated
using (public.is_mjhk_admin())
with check (public.is_mjhk_admin());

revoke all on public.tv_device_pairing_sessions from anon;
revoke all on public.tv_device_security_events from anon;

grant select,insert,update,delete
on public.tv_device_pairing_sessions
to authenticated;

grant select,insert,update,delete
on public.tv_device_security_events
to authenticated;

-- ---------------------------------------------------------------------------
-- 19. RPC privilege model
-- ---------------------------------------------------------------------------

-- Admin RPCs: authenticated users may invoke, but every RPC checks is_mjhk_admin().
revoke all on function public.tv_admin_register_device(text,uuid,integer)
  from public, anon;
grant execute on function public.tv_admin_register_device(text,uuid,integer)
  to authenticated;

revoke all on function public.tv_admin_create_pairing_code(uuid,integer,boolean)
  from public, anon;
grant execute on function public.tv_admin_create_pairing_code(uuid,integer,boolean)
  to authenticated;

revoke all on function public.tv_admin_publish_config(jsonb)
  from public, anon;
grant execute on function public.tv_admin_publish_config(jsonb)
  to authenticated;

revoke all on function public.tv_admin_revoke_device(uuid,text)
  from public, anon;
grant execute on function public.tv_admin_revoke_device(uuid,text)
  to authenticated;

-- Device RPCs: ONLY the trusted API gateway's service_role may invoke them.
revoke all on function public.tv_device_claim_pairing(text,jsonb)
  from public, anon, authenticated;
grant execute on function public.tv_device_claim_pairing(text,jsonb)
  to service_role;

revoke all on function public.tv_device_bootstrap(text,text)
  from public, anon, authenticated;
grant execute on function public.tv_device_bootstrap(text,text)
  to service_role;

revoke all on function public.tv_device_heartbeat(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.tv_device_heartbeat(text,text,jsonb)
  to service_role;

revoke all on function public.tv_device_get_revision(text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.tv_device_get_revision(text,text,uuid)
  to service_role;

revoke all on function public.tv_device_ack_revision(text,text,uuid,boolean,text)
  from public, anon, authenticated;
grant execute on function public.tv_device_ack_revision(text,text,uuid,boolean,text)
  to service_role;

revoke all on function public.tv_device_pull_commands(text,text,integer)
  from public, anon, authenticated;
grant execute on function public.tv_device_pull_commands(text,text,integer)
  to service_role;

revoke all on function public.tv_device_ack_command(text,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.tv_device_ack_command(text,text,uuid,text,text)
  to service_role;

revoke all on function public.tv_device_report_screenshot(text,text,text)
  from public, anon, authenticated;
grant execute on function public.tv_device_report_screenshot(text,text,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 20. Improved monitoring view
-- ---------------------------------------------------------------------------

create or replace view public.tv_admin_device_overview
with (security_invoker = true)
as
select
  d.id,
  d.name,
  d.device_code,
  d.enabled,

  case
    when not d.enabled then 'disabled'
    when d.last_seen_at is null then 'never_seen'
    when d.last_seen_at < now() - make_interval(secs => s.device_offline_after_seconds)
      then 'offline'
    else 'online'
  end as effective_status,

  d.network_status,
  d.paired_at,
  d.credential_version,

  d.last_seen_at,
  d.last_sync_at,

  d.last_screenshot_at,
  d.last_screenshot_path,

  d.app_version,
  d.device_model,
  d.android_version,

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
cross join public.tv_system_settings s
left join public.tv_content c
  on c.id = d.current_content_id
left join public.tv_config_revisions desired
  on desired.id = d.desired_revision_id
left join public.tv_config_revisions applied
  on applied.id = d.applied_revision_id
where s.id = 1;

revoke all on public.tv_admin_device_overview from anon;
grant select on public.tv_admin_device_overview to authenticated;

-- ---------------------------------------------------------------------------
-- 21. Comments
-- ---------------------------------------------------------------------------

comment on table public.tv_device_pairing_sessions is
'One-time, short-lived device pairing sessions. Only SHA-256 pairing-code hashes are stored.';

comment on table public.tv_device_security_events is
'Security/audit events for device registration, pairing, revocation and revision failures.';

comment on function public.tv_device_claim_pairing(text,jsonb) is
'Gateway-only pairing RPC. Returns raw 256-bit device token exactly once; database stores hash only.';

comment on function public.tv_device_heartbeat(text,text,jsonb) is
'Gateway-only heartbeat and telemetry RPC authenticated by device_code + random device token.';

comment on function public.tv_admin_publish_config(jsonb) is
'Admin-only atomic configuration publisher. Creates immutable revision and points enabled devices to it.';

-- ---------------------------------------------------------------------------
-- 22. Schema version
-- ---------------------------------------------------------------------------

update public.tv_schema_meta
set schema_version = '2B.1.0',
    applied_at = now(),
    notes = 'MJHK TV Phase 2B secure device authentication and API/RPC layer'
where id = 1;

commit;
