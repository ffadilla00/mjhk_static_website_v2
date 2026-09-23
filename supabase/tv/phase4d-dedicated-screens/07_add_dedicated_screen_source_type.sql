-- MJHK TV Phase 4D-A2
-- 07_add_dedicated_screen_source_type.sql

begin;

do $$
declare
  v_definition text;
begin
  select pg_get_constraintdef(con.oid)
    into v_definition
  from pg_constraint con
  where con.conrelid = 'public.tv_content'::regclass
    and con.conname = 'tv_content_source_type_check';

  if v_definition is null then
    raise exception 'Migration aborted: tv_content_source_type_check not found.';
  end if;

  -- Guard against schema drift. This migration is intentionally based on the
  -- audited allowlist only.
  if v_definition not ilike '%manual%'
     or v_definition not ilike '%agenda%'
     or v_definition not ilike '%finance%'
     or v_definition not ilike '%media%'
     or v_definition not ilike '%profile%'
     or v_definition not ilike '%system%' then
    raise exception
      'Migration aborted: source_type constraint differs from audited contract: %',
      v_definition;
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
        'system'::text,
        'dedicated_screen'::text
      ]
    )
  );

commit;
