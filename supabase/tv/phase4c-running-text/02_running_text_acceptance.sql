-- MJHK TV Phase 4C-B
-- 02_running_text_acceptance.sql
-- READ ONLY.

select
  id,
  text_content,
  active,
  priority,
  sort_order,
  weekdays,
  state_scope,
  starts_at,
  ends_at,
  (
    active
    and extract(dow from now())::int = any(weekdays)
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  ) as eligible_now
from public.tv_running_text
order by priority desc, sort_order, created_at;

-- Expected: no rows.
select
  id,
  state_scope
from public.tv_running_text
where cardinality(state_scope) = 0
   or not (
     state_scope <@ array[
       'NORMAL','PRE_ADHAN','ADHAN','IQAMAH_COUNTDOWN','IQAMAH','SALAT',
       'PRAYER_PROHIBITION','SYURUQ','ISYRAQ','IMSAK',
       'FRIDAY_PRE_ADHAN','FRIDAY_KHUTBAH','FRIDAY_SALAT'
     ]::text[]
   );
