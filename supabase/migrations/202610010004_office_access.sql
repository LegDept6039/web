begin;
alter table public.staff_accounts drop constraint staff_accounts_role_check;
update public.staff_accounts set role='viewer' where role='user';
alter table public.staff_accounts alter column role set default 'viewer';
alter table public.staff_accounts add constraint staff_accounts_role_check check(role in ('superadmin','admin','editor','viewer'));
alter table public.staff_accounts add column deleted_at timestamptz;
alter table public.staff_accounts add constraint deleted_staff_inactive check(deleted_at is null or active=false);

create table public.offices (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160),
 short_name text not null default '' check(length(short_name)<=40), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 department text not null check(department in ('executive','legislative')), description text not null default '',
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_office_access (
 user_id uuid not null references public.staff_accounts(user_id) on delete restrict,
 office_id uuid not null references public.offices(id) on delete restrict,
 permission_level text not null check(permission_level in ('viewer','editor','manager')),
 created_at timestamptz not null default now(), primary key(user_id,office_id)
);
create index user_office_access_office on public.user_office_access(office_id,user_id);
create table public.audit_logs (
 id bigint generated always as identity primary key, user_id uuid references public.staff_accounts(user_id) on delete restrict,
 action text not null, entity_type text not null, entity_id text, office_id uuid,
 description text not null, created_at timestamptz not null default now()
);
create index audit_logs_created on public.audit_logs(created_at desc,id desc);
alter table public.offices enable row level security;
alter table public.user_office_access enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.offices,public.user_office_access,public.audit_logs from public,anon,authenticated;
grant select,insert,update,delete on public.offices to authenticated;
grant select on public.user_office_access,public.audit_logs to authenticated;
create trigger office_updated before update on public.offices for each row execute function public.portal_touch_updated_at();

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_accounts where user_id=(select auth.uid()) and active and deleted_at is null and role='superadmin');
$$;
-- Role limits WHAT; membership and its level limit WHERE. Null ownership is superadmin-only.
create function public.can_manage_office(p_office uuid,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_operation in ('read','write','delete') and (
 public.is_superadmin() or exists(
 select 1 from public.staff_accounts s
 join public.user_office_access a on a.user_id=s.user_id
 join public.offices o on o.id=a.office_id
 where s.user_id=(select auth.uid()) and s.active and s.deleted_at is null and o.active and o.id=p_office
 and (p_operation='read' or
      (p_operation='write' and s.role in ('admin','editor') and a.permission_level in ('editor','manager')) or
      (p_operation='delete' and s.role='admin' and a.permission_level='manager'))));
$$;
revoke all on function public.can_manage_office(uuid,text) from public,anon,authenticated;
grant execute on function public.can_manage_office(uuid,text) to authenticated;
create policy offices_read on public.offices for select to authenticated using(public.can_manage_office(id,'read'));
create policy offices_manage on public.offices for all to authenticated using(public.is_superadmin()) with check(public.is_superadmin());
create policy membership_read on public.user_office_access for select to authenticated using(user_id=(select auth.uid()) or public.is_superadmin());
create policy audit_read on public.audit_logs for select to authenticated using(public.is_superadmin());

-- Do not accept arbitrary user/office privileges through the old RPC.
drop function public.set_staff_access(uuid,text,boolean,text);
create function public.manage_staff(p_user_id uuid,p_role text,p_active boolean,p_display_name text,p_access jsonb,p_delete boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20260930,3);
 if not public.is_superadmin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('superadmin','admin','editor','viewer') or p_active is null or p_delete is null
 or p_display_name is null or length(trim(p_display_name)) not between 1 and 120 or jsonb_typeof(p_access) is distinct from 'array'
 then raise exception 'Invalid account settings' using errcode='22023'; end if;
 if p_user_id=auth.uid() and (p_role<>'superadmin' or not p_active or p_delete)
 then raise exception 'Cannot remove your own superadmin access' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_access) x where x->>'permission_level' is null or x->>'permission_level' not in ('viewer','editor','manager') or x->>'office_id' is null)
 then raise exception 'Invalid access level' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_access) x left join public.offices o on o.id=(x->>'office_id')::uuid where o.id is null)
 then raise exception 'Unknown office' using errcode='22023'; end if;
 update public.staff_accounts set display_name=trim(p_display_name),role=p_role,active=p_active and not p_delete,
 deleted_at=case when p_delete then coalesce(deleted_at,now()) else null end where user_id=p_user_id;
 if not found then raise exception 'Account not found' using errcode='22023'; end if;
 delete from public.user_office_access where user_id=p_user_id;
 if not p_delete then
 insert into public.user_office_access(user_id,office_id,permission_level)
 select p_user_id,(x->>'office_id')::uuid,x->>'permission_level' from jsonb_array_elements(p_access) x;
 end if;
