-- MJHK TV Phase 4C-A
-- 02_audit_content_checks.sql
-- READ ONLY.
--
-- Run this before Phase 4C-B / later status lifecycle changes.
-- It gives the exact CHECK expressions instead of guessing them.

select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel
  on rel.oid = con.conrelid
join pg_namespace nsp
  on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'tv_content'
  and con.contype = 'c'
order by con.conname;
