-- MJHK TV Phase 4D-B1
-- Extend existing default display profile theme JSONB only.
-- Does NOT change revision/runtime flow.

begin;

update public.tv_display_profiles
set theme =
  coalesce(theme, '{}'::jsonb)
  || jsonb_build_object(
    'running_label_bg',
      coalesce(theme ->> 'running_label_bg', '#c5a764'),
    'running_label_text',
      coalesce(theme ->> 'running_label_text', '#0c2f24'),
    'prayer_panel_bg',
      coalesce(theme ->> 'prayer_panel_bg', '#e7efe9'),
    'prayer_row_bg',
      coalesce(theme ->> 'prayer_row_bg', '#ffffff'),
    'prayer_title_text',
      coalesce(theme ->> 'prayer_title_text', '#13231c'),
    'prayer_time_text',
      coalesce(theme ->> 'prayer_time_text', '#13231c'),
    'prayer_highlight_bg',
      coalesce(theme ->> 'prayer_highlight_bg', '#14513f'),
    'prayer_highlight_title',
      coalesce(theme ->> 'prayer_highlight_title', '#ffffff'),
    'prayer_highlight_time',
      coalesce(theme ->> 'prayer_highlight_time', '#ffffff'),
    'accent',
      coalesce(theme ->> 'accent', '#c5a764')
  )
where is_default = true;

commit;