end;
$$;
revoke all on function public.manage_staff(uuid,text,boolean,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.manage_staff(uuid,text,boolean,text,jsonb,boolean) to authenticated;

create function public.portal_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; actor uuid;
begin
 r=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 actor=auth.uid();
 if not exists(select 1 from public.staff_accounts where user_id=actor) then actor=null; end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,office_id,description)
 values(actor,lower(TG_OP),TG_TABLE_NAME,coalesce(r->>'id',r->>'slug',r->>'user_id'),(r->>'office_id')::uuid,
 case when TG_TABLE_NAME='user_office_access' then 'Office access '||lower(TG_OP)||': '||coalesce(r->>'permission_level','')
 when TG_TABLE_NAME='staff_accounts' then 'Account '||lower(TG_OP)||'; role='||(r->>'role')||'; active='||(r->>'active')
 else TG_TABLE_NAME||' '||lower(TG_OP) end);
 return coalesce(new,old);
end;
$$;
revoke all on function public.portal_audit() from public,anon,authenticated;
create trigger office_audit after insert or update or delete on public.offices for each row execute function public.portal_audit();
create trigger access_audit after insert or update or delete on public.user_office_access for each row execute function public.portal_audit();
create trigger staff_audit after insert or update on public.staff_accounts for each row execute function public.portal_audit();

create function public.audit_password_reset(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_superadmin() then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,description)
 values(auth.uid(),'password_reset','staff_accounts',p_user_id::text,'Administrator reset account password');
end;
$$;
revoke all on function public.audit_password_reset(uuid) from public,anon,authenticated;
grant execute on function public.audit_password_reset(uuid) to authenticated;

create function public.portal_content_ownership() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then new.created_by=auth.uid();
 else
  new.created_by=old.created_by;
  if new.office_id is distinct from old.office_id and not public.is_superadmin() then
   raise exception 'Only superadmins can transfer content between offices' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.portal_content_ownership() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['officials','ordinances','resolutions','news','sessions','services','departments','programs','committees','hearings','document_categories','municipal_documents'] loop
 execute format('alter table public.%I add column office_id uuid references public.offices(id) on delete restrict, add column created_by uuid references public.staff_accounts(user_id) on delete restrict',t);
 execute format('create index %I on public.%I(office_id)',t||'_office_idx',t);
 execute format('drop policy superadmin_manage on public.%I',t);
 execute format('create policy office_read on public.%I for select to authenticated using (public.can_manage_office(office_id,''read''))',t);
 execute format('create policy office_insert on public.%I for insert to authenticated with check (public.can_manage_office(office_id,''write''))',t);
 execute format('create policy office_update on public.%I for update to authenticated using (public.can_manage_office(office_id,''write'')) with check (public.can_manage_office(office_id,''write''))',t);
 execute format('create policy office_delete on public.%I for delete to authenticated using (public.can_manage_office(office_id,''delete''))',t);
 execute format('create trigger content_owner before insert or update on public.%I for each row execute function public.portal_content_ownership()',t);
 execute format('create trigger content_audit after insert or update or delete on public.%I for each row execute function public.portal_audit()',t);
 end loop;
end $$;

insert into public.offices(name,short_name,slug,department) values
('Mayor''s Office','MAYOR','mayors-office','executive'),
('Municipal Administrator''s Office','ADMIN','municipal-administrator','executive'),
('Municipal Planning and Development Office','MPDC','mpdc','executive'),
('Municipal Assessor''s Office','ASSESSOR','municipal-assessor','executive'),
('Municipal Treasurer''s Office','TREASURY','municipal-treasurer','executive'),
('Municipal Budget Office','BUDGET','municipal-budget','executive'),
('Municipal Accounting Office','ACCOUNTING','municipal-accounting','executive'),
('Municipal Engineering Office','ENGINEERING','municipal-engineering','executive'),
('Municipal Civil Registrar','MCR','municipal-civil-registrar','executive'),
('Municipal Social Welfare and Development Office','MSWDO','mswdo','executive'),
('Municipal Agriculture Office','AGRICULTURE','municipal-agriculture','executive'),
('Municipal Health Office / RHU','RHU','municipal-health','executive'),
('Municipal Disaster Risk Reduction and Management Office','MDRRMO','mdrrmo','executive'),
('Office of the Vice Mayor','VMO','vice-mayor','legislative'),
('Sangguniang Bayan','SB','sangguniang-bayan','legislative'),
('Office of the Secretary to the Sangguniang Bayan','SB SECRETARY','sb-secretary','legislative')
on conflict(slug) do nothing;
commit;
