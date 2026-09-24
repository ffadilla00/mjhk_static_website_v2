-- MJHK TV Phase 4D-C3
-- Custom Beep Audio source contract.
--
-- Source-only configuration.
-- No revision is created/published here.
-- tv_audio_rules is intentionally untouched.

alter table public.tv_system_settings
  add column if not exists beep_audio_config jsonb;

update public.tv_system_settings
set beep_audio_config = '{
  "adhan": {
    "enabled": false,
    "storage_bucket": null,
    "storage_path": null,
    "mime_type": null,
    "original_name": null,
    "size_bytes": null
  },
  "iqamah": {
    "enabled": false,
    "storage_bucket": null,
    "storage_path": null,
    "mime_type": null,
    "original_name": null,
    "size_bytes": null
  },
  "forbidden": {
    "enabled": false,
    "storage_bucket": null,
    "storage_path": null,
    "mime_type": null,
    "original_name": null,
    "size_bytes": null
  },
  "isyraq": {
    "enabled": false,
    "storage_bucket": null,
    "storage_path": null,
    "mime_type": null,
    "original_name": null,
    "size_bytes": null
  },
  "imsak": {
    "enabled": false,
    "storage_bucket": null,
    "storage_path": null,
    "mime_type": null,
    "original_name": null,
    "size_bytes": null
  }
}'::jsonb
where beep_audio_config is null;

alter table public.tv_system_settings
  alter column beep_audio_config set default '{
    "adhan": {
      "enabled": false,
      "storage_bucket": null,
      "storage_path": null,
      "mime_type": null,
      "original_name": null,
      "size_bytes": null
    },
    "iqamah": {
      "enabled": false,
      "storage_bucket": null,
      "storage_path": null,
      "mime_type": null,
      "original_name": null,
      "size_bytes": null
    },
    "forbidden": {
      "enabled": false,
      "storage_bucket": null,
      "storage_path": null,
      "mime_type": null,
      "original_name": null,
      "size_bytes": null
    },
    "isyraq": {
      "enabled": false,
      "storage_bucket": null,
      "storage_path": null,
      "mime_type": null,
      "original_name": null,
      "size_bytes": null
    },
    "imsak": {
      "enabled": false,
      "storage_bucket": null,
      "storage_path": null,
      "mime_type": null,
      "original_name": null,
      "size_bytes": null
    }
  }'::jsonb,
  alter column beep_audio_config set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tv_system_settings'::regclass
      and conname = 'tv_system_settings_beep_audio_config_object_check'
  ) then
    alter table public.tv_system_settings
      add constraint tv_system_settings_beep_audio_config_object_check
      check (jsonb_typeof(beep_audio_config) = 'object');
  end if;
end
$$;

comment on column public.tv_system_settings.beep_audio_config is
'Phase 4D-C3 source config for custom beep assets. Keys: adhan, iqamah, forbidden, isyraq, imsak. Private storage bucket/path only; runtime activation is revision-controlled.';
