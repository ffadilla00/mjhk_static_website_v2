-- MJHK TV Phase 4D-B1 verification

select
  id,
  name,
  is_default,
  prayer_panel_side,
  header_show_clock,
  header_show_mosque,
  header_show_gregorian_date,
  header_show_hijri_date,
  default_slide_duration_seconds,
  running_text_speed_px_per_second,
  theme,
  updated_at
from public.tv_display_profiles
order by is_default desc, name;

select
  name,
  theme ?& array[
    'canvas_bg',
    'header_bg',
    'header_text',
    'running_bg',
    'running_text',
    'running_label_bg',
    'running_label_text',
    'prayer_panel_bg',
    'prayer_row_bg',
    'prayer_title_text',
    'prayer_time_text',
    'prayer_highlight_bg',
    'prayer_highlight_title',
    'prayer_highlight_time',
    'accent'
  ] as full_theme_contract
from public.tv_display_profiles
where is_default = true;
