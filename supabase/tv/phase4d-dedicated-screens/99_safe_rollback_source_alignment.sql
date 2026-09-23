-- MJHK TV Phase 4D-A1
-- AUDITED v3 SAFE ROLLBACK
--
-- Run only if A1 must be reverted before IMSAK is customized.

do $$
declare
  v_content uuid;
  v_non_default bigint;
begin
  select content_id
    into v_content
  from public.tv_state_assets
  where state_code = 'IMSAK'
  limit 1;

  if v_content is not null then
    raise exception
      'ROLLBACK ABORTED: IMSAK already references content_id %.',
      v_content;
  end if;

  select count(*)
    into v_non_default
  from public.tv_system_settings
  where beep_imsak_count is distinct from 5;

  if v_non_default > 0 then
    raise exception
      'ROLLBACK ABORTED: beep_imsak_count has been customized.';
  end if;
end $$;

begin;

delete from public.tv_state_assets
where state_code = 'IMSAK';

delete from public.tv_state_definitions
where state_code = 'IMSAK';

alter table public.tv_system_settings
  drop constraint if exists tv_system_settings_beep_imsak_count_check,
  drop column if exists beep_imsak_count;

commit;
