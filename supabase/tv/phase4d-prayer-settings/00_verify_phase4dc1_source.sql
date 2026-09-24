-- MJHK TV Phase 4D-C1
-- READ ONLY acceptance query.

select
  id,
  timezone,
  latitude,
  longitude,
  prayer_calculation_config,
  hijri_adjustment_days,
  ramadan_mode,
  imsak_offset_minutes,
  syuruq_adjustment_minutes,
  syuruq_wait_minutes,
  isyraq_duration_minutes,
  forbidden_before_maghrib_minutes,
  fullscreen_adhan_threshold_minutes,
  fullscreen_iqamah_threshold_minutes,
  beep_adhan_count,
  beep_iqamah_count,
  beep_forbidden_count,
  beep_isyraq_count,
  beep_imsak_count,
  jumat_prayer_end_mode,
  jumat_prayer_duration_minutes,
  updated_at
from public.tv_system_settings
where id = 1;

select
  prayer_code,
  display_name,
  time_adjustment_minutes,
  prayer_duration_minutes,
  adhan_countdown_minutes,
  adhan_pause_minutes,
  iqamah_countdown_minutes,
  iqamah_pause_seconds,
  enabled,
  updated_at
from public.tv_prayer_rules
order by case prayer_code
  when 'subuh' then 1
  when 'dzuhur' then 2
  when 'ashar' then 3
  when 'maghrib' then 4
  when 'isya' then 5
  when 'jumat' then 6
  else 99
end;

-- Boundary checks: no C1 write is expected in these columns/tables.
select
  prayer_code,
  enabled,
  duration_minutes,
  stop_before_adhan_minutes,
  audio_url,
  updated_at
from public.tv_audio_rules
order by prayer_code;
