-- MJHK TV Phase 4E-B1 exact revoke contract audit
-- READ ONLY. Run in Supabase SQL Editor.

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'tv_admin_revoke_device';

select
  has_function_privilege(
    'authenticated',
    'public.tv_admin_revoke_device(uuid,text)',
    'EXECUTE'
  ) as authenticated_can_execute;
