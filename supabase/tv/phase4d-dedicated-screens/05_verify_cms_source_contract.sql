-- MJHK TV Phase 4D-A2
-- READ ONLY acceptance helper.

select
  a.state_code,
  a.content_id,
  a.enabled,
  a.notes,
  a.updated_at,
  c.title as content_title,
  c.content_type,
  c.status as content_status
from public.tv_state_assets a
left join public.tv_content c
  on c.id = a.content_id
where a.state_code in (
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
order by a.state_code;

select
  state_code,
  display_name,
  enabled
from public.tv_state_definitions
where state_code in (
  'ADHAN_COUNTDOWN',
  'IQAMAH_COUNTDOWN',
  'JUMAT_PRE_ADHAN'
)
order by state_code;
