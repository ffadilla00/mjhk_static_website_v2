-- MJHK TV Phase 4D-A
-- READ ONLY.

with latest as (
  select id, revision_number, status, snapshot
  from public.tv_config_revisions
  order by revision_number desc
  limit 1
)
select id, revision_number, status, snapshot
from latest;

with latest as (
  select snapshot
  from public.tv_config_revisions
  order by revision_number desc
  limit 1
)
select
  key,
  jsonb_typeof(value) as json_type
from latest,
lateral jsonb_each(snapshot)
order by key;

with latest as (
  select
    id,
    revision_number,
    snapshot::text as snapshot_text
  from public.tv_config_revisions
  order by revision_number desc
  limit 1
)
select
  id,
  revision_number,
  snapshot_text like '%PRE_ADHAN%' as has_pre_adhan,
  snapshot_text like '%ADHAN%' as has_adhan,
  snapshot_text like '%IQAMAH_COUNTDOWN%' as has_iqamah_countdown,
  snapshot_text like '%IQAMAH%' as has_iqamah,
  snapshot_text like '%SALAT%' as has_salat,
  snapshot_text like '%SYURUQ%' as has_syuruq,
  snapshot_text like '%ISYRAQ%' as has_isyraq,
  snapshot_text like '%IMSAK%' as has_imsak,
  snapshot_text like '%PRAYER_PROHIBITION%' as has_prayer_prohibition,
  snapshot_text like '%FRIDAY_PRE_ADHAN%' as has_friday_pre_adhan,
  snapshot_text like '%FRIDAY_KHUTBAH%' as has_friday_khutbah,
  snapshot_text like '%FRIDAY_SALAT%' as has_friday_salat
from latest;
