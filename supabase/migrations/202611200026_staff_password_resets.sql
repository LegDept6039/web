begin;
-- Apply after 025. No account roles, status, memberships, content or passwords
-- are changed by this migration. Auth Admin mutations stay in server actions.
create table public.staff_password_resets (
 user_id uuid primary key references public.staff_accounts(user_id) on delete restrict,
 generation uuid not null,
 state text not null check(state in ('issuing','pending','completing','complete','failed')),
 operation text not null default 'reset' check(operation in ('reset','change')),
 initiated_by uuid not null references public.staff_accounts(user_id) on delete restrict,
 initiated_at timestamptz not null default clock_timestamp(),
 activated_at timestamptz,
 expires_at timestamptz,
 completed_at timestamptz,
 temp_password_hash text check(temp_password_hash is null or temp_password_hash ~ '^[a-f0-9]{64}$'),
 check(state <> 'pending' or (activated_at is not null and expires_at is not null and temp_password_hash is not null)),
 check(state <> 'complete' or (completed_at is not null and temp_password_hash is null))
);
alter table public.staff_password_resets enable row level security;
-- Override Supabase default table grants too; even the privileged server writes
-- reset state through the lifecycle RPCs rather than direct table mutations.
revoke all on public.staff_password_resets from public,anon,authenticated,service_role;
grant select on public.staff_password_resets to service_role;

-- Session creation time, rather than the refreshable JWT iat claim, prevents an
-- old/renewed token regaining CMS privileges after the reset flag is cleared.
create function public.portal_staff_credentials_ready(p_user_id uuid,p_session_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_accounts a where a.user_id=p_user_id and a.active and a.deleted_at is null)
 and not exists(select 1 from public.staff_password_resets r where r.user_id=p_user_id and (
  r.state <> 'complete' or not exists(select 1 from auth.sessions s
   where s.id=p_session_id and s.user_id=p_user_id and s.created_at>r.completed_at)
 ));
$$;
revoke all on function public.portal_staff_credentials_ready(uuid,uuid) from public,anon,authenticated;
create function public.staff_credentials_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select public.portal_staff_credentials_ready(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
$$;
revoke all on function public.staff_credentials_ready() from public,anon,authenticated;
grant execute on function public.staff_credentials_ready() to authenticated;

-- This read-only RPC is usable while the normal staff workspace is locked.
-- It never exposes the password digest, another user or the reset initiator.
create function public.password_reset_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'required',coalesce(r.state <> 'complete',false),
  'ready',public.staff_credentials_ready(),
  'generation',r.generation,'state',r.state,'expires_at',r.expires_at,
  'session_id',nullif(auth.jwt()->>'session_id',''))
 from (select auth.uid() as id) u left join public.staff_password_resets r on r.user_id=u.id;
$$;
revoke all on function public.password_reset_status() from public,anon,authenticated;
grant execute on function public.password_reset_status() to authenticated;

create function public.begin_staff_password_reset(p_actor uuid,p_actor_session uuid,p_user_id uuid,p_generation uuid,p_password_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare existing_state text;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261120,26);
 if not public.portal_staff_credentials_ready(p_actor,p_actor_session)
  or not exists(select 1 from public.staff_accounts where user_id=p_actor and role='superadmin')
  or not exists(select 1 from auth.sessions where id=p_actor_session and user_id=p_actor)
 then raise exception 'Superadmin access required' using errcode='42501'; end if;
 if p_actor=p_user_id then raise exception 'Use your account password form to change your own password' using errcode='22023'; end if;
 if p_generation is null or p_password_hash is null or p_password_hash !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid reset request' using errcode='22023'; end if;
 -- A reset never enables a disabled account or changes role/memberships.
 perform 1 from public.staff_accounts where user_id=p_user_id and active and deleted_at is null for update;
 if not found then raise exception 'Account not found' using errcode='22023'; end if;
 select state into existing_state from public.staff_password_resets where user_id=p_user_id for update;
 if existing_state in ('issuing','completing') then raise exception 'A password operation is already in progress' using errcode='55000'; end if;
 insert into public.staff_password_resets(user_id,generation,state,initiated_by,temp_password_hash)
 values(p_user_id,p_generation,'issuing',p_actor,p_password_hash)
 on conflict(user_id) do update set generation=excluded.generation,state='issuing',operation='reset',initiated_by=excluded.initiated_by,
  initiated_at=clock_timestamp(),temp_password_hash=excluded.temp_password_hash,activated_at=null,expires_at=null,completed_at=null;
 delete from public.staff_browser_sessions where user_id=p_user_id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,description)
 values(p_actor,'password_reset_started','staff_accounts',p_user_id::text,'Superadmin initiated a temporary password reset');
 return true;
