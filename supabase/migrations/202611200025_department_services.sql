begin;
-- Apply after 024. Extend the existing services collection without rewriting
-- historical IDs, descriptions, steps, ownership, publication or audit history.
alter table public.services
 add column body text,
 alter column id set default gen_random_uuid()::text;
alter table public.services add constraint service_body_shape
 check (body is null or (body ~ '[^[:space:]]' and length(body) <= 30000));
alter table public.services add constraint service_title_shape
 check (body is null or (name ~ '[^[:space:]]' and length(name) <= 300));

-- Existing office membership and role limits now cover department services.
-- Transparency and Legislative permissions retain their existing behavior.
create or replace function public.can_manage_collection(p_table text,p_scope text,p_office uuid,p_operation text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or (
  p_scope='transparency' and p_office is null and p_table in ('document_categories','municipal_documents')
  and case when p_operation='read' then public.can_read_transparency()
           when p_operation in ('create','write','delete') then public.can_manage_transparency() else false end
 ) or (
  (p_scope='legislative' or (p_scope='executive' and p_table in ('departments','news','programs','services','department_contacts')))
  and not (p_table='departments' and p_operation in ('create','delete'))
  and public.can_manage_content(p_scope,p_office,case when p_operation='create' or (p_operation='delete' and p_scope='executive' and p_table in ('news','programs','services','department_contacts')) then 'write' else p_operation end));
$$;

-- Newly created/edited services require an owner. Migration 022 allows untouched
-- unassigned legacy siblings to move when published positions are reordered.
create trigger require_owner before insert or update on public.services
 for each row execute function public.portal_require_department_owner();
create function public.portal_service_record() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.id is distinct from old.id then
   raise exception 'Record IDs cannot be changed' using errcode='42501';
  end if;
  if (to_jsonb(new)-array['sort_order','updated_at'])=(to_jsonb(old)-array['sort_order','updated_at']) then return new; end if;
 end if;
 if new.name !~ '[^[:space:]]' or length(new.name)>300 then
  raise exception 'Service title must contain 1 to 300 characters' using errcode='23514';
 end if;
 if new.body is null or new.body !~ '[^[:space:]]' or length(new.body)>30000 then
  raise exception 'Service body must contain 1 to 30000 characters' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.portal_service_record() from public,anon,authenticated;
create trigger service_record before insert or update on public.services
 for each row execute function public.portal_service_record();

-- Retain published legacy services without an assigned department. Owned services
-- are public only while both the service and its owning department are visible.
drop policy published_read on public.services;
create policy published_read on public.services for select to anon,authenticated
 using (published and (office_id is null or exists (
  select 1 from public.departments d where d.id=services.office_id
  and d.department=services.content_scope and d.active and d.published and d.archived_at is null
 )));
commit;
