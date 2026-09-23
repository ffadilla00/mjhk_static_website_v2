-- MJHK TV Phase 4D-A1
-- AUDITED v3 ACCEPTANCE
-- READ ONLY.

select count(*) as imsak_definition_count
from public.tv_state_definitions
where state_code = 'IMSAK';

select count(*) as imsak_asset_count
from public.tv_state_assets
where state_code = 'IMSAK';

select exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'tv_system_settings'
    and column_name = 'beep_imsak_count'
    and data_type = 'smallint'
    and is_nullable = 'NO'
) as beep_imsak_contract_ok;

select *
from public.tv_system_settings
where beep_imsak_count < 0
   or beep_imsak_count > 60;

select
  state_code,
  display_name,
  priority_rank,
  priority_class,
  resume_policy,
  enabled
from public.tv_state_definitions
where state_code in (
  'ADHAN_PAUSE',
  'IQAMAH_PAUSE',
  'SALAT',
  'FORBIDDEN_PRAYER',
  'SYURUQ_WAIT',
  'ISYRAQ',
  'IMSAK',
  'JUMAT_ADHAN_KHUTBAH',
  'SALAT_JUMAT'
)
order by state_code;