end $$;

create function public.activate_staff_password_reset(p_user_id uuid,p_generation uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.staff_password_resets set state='pending',activated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 minutes'
 where user_id=p_user_id and generation=p_generation and state='issuing';
 if not found then raise exception 'This reset request is no longer current' using errcode='55000'; end if;
 return true;
end $$;

create function public.claim_staff_password_change(p_user_id uuid,p_generation uuid,p_session_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.staff_password_resets r set state='completing'
 where r.user_id=p_user_id and r.generation=p_generation and r.state='pending' and r.expires_at>clock_timestamp()
 and exists(select 1 from public.staff_accounts a where a.user_id=p_user_id and a.active and a.deleted_at is null)
 and exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_user_id and s.created_at>=r.activated_at);
 if not found then raise exception 'Temporary password is expired, replaced or unavailable; contact the Superadmin' using errcode='42501'; end if;
 return true;
end $$;

-- Ordinary account password changes use the same lock, so an in-flight account
-- change cannot overwrite a newly issued temporary password (or vice versa).
create function public.begin_staff_password_update(p_user_id uuid,p_session_id uuid,p_generation uuid,p_password_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261120,26);
 if not public.portal_staff_credentials_ready(p_user_id,p_session_id)
  or not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id)
 then raise exception 'A current staff session is required' using errcode='42501'; end if;
 if p_generation is null
 then raise exception 'Invalid password update' using errcode='22023'; end if;
 insert into public.staff_password_resets(user_id,generation,state,operation,initiated_by)
 values(p_user_id,p_generation,'completing','change',p_user_id)
 on conflict(user_id) do update set generation=excluded.generation,state='completing',operation='change',initiated_by=p_user_id,
  initiated_at=clock_timestamp(),activated_at=null,expires_at=null,completed_at=null,temp_password_hash=null;
 delete from public.staff_browser_sessions where user_id=p_user_id;
 return true;
end $$;

create function public.finish_staff_password_change(p_user_id uuid,p_generation uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare completed_operation text;
begin
 -- Call only after Auth confirms the password change and global sign-out.
 -- Expiry was checked when the change was claimed. Let an already accepted
 -- Auth request finish after its deadline instead of stranding a changed password.
 update public.staff_password_resets r set state='complete',completed_at=clock_timestamp(),temp_password_hash=null
 where r.user_id=p_user_id and r.generation=p_generation and r.state='completing'
 and exists(select 1 from public.staff_accounts a where a.user_id=p_user_id and a.active and a.deleted_at is null)
 returning operation into completed_operation;
 if not found then raise exception 'This password change is no longer current' using errcode='42501'; end if;
 delete from public.staff_browser_sessions where user_id=p_user_id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,description)
 values(p_user_id,case when completed_operation='reset' then 'password_reset_completed' else 'password_changed' end,
  'staff_accounts',p_user_id::text,case when completed_operation='reset' then 'Staff completed the required password change' else 'Staff changed their account password' end);
 return true;
end $$;

