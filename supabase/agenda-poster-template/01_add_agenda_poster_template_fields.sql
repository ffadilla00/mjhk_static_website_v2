-- MJHK Agenda Poster Template CR v1.1
-- Additive migration. Existing rows remain compatible as legacy/manual posters.

begin;

alter table public.kajian
  add column if not exists poster_mode text not null default 'legacy',
  add column if not exists template_preset text,
  add column if not exists kutipan text,
  add column if not exists sumber_kutipan text,
  add column if not exists template_content_mode text not null default 'default',
  add column if not exists speaker_photo_url text;

update public.kajian
set poster_mode = 'legacy'
where poster_mode is null;

update public.kajian
set template_content_mode = 'default'
where template_content_mode is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kajian_poster_mode_check'
      and conrelid = 'public.kajian'::regclass
  ) then
    alter table public.kajian
      add constraint kajian_poster_mode_check
      check (poster_mode in ('legacy', 'template'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'kajian_template_preset_check'
      and conrelid = 'public.kajian'::regclass
  ) then
    alter table public.kajian
      add constraint kajian_template_preset_check
      check (template_preset is null or template_preset in ('quran', 'kitab', 'kegiatan'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'kajian_template_content_mode_check'
      and conrelid = 'public.kajian'::regclass
  ) then
    alter table public.kajian
      add constraint kajian_template_content_mode_check
      check (template_content_mode in ('default', 'speaker_photo'));
  end if;
end $$;

comment on column public.kajian.poster_mode is
  'Poster source: legacy for manual upload, template for generated Full HD poster.';
comment on column public.kajian.template_preset is
  'Built-in poster preset: quran, kitab, or kegiatan.';
comment on column public.kajian.kutipan is
  'Optional quote displayed on generated agenda poster.';
comment on column public.kajian.sumber_kutipan is
  'Optional source/reference for the poster quote.';
comment on column public.kajian.template_content_mode is
  'Right-side template content: default quote and QRIS, or speaker_photo.';
comment on column public.kajian.speaker_photo_url is
  'Optional public Storage URL for the speaker photo used by the poster template.';

commit;
