begin;
-- Consolidate identity and profile while preserving UUID foreign keys and old profile rows.
-- Fail transactionally on ambiguous legacy profiles; never silently discard a second head/body.
do $$ begin
 if exists(select office_id from public.departments where office_id is not null group by office_id having count(*)>1) then
  raise exception 'Multiple department profiles reference the same office. Review those profiles before applying migration 009.';
 end if;
end $$;
drop trigger create_department_profile on public.offices;
drop function public.portal_create_department_profile();
-- Unassigned legacy profiles become independent departments, without guessing ownership.
alter table public.departments disable trigger content_owner;
alter table public.departments disable trigger require_owner;
do $$ declare r record; v_id uuid; begin
 for r in select * from public.departments where office_id is null loop
  insert into public.offices(name,short_name,slug,department,description) values(r.name,'','import-'||gen_random_uuid(),r.content_scope,r.description) returning id into v_id;
  update public.departments set office_id=v_id where id=r.id;
 end loop;
end $$;
alter table public.departments enable trigger content_owner;
alter table public.departments enable trigger require_owner;
alter table public.offices
 add column body text not null default '',
 add column image_url text,
 add column head_name text,
 add column head_title text,
 add column head_photo text,
 add column head_description text not null default '',
 add column published boolean not null default true,
 add column is_sample boolean not null default false,
 add column sort_order integer not null default 0,
 add column legacy_profile_id text;
-- Keep former office slugs as redirects when profile and office slugs differed.
create table public.department_slug_aliases(slug text primary key,department_id uuid not null references public.offices(id) on delete restrict);
insert into public.department_slug_aliases select slug,id from public.offices;
-- Temporary unique slugs allow a safe simultaneous remapping of profile slugs.
update public.offices o set slug='migration-'||o.id where exists(select 1 from public.departments d where d.office_id=o.id);
update public.offices o set name=d.name,slug=d.slug,description=d.description,
 head_name=d.head_name,head_title=d.head_title,head_photo=d.head_photo,
 published=d.published,is_sample=d.is_sample,sort_order=d.sort_order,legacy_profile_id=d.id
from public.departments d where d.office_id=o.id;
drop view public.published_news;
alter table public.departments rename to legacy_department_profiles;
revoke all on public.legacy_department_profiles from public,anon,authenticated;
alter table public.offices rename to departments;
-- Compatibility columns keep existing content/admin contracts; these cannot be reassigned.
alter table public.departments add column office_id uuid generated always as(id) stored,
 add column content_scope text generated always as(department) stored;
create view public.offices with (security_invoker=true) as
 select id,name,short_name,slug,department,description,active,created_at,updated_at,archived_at from public.departments;
revoke all on public.offices from public,anon,authenticated;
grant select on public.offices to authenticated;
-- Existing membership/content FKs now point directly to departments (same table OID/UUIDs).
grant select on public.departments to anon;
create policy department_public on public.departments for select to anon,authenticated using(active and archived_at is null and published and department='executive');
create policy department_editor_update on public.departments for update to authenticated
 using(public.can_manage_office(id,'write')) with check(public.can_manage_office(id,'write'));
create function public.portal_protect_department() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Deactivate departments to preserve users and content' using errcode='42501'; end if;
 if not public.is_superadmin() and (new.id is distinct from old.id or new.department is distinct from old.department or new.active is distinct from old.active or new.archived_at is distinct from old.archived_at or new.legacy_profile_id is distinct from old.legacy_profile_id) then
  raise exception 'Only superadmins can change department access settings' using errcode='42501';
 end if;
 if new.department is distinct from old.department then raise exception 'Department branch cannot be changed after creation' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function public.portal_protect_department() from public,anon,authenticated;
create trigger protect_department before update or delete on public.departments for each row execute function public.portal_protect_department();
-- Remember old public slugs after edits. Active canonical slugs take precedence.
create function public.portal_remember_department_slug() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.slug is distinct from old.slug then insert into public.department_slug_aliases values(old.slug,old.id) on conflict(slug) do nothing; end if;
 return new;