create function public.fail_staff_password_reset(p_user_id uuid,p_generation uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 -- Use only for a definitive external Auth failure. A timeout/unknown result
 -- must retain its busy state, so a delayed operation cannot overwrite a retry.
 update public.staff_password_resets set state='failed',temp_password_hash=null
 where user_id=p_user_id and generation=p_generation and state in ('issuing','completing');
 if not found then raise exception 'This reset operation is no longer current' using errcode='55000'; end if;
 return true;
end $$;

revoke all on function public.begin_staff_password_reset(uuid,uuid,uuid,uuid,text),public.activate_staff_password_reset(uuid,uuid),
 public.claim_staff_password_change(uuid,uuid,uuid),public.begin_staff_password_update(uuid,uuid,uuid,text),public.finish_staff_password_change(uuid,uuid),public.fail_staff_password_reset(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.begin_staff_password_reset(uuid,uuid,uuid,uuid,text),public.activate_staff_password_reset(uuid,uuid),
 public.claim_staff_password_change(uuid,uuid,uuid),public.begin_staff_password_update(uuid,uuid,uuid,text),public.finish_staff_password_change(uuid,uuid),public.fail_staff_password_reset(uuid,uuid)
 to service_role;

-- All existing CMS table and Storage policies use these authorization helpers.
-- Published content remains available through the existing anonymous policies.
create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path='' as $$
 select public.staff_credentials_ready() and exists(select 1 from public.staff_accounts
  where user_id=auth.uid() and active and deleted_at is null and role='superadmin');
$$;
create or replace function public.can_manage_office(p_office uuid,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.staff_credentials_ready() and p_operation in ('read','write','delete') and (
 public.is_superadmin() or exists(
 select 1 from public.staff_accounts s join public.user_office_access a on a.user_id=s.user_id
 join public.offices o on o.id=a.office_id
 where s.user_id=auth.uid() and s.active and s.deleted_at is null and o.active and o.id=p_office
 and (p_operation='read' or
  (p_operation='write' and s.role in ('admin','editor') and a.permission_level in ('editor','manager')) or
  (p_operation='delete' and s.role='admin' and a.permission_level='manager'))));
$$;
create or replace function public.can_read_transparency() returns boolean
language sql stable security definer set search_path='' as $$
 select public.staff_credentials_ready() and exists(select 1 from public.staff_accounts
 where user_id=auth.uid() and active and deleted_at is null
 and (role='superadmin' or (transparency_access and role in ('admin','editor','viewer'))));
$$;
create or replace function public.can_manage_transparency() returns boolean
language sql stable security definer set search_path='' as $$
 select public.staff_credentials_ready() and exists(select 1 from public.staff_accounts
 where user_id=auth.uid() and active and deleted_at is null
 and (role='superadmin' or (transparency_access and role in ('admin','editor'))));
$$;
drop policy membership_read on public.user_office_access;
create policy membership_read on public.user_office_access for select to authenticated
 using(public.staff_credentials_ready() and (user_id=auth.uid() or public.is_superadmin()));

create or replace function public.start_staff_session(p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not public.staff_credentials_ready() then return false; end if;
 delete from public.staff_browser_sessions where user_id=auth.uid() and expires_at<=clock_timestamp();
 insert into public.staff_browser_sessions(token_hash,user_id) values(p_hash,auth.uid());
 return true;
end $$;
create or replace function public.staff_session_deadline(p_hash text,p_touch boolean default false) returns double precision
language plpgsql security definer set search_path='' as $$
declare deadline timestamptz;
begin
 if not public.staff_credentials_ready() then return null; end if;
 if p_touch then
  update public.staff_browser_sessions set expires_at=clock_timestamp()+interval '60 minutes'
  where token_hash=p_hash and user_id=auth.uid() and expires_at>clock_timestamp() returning expires_at into deadline;
 else
  select expires_at into deadline from public.staff_browser_sessions
  where token_hash=p_hash and user_id=auth.uid() and expires_at>clock_timestamp();
 end if;
 return greatest(0,extract(epoch from (deadline-clock_timestamp()))*1000);
end $$;
commit;
