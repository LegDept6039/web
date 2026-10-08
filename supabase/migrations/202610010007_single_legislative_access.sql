begin;
-- Follow 001-006. Preserve public official roles, content, and files.
alter table public.offices add column archived_at timestamptz;
insert into public.offices(name,short_name,slug,department,description)
values('Legislative Access','Legislative Access','legislative-access','legislative','Access to all Legislative content');
-- The former Legislative model ignored office levels; preserve effective role limits.
insert into public.user_office_access(user_id,office_id,permission_level)
select distinct a.user_id,n.id,case s.role when 'admin' then 'manager' when 'superadmin' then 'manager' when 'editor' then 'editor' else 'viewer' end
from public.user_office_access a join public.offices o on o.id=a.office_id
join public.staff_accounts s on s.user_id=a.user_id cross join public.offices n
where o.department='legislative' and o.slug<>'legislative-access' and n.slug='legislative-access' and o.active
on conflict(user_id,office_id) do nothing;
create table public.legacy_legislative_office_access as
select a.* from public.user_office_access a join public.offices o on o.id=a.office_id
where o.department='legislative' and o.slug<>'legislative-access';
alter table public.legacy_legislative_office_access enable row level security;
revoke all on public.legacy_legislative_office_access from public,anon,authenticated;
delete from public.user_office_access a using public.offices o where a.office_id=o.id and o.department='legislative' and o.slug<>'legislative-access';
update public.offices set active=false,archived_at=now() where department='legislative' and slug<>'legislative-access';
create unique index one_legislative_access_office on public.offices(department) where department='legislative' and archived_at is null;
do $$ declare t text; op text; begin
 foreach t in array array['officials','ordinances','resolutions','news','sessions','services','departments','programs','committees','hearings','document_categories','municipal_documents'] loop
 execute format('alter table public.%I add column legacy_office_id uuid',t);
 execute format('alter table public.%I disable trigger content_owner',t);
 if t='committees' then
 execute 'alter table public.committees alter column content_scope set default ''legislative''';
 execute 'update public.committees set content_scope=''legislative'' where office_id is null';
 elsif t='news' then
 execute 'update public.news set content_scope=''legislative'' where office_id is null and lower(trim(category))=''legislative''';
 end if;
 execute format('update public.%I set legacy_office_id=office_id,office_id=(select id from public.offices where slug=''legislative-access'') where content_scope=''legislative''',t);
 execute format('alter table public.%I enable trigger content_owner',t);
 foreach op in array array['read','insert','update','delete'] loop execute format('drop policy module_%s on public.%I',op,t); end loop;
 end loop;
end $$;
create function public.can_manage_content(p_scope text,p_office uuid,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or exists(select 1 from public.offices o where o.id=p_office and o.department=p_scope and o.archived_at is null and public.can_manage_office(o.id,p_operation));
$$;
revoke all on function public.can_manage_content(text,uuid,text) from public,anon,authenticated;
grant execute on function public.can_manage_content(text,uuid,text) to authenticated;
do $$ declare t text; begin
 foreach t in array array['officials','ordinances','resolutions','news','sessions','services','departments','programs','committees','hearings','document_categories','municipal_documents'] loop
 execute format('create policy office_read on public.%I for select to authenticated using(public.can_manage_content(content_scope,office_id,''read''))',t);
 execute format('create policy office_insert on public.%I for insert to authenticated with check(public.can_manage_content(content_scope,office_id,''write''))',t);
 execute format('create policy office_update on public.%I for update to authenticated using(public.can_manage_content(content_scope,office_id,''write'')) with check(public.can_manage_content(content_scope,office_id,''write''))',t);
 execute format('create policy office_delete on public.%I for delete to authenticated using(public.can_manage_content(content_scope,office_id,''delete''))',t);
 end loop;
end $$;
create or replace function public.portal_content_ownership() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then new.created_by=auth.uid(); new.legacy_office_id=null;
 else new.created_by=old.created_by; new.legacy_office_id=old.legacy_office_id; end if;
 if new.content_scope='legislative' then
  new.office_id=(select id from public.offices where department='legislative' and archived_at is null);
  if new.office_id is null then raise exception 'Legislative Access office is unavailable'; end if;
 elsif new.office_id is not null and not exists(select 1 from public.offices where id=new.office_id and department=new.content_scope and archived_at is null) then
  raise exception 'Office does not belong to this branch' using errcode='42501';
 end if;
 if TG_OP='UPDATE' and (new.office_id is distinct from old.office_id or new.content_scope is distinct from old.content_scope) and not public.is_superadmin() then
  raise exception 'Only superadmins can transfer content scope' using errcode='42501';
 end if;
 return new;
end;
$$;
drop policy official_photo_insert on storage.objects;
drop policy official_photo_delete on storage.objects;
create policy official_photo_insert on storage.objects for insert to authenticated with check(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='officials' and (storage.foldername(name))[2]=(select auth.uid())::text
 and (public.is_superadmin() or exists(select 1 from public.offices o where o.archived_at is null and public.can_manage_office(o.id,'write'))));
create policy official_photo_delete on storage.objects for delete to authenticated using(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='officials' and (storage.foldername(name))[2]=(select auth.uid())::text
 and public.official_photo_unreferenced(name)
 and (public.is_superadmin() or exists(select 1 from public.offices o where o.archived_at is null and public.can_manage_office(o.id,'write'))));
drop function public.manage_staff(uuid,text,boolean,text,jsonb,boolean,jsonb);
alter function public.portal_manage_staff_base(uuid,text,boolean,text,jsonb,boolean) rename to manage_staff;
grant execute on function public.manage_staff(uuid,text,boolean,text,jsonb,boolean) to authenticated;
create function public.portal_validate_office_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.offices where id=new.office_id and archived_at is null) then raise exception 'Archived office cannot be assigned' using errcode='22023'; end if;
 return new;
end;
$$;
revoke all on function public.portal_validate_office_assignment() from public,anon,authenticated;
create trigger valid_office_assignment before insert or update on public.user_office_access for each row execute function public.portal_validate_office_assignment();
drop function public.can_manage_content(text,text,uuid,text);
drop function public.can_manage_module(text,text);
drop policy module_read on public.user_module_permissions;
drop trigger module_audit on public.user_module_permissions;
revoke all on public.user_module_permissions from public,anon,authenticated;
alter table public.user_module_permissions rename to legacy_user_module_permissions;
commit;
