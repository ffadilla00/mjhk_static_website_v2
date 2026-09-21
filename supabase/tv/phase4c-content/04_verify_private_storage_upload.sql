-- MJHK TV Phase 4C-A
-- 04_verify_private_storage_upload.sql
-- READ ONLY.

select
  id,
  title,
  content_type,
  status,
  storage_bucket,
  storage_path,
  storage_url,
  body_text,
  metadata,
  created_at,
  updated_at
from public.tv_content
where content_type in (
  'image',
  'text',
  'image_text'
)
order by updated_at desc;

-- Draft media rows should use the private TV content bucket.
select
  id,
  title,
  content_type,
  storage_bucket,
  storage_path,
  storage_url,
  status
from public.tv_content
where storage_bucket = 'tv-content'
order by updated_at desc;

-- Corresponding storage objects.
select
  id,
  bucket_id,
  name,
  metadata,
  created_at,
  updated_at
from storage.objects
where bucket_id = 'tv-content'
  and name like 'cms-slideshow/%'
order by created_at desc
limit 50;
