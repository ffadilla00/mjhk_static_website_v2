-- MJHK TV Phase 4C-B
-- 00_add_running_text_state_scope.sql
-- ADDITIVE migration.

begin;

alter table public.tv_running_text
  add column if not exists state_scope text[]
  not null
  default array['NORMAL']::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tv_running_text'::regclass
      and conname = 'tv_running_text_state_scope_check'
  ) then
    alter table public.tv_running_text
      add constraint tv_running_text_state_scope_check
      check (
        cardinality(state_scope) between 1 and 13
        and state_scope <@ array[
          'NORMAL','PRE_ADHAN','ADHAN','IQAMAH_COUNTDOWN','IQAMAH','SALAT',
          'PRAYER_PROHIBITION','SYURUQ','ISYRAQ','IMSAK',
          'FRIDAY_PRE_ADHAN','FRIDAY_KHUTBAH','FRIDAY_SALAT'
        ]::text[]
      );
  end if;
end $$;

create index if not exists idx_tv_running_text_state_scope
  on public.tv_running_text using gin (state_scope);

commit;
