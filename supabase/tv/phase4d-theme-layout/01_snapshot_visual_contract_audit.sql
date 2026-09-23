-- MJHK TV Phase 4D-B
-- READ ONLY.

select
  revision_number,
  status,
  jsonb_build_object(
    'visual_config', snapshot -> 'visual_config',
    'theme', snapshot -> 'theme',
    'layout', snapshot -> 'layout',
    'prayer_settings', snapshot -> 'prayer_settings'
  ) as visual_contract,
  created_at
from public.tv_config_revisions
order by revision_number desc
limit 10;
