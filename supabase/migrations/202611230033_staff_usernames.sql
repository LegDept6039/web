begin;
-- Apply after 032. Usernames replace email in the staff interface, while the
-- existing Auth identity, email/password, roles, assignments and reset/session
-- records stay intact. Existing accounts receive deterministic login names.
lock table public.staff_accounts in access exclusive mode;

alter table public.staff_accounts add column username text;
create temporary table portal_staff_username_backfill on commit drop as
 select user_id,
  left(regexp_replace(regexp_replace(lower(split_part(email,'@',1)),
   '[^a-z0-9._-]+','-','g'),'^[^a-z0-9]+','','g'),40) as base,
  'staff-'||replace(user_id::text,'-','') as fallback,
  null::text as username
 from public.staff_accounts;
-- Reserve the automatic staff-<UUID> namespace for its own identity. Empty,
-- short or non-Latin email local parts still get a valid, unique login name.
update portal_staff_username_backfill set base=fallback
 where length(base)<3 or (base ~ '^staff-[0-9a-f]{32}$' and base<>fallback);
update portal_staff_username_backfill b set username=case
 when (select count(*) from portal_staff_username_backfill p where p.base=b.base)=1 then b.base
 else left(b.base,7)||'-'||replace(b.user_id::text,'-','') end;
-- A generated suffix must not take any other account's original base name.
-- The reserved per-identity fallback also makes adversarial collisions safe.
update portal_staff_username_backfill b set username=b.fallback
 where exists(select 1 from portal_staff_username_backfill p
  where p.user_id<>b.user_id and p.base=b.username);
do $$
begin
 if exists(select 1 from portal_staff_username_backfill
  where username is null or username !~ '^[a-z0-9][a-z0-9._-]{2,39}$')
  or exists(select 1 from portal_staff_username_backfill group by username having count(*)>1) then
  raise exception 'Username backfill is ambiguous; no accounts have been changed';
 end if;
end;
$$;
update public.staff_accounts a set username=b.username
 from portal_staff_username_backfill b where b.user_id=a.user_id;
alter table public.staff_accounts alter column username set not null;
alter table public.staff_accounts add constraint staff_accounts_username_format
 check(username ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
alter table public.staff_accounts add constraint staff_accounts_username_reserved
 check(username !~ '^staff-[0-9a-f]{32}$' or username='staff-'||replace(user_id::text,'-',''));
alter table public.staff_accounts add constraint staff_accounts_username_key unique(username);
-- Only server-held Auth Admin credentials resolve a username before login.
-- Existing authenticated SELECT permissions and self/Superadmin RLS stay intact.
grant select on public.staff_accounts to service_role;

-- Auth metadata is user-mutable, so it never chooses an account's username.
-- Provision Auth first, then use the verified Superadmin RPC below to name it.
create function public.portal_protect_staff_username() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if new.username is null then new.username='staff-'||replace(new.user_id::text,'-',''); end if;
  if new.username is distinct from 'staff-'||replace(new.user_id::text,'-','') then
   raise exception 'Use Superadmin account management to assign a username' using errcode='42501';
  end if;
 elsif new.username is distinct from old.username and not public.is_superadmin() then
  raise exception 'Superadmin access required to change a username' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function public.portal_protect_staff_username() from public,anon,authenticated;
create trigger staff_username_protect before insert or update on public.staff_accounts
 for each row execute function public.portal_protect_staff_username();
create or replace function public.portal_sync_staff() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.staff_accounts(user_id,email)
 values(new.id,coalesce(new.email,''))
 on conflict(user_id) do update set email=excluded.email;
 return new;
end;
$$;

-- Keep the historical manage_staff RPC available. Username, access and account
-- changes use the same lock and transaction; a duplicate name rolls all back.
create function public.manage_staff_account(p_user_id uuid,p_role text,p_active boolean,
 p_display_name text,p_access jsonb,p_username text,p_delete boolean default false,
 p_transparency_access boolean default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20260930,3);
 if not public.is_superadmin() then
  raise exception 'Superadmin access required' using errcode='42501';
 end if;
 if p_username is null or p_username !~ '^[a-z0-9][a-z0-9._-]{2,39}$'
  or (p_username ~ '^staff-[0-9a-f]{32}$' and p_username<>'staff-'||replace(p_user_id::text,'-','')) then
  raise exception 'Use 3 to 40 lowercase letters, numbers, periods, underscores or hyphens for the username' using errcode='22023';
 end if;
 perform public.manage_staff(p_user_id,p_role,p_active,p_display_name,p_access,p_delete,p_transparency_access);
 update public.staff_accounts set username=p_username where user_id=p_user_id;
end;
$$;
revoke all on function public.manage_staff_account(uuid,text,boolean,text,jsonb,text,boolean,boolean)
 from public,anon,authenticated;
grant execute on function public.manage_staff_account(uuid,text,boolean,text,jsonb,text,boolean,boolean)
 to authenticated;

create function public.portal_audit_staff_username() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.username is distinct from old.username then
  insert into public.audit_logs(user_id,action,entity_type,entity_id,description)
  values(auth.uid(),'username_changed','staff_accounts',new.user_id::text,
   'Staff username changed from '||old.username||' to '||new.username);
 end if;
 return new;
end;
$$;
revoke all on function public.portal_audit_staff_username() from public,anon,authenticated;
create trigger staff_username_audit after update on public.staff_accounts
 for each row execute function public.portal_audit_staff_username();

-- Return the actual mapping for the Superadmin running this migration. This
-- does not grant any anonymous lookup; staff_accounts retains its existing RLS.
select user_id,display_name,username from public.staff_accounts order by username;
commit;