end;
$$;
revoke all on function public.portal_remember_department_slug() from public,anon,authenticated;
create trigger remember_department_slug after update on public.departments for each row execute function public.portal_remember_department_slug();
alter table public.department_slug_aliases enable row level security;
grant select on public.department_slug_aliases to anon,authenticated;
create policy public_department_alias on public.department_slug_aliases for select to anon,authenticated using(exists(select 1 from public.departments d where d.id=department_id and d.active and d.published and d.archived_at is null and d.department='executive'));
-- Editors may delete their own department news/programs/contacts, but not the department.
create or replace function public.can_manage_collection(p_table text,p_scope text,p_office uuid,p_operation text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or (
  (p_scope='legislative' or (p_scope='executive' and p_table in ('departments','news','programs','department_contacts')))
  and not (p_table='departments' and p_operation in ('create','delete'))
  and public.can_manage_content(p_scope,p_office,case when p_operation='create' or (p_operation='delete' and p_scope='executive' and p_table in ('news','programs','department_contacts')) then 'write' else p_operation end));
$$;
create or replace function public.portal_validate_office_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.departments where id=new.office_id and active and archived_at is null) then raise exception 'Only active departments can be assigned' using errcode='22023'; end if;
 return new;
end;
$$;
create table public.department_contacts (
 id text primary key default gen_random_uuid()::text,
 office_id uuid not null references public.departments(id) on delete restrict,
 content_scope text not null default 'executive' check(content_scope in ('executive','legislative')),
 type text not null check(type in ('PHONE','LANDLINE','EMAIL','LOCATION')),
 value text not null check(length(trim(value)) between 1 and 1000),
 label text,sort_order integer not null default 0,published boolean not null default true,is_sample boolean not null default false,
 created_by uuid references public.staff_accounts(user_id) on delete restrict,legacy_office_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index department_contacts_owner on public.department_contacts(office_id,sort_order,id);
alter table public.department_contacts enable row level security;
revoke all on public.department_contacts from public,anon,authenticated;
grant select on public.department_contacts to anon;
grant select,insert,update,delete on public.department_contacts to authenticated;
create policy contacts_public on public.department_contacts for select to anon,authenticated using(published and exists(select 1 from public.departments d where d.id=department_contacts.office_id and d.active and d.published and d.archived_at is null));
create policy contacts_read on public.department_contacts for select to authenticated using(public.can_manage_collection('department_contacts',content_scope,office_id,'read'));
create policy contacts_insert on public.department_contacts for insert to authenticated with check(public.can_manage_collection('department_contacts',content_scope,office_id,'create'));
create policy contacts_update on public.department_contacts for update to authenticated using(public.can_manage_collection('department_contacts',content_scope,office_id,'write')) with check(public.can_manage_collection('department_contacts',content_scope,office_id,'write'));
create policy contacts_delete on public.department_contacts for delete to authenticated using(public.can_manage_collection('department_contacts',content_scope,office_id,'delete'));
create trigger content_owner before insert or update on public.department_contacts for each row execute function public.portal_content_ownership();
create trigger update_timestamp before update on public.department_contacts for each row execute function public.portal_touch_updated_at();
create trigger content_audit after insert or update or delete on public.department_contacts for each row execute function public.portal_audit();
create or replace function public.department_photo_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.departments where head_photo like '%/municipal-media/'||p_name or image_url like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.legacy_department_profiles where head_photo like '%/municipal-media/'||p_name);
$$;
create view public.published_news with (security_barrier=true) as
select n.slug,n.title,n.category,n.date,n.excerpt,n.image,n.content,n.is_sample,n.office_id,n.content_scope,n.published,n.sort_order,
 jsonb_build_object('name',coalesce(d.name,'Municipal information portal'),'slug',case when d.department='executive' and d.active and d.published and d.archived_at is null then d.slug else null end) as source
from public.news n left join public.departments d on d.id=n.office_id where n.published;
revoke all on public.published_news from public,anon,authenticated;
grant select on public.published_news to anon,authenticated;
commit;
