-- READ ONLY. Run the contents in Supabase SQL Editor to inspect policy drift.
-- No migrations, grants, password resets or account changes are performed.
-- Choose a different active staff UUID in the subquery if investigating one account.
begin transaction read only;
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public'
 and tablename in ('staff_accounts','user_office_access','departments');
select has_table_privilege('authenticated','public.staff_accounts','SELECT') as staff_select,
 has_table_privilege('authenticated','public.user_office_access','SELECT') as membership_select,
 has_function_privilege('authenticated','public.is_superadmin()','EXECUTE') as superadmin_helper;
select set_config('request.jwt.claim.sub',
 (select user_id::text from public.staff_accounts where active and deleted_at is null and role='superadmin' limit 1),true);
set local role authenticated;
select user_id=auth.uid() as uuid_matches,role,active,deleted_at is null as not_deleted
from public.staff_accounts where user_id=auth.uid();
select count(*) as own_memberships from public.user_office_access where user_id=auth.uid();
rollback;
