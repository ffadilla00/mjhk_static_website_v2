-- MJHK TV Phase 4C-B
-- 99_safe_rollback_state_scope.sql
-- Refuses rollback when user-authored non-default state scopes exist.

do $$
declare
  v_non_default bigint;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tv_running_text'
      and column_name = 'state_scope'
  ) then
    raise notice 'state_scope already absent; nothing to roll back.';
    return;
  end if;

  select count(*)
    into v_non_default
  from public.tv_running_text
  where state_scope is distinct from array['NORMAL']::text[];

  if v_non_default > 0 then
    raise exception
      'ROLLBACK ABORTED: % running text row(s) use non-default state_scope.',
      v_non_default;
  end if;

  drop index if exists public.idx_tv_running_text_state_scope;

  alter table public.tv_running_text
    drop constraint if exists tv_running_text_state_scope_check,
    drop column if exists state_scope;
end $$;
