-- MJHK TV Phase 4C-A
-- 01_verify_slideshow_content.sql
-- READ ONLY.

select
  id,
  title,
  content_type,
  status,
  storage_url,
  body_text,
  metadata,
  created_by,
  created_at,
  updated_at
from public.tv_content
where content_type in (
  'image',
  'text',
  'image_text'
)
order by updated_at desc;
