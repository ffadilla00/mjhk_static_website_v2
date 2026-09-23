-- SAFE rollback of Phase 4D-B1-added JSON keys only.
-- Existing Phase 2 keys are preserved.

begin;

update public.tv_display_profiles
set theme = theme
  - 'running_label_bg'
  - 'running_label_text'
  - 'prayer_panel_bg'
  - 'prayer_row_bg'
  - 'prayer_title_text'
  - 'prayer_time_text'
  - 'prayer_highlight_bg'
  - 'prayer_highlight_title'
  - 'prayer_highlight_time'
  - 'accent'
where is_default = true;

commit;
