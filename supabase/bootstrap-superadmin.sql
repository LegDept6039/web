-- Create the user in Supabase Authentication > Users first.
-- Replace the email below, then paste this entire script into SQL Editor.
do $$
declare account_id uuid;
begin
  select id into account_id from auth.users where lower(email)=lower('itsmevance19@gmail.com');
  if account_id is null then raise exception 'Create this email in Authentication > Users first'; end if;
  update public.staff_accounts set role='superadmin', active=true where user_id=account_id;
  if not found then raise exception 'Run migration 202609300003_auth.sql first'; end if;
end $$;
