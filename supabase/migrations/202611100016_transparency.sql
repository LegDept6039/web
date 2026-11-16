begin;
-- Transparency is a publication area, not another department or staff role.
alter table public.document_categories drop constraint document_categories_content_scope_check;
alter table public.document_categories add constraint document_categories_content_scope_check check(content_scope in ('executive','legislative','transparency'));
alter table public.municipal_documents drop constraint municipal_documents_content_scope_check;
alter table public.municipal_documents add constraint municipal_documents_content_scope_check check(content_scope in ('executive','legislative','transparency'));
alter table public.document_categories alter column id set default gen_random_uuid()::text;
alter table public.municipal_documents add column attachment_path text;
create index municipal_documents_transparency_date on public.municipal_documents(date desc,id) where content_scope='transparency';

create function public.portal_transparency_record() returns trigger language plpgsql security definer set search_path='' as $$
declare category_scope text; category_published boolean;
begin
 if TG_OP='UPDATE' and old.content_scope='transparency' and new.content_scope<>'transparency' then
  raise exception 'Transparency records must stay in Transparency' using errcode='42501';
 end if;
 if new.content_scope='transparency' then
  if not public.is_superadmin() then raise exception 'Only Superadmin can manage Transparency' using errcode='42501'; end if;
  if new.office_id is not null then raise exception 'Transparency is not department-owned' using errcode='23514'; end if;
  if TG_TABLE_NAME='document_categories' then
   if new.href is not null then raise exception 'Transparency categories use their shared public route' using errcode='23514'; end if;
  else
   select content_scope,published into category_scope,category_published from public.document_categories where id=new.category_id;
   if category_scope is distinct from 'transparency' then raise exception 'Choose a Transparency category' using errcode='23514'; end if;
   if new.document_type is not null or new.session_id is not null then raise exception 'Legislative relationships do not belong to Transparency' using errcode='23514'; end if;
   if new.attachment_path is not null and new.attachment_path !~ '^transparency/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' then raise exception 'Invalid Transparency attachment' using errcode='23514'; end if;
   if new.published and (new.attachment_path is null or new.file_url<>('/transparency/files/'||new.id)) then
    raise exception 'Publishing requires a PDF and a published category' using errcode='23514';
   end if;
   if new.published and not category_published then
    if TG_OP='INSERT' then raise exception 'Publish the category first' using errcode='23514';
    elsif not old.published or old.category_id is distinct from new.category_id then raise exception 'Publish the category first' using errcode='23514'; end if;
   end if;
  end if;
 elsif TG_TABLE_NAME='municipal_documents' then
  if new.attachment_path is not null or exists(select 1 from public.document_categories where id=new.category_id and content_scope='transparency') then
   raise exception 'Transparency documents require Transparency scope' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.portal_transparency_record() from public,anon,authenticated;
create trigger transparency_record before insert or update on public.document_categories for each row execute function public.portal_transparency_record();
create trigger transparency_record before insert or update on public.municipal_documents for each row execute function public.portal_transparency_record();

-- Existing office policies already require Superadmin for a non-office scope.
-- Public document reads also honor category publication.
drop policy published_read on public.municipal_documents;
create policy published_read on public.municipal_documents for select to anon,authenticated using (
 published and (content_scope<>'transparency' or exists(select 1 from public.document_categories c where c.id=category_id and c.published and c.content_scope='transparency'))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('municipal-transparency','municipal-transparency',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
create function public.can_upload_transparency_pdf(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() and split_part(p_name,'/',2)=auth.uid()::text and p_name ~ '^transparency/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$';
$$;
create function public.transparency_pdf_published(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.municipal_documents d join public.document_categories c on c.id=d.category_id
 where d.content_scope='transparency' and c.content_scope='transparency' and d.published and c.published and d.attachment_path=p_name);
$$;
create function public.transparency_pdf_unreferenced(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.municipal_documents where attachment_path=p_name);
$$;
revoke all on function public.can_upload_transparency_pdf(text), public.transparency_pdf_published(text), public.transparency_pdf_unreferenced(text) from public,anon,authenticated;
grant execute on function public.can_upload_transparency_pdf(text),public.transparency_pdf_unreferenced(text) to authenticated;
grant execute on function public.transparency_pdf_published(text) to anon,authenticated;
create policy transparency_staging_insert on storage.objects for insert to authenticated with check(bucket_id='municipal-document-staging' and public.can_upload_transparency_pdf(name));
create policy transparency_staging_read on storage.objects for select to authenticated using(bucket_id='municipal-document-staging' and public.can_upload_transparency_pdf(name));
create policy transparency_staging_delete on storage.objects for delete to authenticated using(bucket_id='municipal-document-staging' and public.can_upload_transparency_pdf(name));
create policy transparency_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='municipal-transparency' and public.can_upload_transparency_pdf(name));
create policy transparency_pdf_admin_read on storage.objects for select to authenticated using(bucket_id='municipal-transparency' and public.is_superadmin());
create policy transparency_pdf_public_read on storage.objects for select to anon,authenticated using(bucket_id='municipal-transparency' and public.transparency_pdf_published(name));
create policy transparency_pdf_delete on storage.objects for delete to authenticated using(bucket_id='municipal-transparency' and public.can_upload_transparency_pdf(name) and public.transparency_pdf_unreferenced(name));

-- Initial editable categories only; no fabricated procurement records or reassigned legacy content.
alter table public.document_categories disable trigger user;
insert into public.document_categories(id,name,description,content_scope,office_id,is_sample,published,sort_order)
values(gen_random_uuid()::text,'Bidding documents','Invitations, bidding documents and related procurement notices.','transparency',null,false,true,1),
 (gen_random_uuid()::text,'Award notices','Published notices and documents relating to procurement awards.','transparency',null,false,true,2);
alter table public.document_categories enable trigger user;
commit;
