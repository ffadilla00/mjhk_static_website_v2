-- Expected result: all six columns are listed and every invalid/null count is 0.

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'kajian'
  and column_name in (
    'poster_mode',
    'template_preset',
    'kutipan',
    'sumber_kutipan',
    'template_content_mode',
    'speaker_photo_url'
  )
order by column_name;

select
  count(*) filter (where poster_mode not in ('legacy', 'template')) as invalid_poster_mode,
  count(*) filter (
    where template_preset is not null
      and template_preset not in ('quran', 'kitab', 'kegiatan')
  ) as invalid_template_preset,
  count(*) filter (
    where template_content_mode not in ('default', 'speaker_photo')
  ) as invalid_template_content_mode,
  count(*) filter (where poster_mode is null) as null_poster_mode,
  count(*) filter (where template_content_mode is null) as null_template_content_mode
from public.kajian;

select
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.kajian'::regclass
  and conname in (
    'kajian_poster_mode_check',
    'kajian_template_preset_check',
    'kajian_template_content_mode_check'
  )
order by conname;
