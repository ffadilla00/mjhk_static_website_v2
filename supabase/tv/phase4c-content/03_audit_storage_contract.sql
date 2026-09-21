-- MJHK TV Phase 4C-A.1
-- 03_audit_storage_contract.sql
-- READ ONLY.
--
-- Goal:
-- Determine the real media bucket + Storage RLS contract before CMS upload is enabled.

-- Existing Storage buckets.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
order by name;

-- Existing policies on storage.objects.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- Existing policies on storage.buckets.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'buckets'
order by policyname;

-- Existing tv_content records that already reference Storage.
select
  id,
  title,
  content_type,
  storage_url,
  storage_bucket,
  storage_path,
  status,
  created_at,
  updated_at
from public.tv_content
where storage_bucket is not null
   or storage_path is not null
   or storage_url is not null
order by updated_at desc
limit 50;
