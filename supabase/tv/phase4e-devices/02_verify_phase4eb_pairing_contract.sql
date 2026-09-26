-- MJHK TV Phase 4E-B post-UI read-only audit
-- Safe to run in Supabase SQL Editor. No mutation.

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tv_admin_register_device',
    'tv_admin_create_pairing_code',
    'tv_device_claim_pairing'
  )
order by p.proname;

select
  id,
  device_id,
  expires_at,
  claimed_at,
  created_at
from public.tv_device_pairing_sessions
order by created_at desc
limit 20;

select
  count(*) as pairing_sessions_with_hash
from public.tv_device_pairing_sessions
where pairing_code_hash is not null;
