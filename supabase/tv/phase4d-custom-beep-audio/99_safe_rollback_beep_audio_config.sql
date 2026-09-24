-- MJHK TV Phase 4D-C3 safe rollback.
--
-- Abort if any cue has already been configured with a storage path.

do $$
declare
  v_config jsonb;
begin
  select beep_audio_config
  into v_config
  from public.tv_system_settings
  where id = 1;

  if v_config is not null and exists (
    select 1
    from jsonb_each(v_config) as cue(key, value)
    where nullif(value ->> 'storage_path', '') is not null
  ) then
    raise exception
      'ROLLBACK ABORTED: custom beep audio assets are already configured.';
  end if;
end
$$;

alter table public.tv_system_settings
  drop constraint if exists tv_system_settings_beep_audio_config_object_check,
  drop column if exists beep_audio_config;
