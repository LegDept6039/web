begin;
-- Apply after 001-007. Retain all existing content, memberships and uploaded files.
alter table public.departments
 add column slug text,
 add column head_name text,
 add column head_title text,
 add column head_photo text;
update public.departments set slug=id;
alter table public.departments alter column slug set not null;
alter table public.departments add constraint departments_slug_unique unique(slug);
alter table public.departments add constraint departments_slug_format check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

create function public.portal_department_slug() returns trigger language plpgsql set search_path='' as $$
begin new.slug=coalesce(nullif(new.slug,''),new.id); return new; end;
$$;
revoke all on function public.portal_department_slug() from public,anon,authenticated;
create trigger department_slug before insert on public.departments for each row execute function public.portal_department_slug();
-- Link the original seeded directory by its known IDs, never by ambiguous name matching.
alter table public.departments disable trigger content_owner;
update public.departments d set office_id=o.id
from (values ('administration','municipal-administrator'),('planning','mpdc'),
 ('budget','municipal-budget'),('health','municipal-health'),
 ('engineering','municipal-engineering'),('social-welfare','mswdo')) as m(id,slug)
join public.offices o on o.slug=m.slug and o.department='executive'
where d.id=m.id and d.office_id is null and d.content_scope='executive';
alter table public.departments enable trigger content_owner;
-- Offices without a profile receive an unpublished profile ready for their administrators.
insert into public.departments(id,slug,name,description,office_id,content_scope,published,is_sample)
select 'office-'||o.id, o.slug, o.name, o.description, o.id,'executive',false,false
from public.offices o where o.department='executive' and o.archived_at is null
and not exists(select 1 from public.departments d where d.office_id=o.id)
and not exists(select 1 from public.departments d where d.slug=o.slug);

create function public.portal_create_department_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.department='executive' and new.archived_at is null then
  insert into public.departments(id,slug,name,description,office_id,content_scope,published,is_sample)
  values('office-'||new.id,new.slug,new.name,new.description,new.id,'executive',false,false);
 end if;
 return new;
end;
$$;
revoke all on function public.portal_create_department_profile() from public,anon,authenticated;
create trigger create_department_profile after insert on public.offices for each row execute function public.portal_create_department_profile();
-- Collection availability is a property of the branch, not per-user module permissions.
create function public.can_manage_collection(p_table text,p_scope text,p_office uuid,p_operation text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or (
  (p_scope='legislative' or (p_scope='executive' and p_table in ('departments','news','programs')))
  and not (p_table='departments' and p_operation in ('create','delete'))
  and public.can_manage_content(p_scope,p_office,case when p_operation='create' then 'write' else p_operation end));
$$;
revoke all on function public.can_manage_collection(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.can_manage_collection(text,text,uuid,text) to authenticated;
do $$ declare t text; op text; begin
 foreach t in array array['officials','ordinances','resolutions','news','sessions','services','departments','programs','committees','hearings','document_categories','municipal_documents'] loop
 foreach op in array array['read','insert','update','delete'] loop execute format('drop policy office_%s on public.%I',op,t); end loop;
 execute format('create policy office_read on public.%I for select to authenticated using(public.can_manage_collection(%L,content_scope,office_id,''read''))',t,t);
 execute format('create policy office_insert on public.%I for insert to authenticated with check(public.can_manage_collection(%L,content_scope,office_id,''create''))',t,t);
 execute format('create policy office_update on public.%I for update to authenticated using(public.can_manage_collection(%L,content_scope,office_id,''write'')) with check(public.can_manage_collection(%L,content_scope,office_id,''write''))',t,t,t);
 execute format('create policy office_delete on public.%I for delete to authenticated using(public.can_manage_collection(%L,content_scope,office_id,''delete''))',t,t);
 end loop;
end $$;
-- Require ownership on new/edited news, programs and profiles; untouched legacy rows survive.
create function public.portal_require_department_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.office_id is null then raise exception 'An owning office is required' using errcode='23514'; end if;
 return new;
end;
$$;
revoke all on function public.portal_require_department_owner() from public,anon,authenticated;
create trigger require_owner before insert or update on public.news for each row execute function public.portal_require_department_owner();
create trigger require_owner before insert or update on public.programs for each row execute function public.portal_require_department_owner();
create trigger require_owner before insert or update on public.departments for each row execute function public.portal_require_department_owner();

create function public.department_photo_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.departments where head_photo like '%/municipal-media/'||p_name);
$$;
revoke all on function public.department_photo_unreferenced(text) from public,anon,authenticated;
grant execute on function public.department_photo_unreferenced(text) to authenticated;
create policy department_photo_insert on storage.objects for insert to authenticated with check(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='departments'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and (public.is_superadmin() or exists(select 1 from public.offices o where o.department='executive' and o.archived_at is null and public.can_manage_office(o.id,'write'))));
create policy department_photo_delete on storage.objects for delete to authenticated using(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='departments'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and public.department_photo_unreferenced(name)
 and (public.is_superadmin() or exists(select 1 from public.offices o where o.department='executive' and o.archived_at is null and public.can_manage_office(o.id,'write'))));
-- Public projection exposes published articles and safe source labels only.
create view public.published_news with (security_barrier=true) as
select n.slug,n.title,n.category,n.date,n.excerpt,n.image,n.content,n.is_sample,n.office_id,n.content_scope,n.published,n.sort_order, jsonb_build_object('name',coalesce(d.name,o.name,case when n.content_scope='legislative' then 'Legislative Access' else 'Municipal information portal' end),
 'slug',case when n.content_scope='executive' then d.slug else null end) as source
from public.news n left join public.offices o on o.id=n.office_id
left join lateral (select name,slug from public.departments where office_id=n.office_id and published and content_scope='executive' order by sort_order,id limit 1) d on true
where n.published;
revoke all on public.published_news from public,anon,authenticated;
grant select on public.published_news to anon,authenticated;
commit;
