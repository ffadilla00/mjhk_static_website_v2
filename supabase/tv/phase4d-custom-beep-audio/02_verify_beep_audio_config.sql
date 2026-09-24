-- MJHK TV Phase 4D-C3 source acceptance
-- READ ONLY.

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tv_system_settings'
  and column_name = 'beep_audio_config';

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.tv_system_settings'::regclass
  and conname = 'tv_system_settings_beep_audio_config_object_check';

select
  id,
  beep_adhan_count,
  beep_iqamah_count,
  beep_forbidden_count,
  beep_isyraq_count,
  beep_imsak_count,
  beep_audio_config,
  updated_at
from public.tv_system_settings
where id = 1;

select
  jsonb_typeof(beep_audio_config) = 'object' as config_is_object,
  beep_audio_config ?& array[
    'adhan','iqamah','forbidden','isyraq','imsak'
  ] as all_cues_present
from public.tv_system_settings
where id = 1;

-- Confirm deferred Pre-Adhan table remains independent.
select
  prayer_code,
  enabled,
  duration_minutes,
  stop_before_adhan_minutes,
  audio_url
from public.tv_audio_rules
order by prayer_code;
