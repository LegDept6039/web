begin;

create table public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'superadmin')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.staff_accounts enable row level security;
revoke all on public.staff_accounts from public, anon, authenticated;
grant select on public.staff_accounts to authenticated;

create function public.portal_sync_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.staff_accounts (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.portal_sync_staff() from public, anon, authenticated;
create trigger portal_staff_created after insert or update of email on auth.users
for each row execute function public.portal_sync_staff();
insert into public.staff_accounts(user_id,email)
select id, coalesce(email,'') from auth.users on conflict do nothing;
create trigger staff_updated before update on public.staff_accounts
for each row execute function public.portal_touch_updated_at();

create function public.is_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_accounts
    where user_id = (select auth.uid()) and active and role = 'superadmin');
$$;
revoke all on function public.is_superadmin() from public, anon, authenticated;
grant execute on function public.is_superadmin() to authenticated;
create policy staff_read on public.staff_accounts for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_superadmin()));

create function public.set_staff_access(p_user_id uuid, p_role text, p_active boolean, p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20260930, 3);
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('user','superadmin') or p_active is null
    or p_display_name is null or length(p_display_name) > 120 then
    raise exception 'Invalid account settings' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'superadmin' or not p_active) then
    raise exception 'You cannot remove your own superadmin access' using errcode = '22023';
  end if;
  update public.staff_accounts set role=p_role, active=p_active, display_name=trim(p_display_name)
  where user_id=p_user_id;
  if not found then raise exception 'Account not found' using errcode = '22023'; end if;
end;
$$;
revoke all on function public.set_staff_access(uuid,text,boolean,text) from public, anon, authenticated;
grant execute on function public.set_staff_access(uuid,text,boolean,text) to authenticated;

do $$ declare t text; begin
  foreach t in array array['officials','ordinances','resolutions','news','sessions','services','departments','programs','committees','hearings','document_categories','municipal_documents'] loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy superadmin_manage on public.%I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t);
  end loop;
end $$;
commit;
