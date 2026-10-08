begin;
create type public.legislative_official_role as enum ('SANGGUNIANG_BAYAN','SECRETARY_TO_THE_SANGGUNIANG_BAYAN','MUNICIPAL_VICE_MAYOR');
alter table public.officials add column legislative_role public.legislative_official_role;
alter table public.officials alter column id set default gen_random_uuid()::text;
-- Keep legacy role text, IDs, office attribution, and creator history unchanged.
update public.officials set legislative_role=(case
 when concat_ws(' ',id,name,role) ~* '(vice.?mayor|presiding officer)' then 'MUNICIPAL_VICE_MAYOR'
 when concat_ws(' ',id,name,role) ~* '(secretary|secretariat)' then 'SECRETARY_TO_THE_SANGGUNIANG_BAYAN'
 else 'SANGGUNIANG_BAYAN' end)::public.legislative_official_role where branch='legislative';
create table public.user_module_permissions (
 user_id uuid not null references public.staff_accounts(user_id) on delete cascade,
 module text not null check(module in ('officials','ordinances','resolutions','news','sessions','committeeHearings','documentCategories','documents','departments')),
 enabled boolean not null default false, primary key(user_id,module)
);
alter table public.user_module_permissions enable row level security;
revoke all on public.user_module_permissions from public,anon,authenticated;
grant select on public.user_module_permissions to authenticated;
create policy module_read on public.user_module_permissions for select to authenticated using(user_id=(select auth.uid()) or public.is_superadmin());
insert into public.user_module_permissions(user_id,module,enabled)
select distinct a.user_id,m,true from public.user_office_access a join public.offices o on o.id=a.office_id
cross join unnest(array['officials','ordinances','resolutions','news','sessions','committeeHearings','documentCategories','documents','departments']) m
where o.department='legislative';
create trigger module_audit after insert or update or delete on public.user_module_permissions for each row execute function public.portal_audit();

create function public.can_manage_module(p_module text,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_operation in ('read','write','delete') and (public.is_superadmin() or exists(
 select 1 from public.staff_accounts s join public.user_module_permissions p on p.user_id=s.user_id
 where s.user_id=(select auth.uid()) and s.active and s.deleted_at is null and p.module=p_module and p.enabled
 and exists(select 1 from public.user_office_access a join public.offices o on o.id=a.office_id where a.user_id=s.user_id and o.active and o.department='legislative')
 and (p_operation='read' or (p_operation='write' and s.role in ('editor','admin')) or (p_operation='delete' and s.role='admin'))));
$$;
revoke all on function public.can_manage_module(text,text) from public,anon,authenticated;
grant execute on function public.can_manage_module(text,text) to authenticated;
create function public.can_manage_content(p_module text,p_scope text,p_office uuid,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or case when p_scope='legislative' then public.can_manage_module(p_module,p_operation)
 when p_scope='executive' then exists(select 1 from public.offices where id=p_office and department='executive') and public.can_manage_office(p_office,p_operation) else false end;
$$;
revoke all on function public.can_manage_content(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.can_manage_content(text,text,uuid,text) to authenticated;

-- Scope is shared across Legislative offices; office_id now only attributes legacy rows.
do $$ declare t text; m text; op text; begin
 foreach t in array array['officials','ordinances','resolutions','news','sessions','services','departments','programs','committees','hearings','document_categories','municipal_documents'] loop
 execute format('alter table public.%I add column content_scope text not null default ''executive'' check(content_scope in (''executive'',''legislative''))',t);
 execute format('update public.%I t set content_scope=''legislative'' where exists(select 1 from public.offices o where o.id=t.office_id and o.department=''legislative'')',t);
 if t in ('ordinances','resolutions','sessions','hearings') then execute format('alter table public.%I alter column content_scope set default ''legislative''',t); execute format('update public.%I set content_scope=''legislative'' where office_id is null',t); end if;
 m=case t when 'hearings' then 'committeeHearings' when 'document_categories' then 'documentCategories' when 'municipal_documents' then 'documents' else t end;
 foreach op in array array['read','insert','update','delete'] loop execute format('drop policy office_%s on public.%I',op,t); end loop;
 execute format('create policy module_read on public.%I for select to authenticated using(public.can_manage_content(%L,content_scope,office_id,''read''))',t,m);
 execute format('create policy module_insert on public.%I for insert to authenticated with check(public.can_manage_content(%L,content_scope,office_id,''write''))',t,m);
 execute format('create policy module_update on public.%I for update to authenticated using(public.can_manage_content(%L,content_scope,office_id,''write'')) with check(public.can_manage_content(%L,content_scope,office_id,''write''))',t,m,m);
 execute format('create policy module_delete on public.%I for delete to authenticated using(public.can_manage_content(%L,content_scope,office_id,''delete''))',t,m);
 execute format('create index %I on public.%I(content_scope,sort_order)',t||'_scope_idx',t);
 end loop;
end $$;
update public.officials set content_scope=case when legislative_role is not null then 'legislative' else 'executive' end;
alter table public.officials add constraint official_role_scope check((content_scope='legislative' and legislative_role is not null and branch='legislative') or (content_scope='executive' and legislative_role is null and branch='executive'));
create or replace function public.portal_content_ownership() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then new.created_by=auth.uid();
 else
  new.created_by=old.created_by;
  if (new.office_id is distinct from old.office_id or new.content_scope is distinct from old.content_scope) and not public.is_superadmin() then
   raise exception 'Only superadmins can transfer content scope' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;
-- Reuse the existing atomic staff update and self-protection; keep its implementation private.
alter function public.manage_staff(uuid,text,boolean,text,jsonb,boolean) rename to portal_manage_staff_base;
revoke all on function public.portal_manage_staff_base(uuid,text,boolean,text,jsonb,boolean) from public,anon,authenticated;
create function public.manage_staff(p_user_id uuid,p_role text,p_active boolean,p_display_name text,p_access jsonb,p_delete boolean default false,p_modules jsonb default null)
returns void language plpgsql security definer set search_path='' as $$
declare m text;
begin
 perform public.portal_manage_staff_base(p_user_id,p_role,p_active,p_display_name,p_access,p_delete);
 if p_modules is not null then
  if jsonb_typeof(p_modules) <> 'object' or exists(select 1 from jsonb_each(p_modules) e where e.key not in ('officials','ordinances','resolutions','news','sessions','committeeHearings','documentCategories','documents','departments') or jsonb_typeof(e.value)<>'boolean') then
   raise exception 'Invalid module permissions' using errcode='22023';
  end if;
 end if;
 foreach m in array array['officials','ordinances','resolutions','news','sessions','committeeHearings','documentCategories','documents','departments'] loop
 if p_modules is not null then
 insert into public.user_module_permissions values(p_user_id,m,coalesce((p_modules->>m)::boolean,false)) on conflict(user_id,module) do update set enabled=excluded.enabled;
 elsif exists(select 1 from public.user_office_access a join public.offices o on o.id=a.office_id where a.user_id=p_user_id and o.department='legislative') then
 insert into public.user_module_permissions values(p_user_id,m,true) on conflict do nothing;
 end if;
 end loop;
end;
$$;
revoke all on function public.manage_staff(uuid,text,boolean,text,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.manage_staff(uuid,text,boolean,text,jsonb,boolean,jsonb) to authenticated;
commit;
