-- MJHK TV Phase 4D-A2
-- 99_safe_rollback_dedicated_screen_source_type.sql
--
-- SAFE ROLLBACK:
-- aborts when dedicated_screen rows already exist.

begin;

do $$
declare
  v_count bigint;
begin
  select count(*)
    into v_count
  from public.tv_content
  where source_type = 'dedicated_screen';

  if v_count > 0 then
    raise exception
      'Rollback aborted: % dedicated_screen tv_content row(s) already exist.',
      v_count;
  end if;
end $$;

alter table public.tv_content
  drop constraint tv_content_source_type_check;

alter table public.tv_content
  add constraint tv_content_source_type_check
  check (
    source_type is null
    or source_type = any (
      array[
        'manual'::text,
        'agenda'::text,
        'finance'::text,
        'media'::text,
        'profile'::text,
        'system'::text
      ]
    )
  );

commit;
