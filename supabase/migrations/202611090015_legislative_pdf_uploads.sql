begin;
-- Reuse pdf_url/file_url on existing records. No content or existing files are changed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('municipal-document-staging','municipal-document-staging',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];

create function public.can_upload_legislative_pdf(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.departments d
 where d.id::text=split_part(p_name,'/',2) and d.department='legislative' and d.active and d.archived_at is null
 and split_part(p_name,'/',1)='legislative'
 and split_part(p_name,'/',3)=(select auth.uid())::text
 and split_part(p_name,'/',4) in ('ordinances','resolutions','documents')
 and p_name ~ '^legislative/[0-9a-f-]{36}/[0-9a-f-]{36}/(ordinances|resolutions|documents)/[0-9a-f-]{36}\.pdf$'
 and public.can_manage_collection(split_part(p_name,'/',4),'legislative',d.id,'write'));
$$;
revoke all on function public.can_upload_legislative_pdf(text) from public,anon;
grant execute on function public.can_upload_legislative_pdf(text) to authenticated;

create policy legislative_pdf_staging_insert on storage.objects for insert to authenticated
with check(bucket_id='municipal-document-staging' and public.can_upload_legislative_pdf(name));
create policy legislative_pdf_staging_read on storage.objects for select to authenticated
using(bucket_id='municipal-document-staging' and public.can_upload_legislative_pdf(name));
create policy legislative_pdf_staging_delete on storage.objects for delete to authenticated
using(bucket_id='municipal-document-staging' and public.can_upload_legislative_pdf(name));
create policy legislative_pdf_media_insert on storage.objects for insert to authenticated
with check(bucket_id='municipal-media' and public.can_upload_legislative_pdf(name));

-- Only newly uploaded, unreferenced files can be cleaned up after a failed save.
create function public.legislative_pdf_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.ordinances where pdf_url like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.resolutions where pdf_url like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.municipal_documents where file_url like '%/municipal-media/'||p_name);
$$;
revoke all on function public.legislative_pdf_unreferenced(text) from public,anon;
grant execute on function public.legislative_pdf_unreferenced(text) to authenticated;
create policy legislative_pdf_media_delete on storage.objects for delete to authenticated
using(bucket_id='municipal-media' and public.can_upload_legislative_pdf(name) and public.legislative_pdf_unreferenced(name));
commit;
