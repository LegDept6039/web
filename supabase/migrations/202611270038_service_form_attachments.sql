begin;
-- Apply after 037. Existing service text, publication, ordering, owners,
-- memberships and media references are unchanged. Forms are optional PDFs.
alter table public.services add column form_path text, add column form_name text;
alter table public.services add constraint service_form_shape check (
 (form_path is null and form_name is null) or
 (form_path is not null and form_name is not null and office_id is not null
  and form_path ~ '^services/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
  and split_part(form_path,'/',2)=office_id::text
  and length(form_name) between 1 and 180 and form_name ~ '[^[:space:]]'
  and form_name !~ '[[:cntrl:]/\\]' and lower(form_name) like '%.pdf')
);

-- Remember every successfully attached version. Removing a download link or a
-- service must never turn its previously referenced PDF into cleanup material.
create table public.service_form_references (
 path text primary key,
 service_id text not null,
 office_id uuid not null,
 first_attached_at timestamptz not null default now()
);
alter table public.service_form_references enable row level security;
revoke all on public.service_form_references from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('municipal-service-forms','municipal-service-forms',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];

create function public.can_upload_service_form(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.departments d
  where d.id::text=split_part(p_name,'/',2) and d.active and d.archived_at is null
  and split_part(p_name,'/',3)=(select auth.uid())::text
  and p_name ~ '^services/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
  and public.can_manage_collection('services',d.department,d.id,'write'));
$$;
create function public.can_read_service_form(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.departments d
  where d.id::text=split_part(p_name,'/',2) and d.active and d.archived_at is null
  and p_name ~ '^services/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
  and public.can_manage_collection('services',d.department,d.id,'read'));
$$;
create function public.service_form_published(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.services s join public.departments d on d.id=s.office_id
  where s.form_path=p_name and s.published and d.published and d.active
   and d.archived_at is null and d.department=s.content_scope
   and (d.parent_department_id is null or public.public_department_visible(d.id)));
$$;
create function public.service_form_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.services where form_path=p_name)
  and not exists(select 1 from public.service_form_references where path=p_name);
$$;
revoke all on function public.can_upload_service_form(text),public.can_read_service_form(text),public.service_form_published(text),public.service_form_unreferenced(text) from public,anon,authenticated;
grant execute on function public.can_upload_service_form(text),public.can_read_service_form(text),public.service_form_unreferenced(text) to authenticated;
grant execute on function public.service_form_published(text) to anon,authenticated;

create function public.portal_service_form_reference() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.form_path is not null and (TG_OP='INSERT' or new.form_path is distinct from old.form_path) then
  if not public.can_upload_service_form(new.form_path) then
   raise exception 'Choose a form uploaded by your account for this department' using errcode='42501';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='municipal-service-forms' and name=new.form_path) then
   raise exception 'The service form upload is unavailable' using errcode='23514';
  end if;
  insert into public.service_form_references(path,service_id,office_id)
   values(new.form_path,new.id,new.office_id) on conflict(path) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.portal_service_form_reference() from public,anon,authenticated;
create trigger service_form_reference before insert or update on public.services
 for each row execute function public.portal_service_form_reference();

create policy service_form_staging_insert on storage.objects for insert to authenticated
 with check(bucket_id='municipal-document-staging' and public.can_upload_service_form(name));
create policy service_form_staging_read on storage.objects for select to authenticated
 using(bucket_id='municipal-document-staging' and public.can_upload_service_form(name));
create policy service_form_staging_delete on storage.objects for delete to authenticated
 using(bucket_id='municipal-document-staging' and public.can_upload_service_form(name));
create policy service_form_insert on storage.objects for insert to authenticated
 with check(bucket_id='municipal-service-forms' and public.can_upload_service_form(name));
create policy service_form_staff_read on storage.objects for select to authenticated
 using(bucket_id='municipal-service-forms' and public.can_read_service_form(name));
create policy service_form_public_read on storage.objects for select to anon,authenticated
 using(bucket_id='municipal-service-forms' and public.service_form_published(name));
create policy service_form_cleanup on storage.objects for delete to authenticated
 using(bucket_id='municipal-service-forms' and public.can_upload_service_form(name) and public.service_form_unreferenced(name));
commit;
