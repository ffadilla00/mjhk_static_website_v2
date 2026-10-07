-- Emergency rollback only. Existing poster_url values remain untouched.

begin;

alter table public.kajian
  drop constraint if exists kajian_template_content_mode_check,
  drop constraint if exists kajian_template_preset_check,
  drop constraint if exists kajian_poster_mode_check;

alter table public.kajian
  drop column if exists speaker_photo_url,
  drop column if exists template_content_mode,
  drop column if exists sumber_kutipan,
  drop column if exists kutipan,
  drop column if exists template_preset,
  drop column if exists poster_mode;

commit;
