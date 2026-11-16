begin;
-- Extend existing identities; legacy PDFs become annual attachments without moving bytes.
alter table public.document_categories add column deleted_at timestamptz;
alter table public.municipal_documents
 add column deleted_at timestamptz,
 add column report_frequency text,
 add column report_year integer,
 add column annual_pdf_path text,
 add column q1_pdf_path text,
 add column q2_pdf_path text,
 add column q3_pdf_path text,
 add column q4_pdf_path text;
alter table public.municipal_documents disable trigger user;
update public.municipal_documents set report_frequency='annual',report_year=extract(year from date)::integer,annual_pdf_path=attachment_path where content_scope='transparency';
alter table public.municipal_documents enable trigger user;
alter table public.municipal_documents add constraint transparency_report_shape check (
 content_scope<>'transparency' or (
 report_frequency is not null and report_frequency in ('annual','quarterly') and report_year is not null and report_year between 1900 and 9999
 and ((report_frequency='annual' and q1_pdf_path is null and q2_pdf_path is null and q3_pdf_path is null and q4_pdf_path is null)
 or (report_frequency='quarterly' and annual_pdf_path is null))
 and (not published or (deleted_at is null and coalesce(annual_pdf_path,q1_pdf_path,q2_pdf_path,q3_pdf_path,q4_pdf_path) is not null))
 ));
create index transparency_reports_module_year on public.municipal_documents(category_id,report_year desc) where content_scope='transparency' and deleted_at is null;

create function public.can_manage_transparency() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin();
$$;
revoke all on function public.can_manage_transparency() from public,anon;
grant execute on function public.can_manage_transparency() to authenticated;

create or replace function public.portal_transparency_record() returns trigger language plpgsql security definer set search_path='' as $$
declare category_scope text; category_deleted timestamptz; category_published boolean; p text;
begin
 if TG_OP='UPDATE' and old.content_scope='transparency' and new.content_scope<>'transparency' then raise exception 'Transparency records must stay in Transparency' using errcode='42501'; end if;
 if new.content_scope='transparency' then
  if not public.can_manage_transparency() then raise exception 'Transparency editing access required' using errcode='42501'; end if;
  if new.office_id is not null then raise exception 'Transparency is not department-owned' using errcode='23514'; end if;
  if TG_OP='UPDATE' and old.deleted_at is not null then raise exception 'Deleted records are retained for recovery' using errcode='23514'; end if;
  if new.deleted_at is not null and new.published then raise exception 'Deleted records cannot be published' using errcode='23514'; end if;
  if TG_TABLE_NAME='document_categories' then
   if not public.is_superadmin() then raise exception 'Only Superadmin manages modules' using errcode='42501'; end if;
   if new.href is not null then raise exception 'Modules use the shared public route' using errcode='23514'; end if;
   if new.deleted_at is not null and exists(select 1 from public.municipal_documents where category_id=new.id and deleted_at is null) then raise exception 'Move or delete reports before deleting this module' using errcode='23514'; end if;
  else
   -- Lock the module to serialize report creation and module deletion.
   select content_scope,published,deleted_at into category_scope,category_published,category_deleted from public.document_categories where id=new.category_id for share;
   if category_scope is distinct from 'transparency' or category_deleted is not null then raise exception 'Choose an active Transparency module' using errcode='23514'; end if;
   if new.document_type is not null or new.session_id is not null then raise exception 'Legislative relationships do not belong to Transparency' using errcode='23514'; end if;
   foreach p in array array[new.annual_pdf_path,new.q1_pdf_path,new.q2_pdf_path,new.q3_pdf_path,new.q4_pdf_path] loop
    if p is not null and p !~ '^transparency/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' then raise exception 'Invalid attachment reference' using errcode='23514'; end if;
   end loop;
   new.attachment_path=new.annual_pdf_path;
   if new.published and (new.file_url<>('/transparency/files/'||new.id)) then raise exception 'Invalid public file route' using errcode='23514'; end if;
   if new.published and not category_published then
    if TG_OP='INSERT' then raise exception 'Publish the module first' using errcode='23514';
    elsif not old.published or old.category_id is distinct from new.category_id then raise exception 'Publish the module first' using errcode='23514'; end if;
   end if;
  end if;
 elsif TG_TABLE_NAME='municipal_documents' then
  if coalesce(new.attachment_path,new.annual_pdf_path,new.q1_pdf_path,new.q2_pdf_path,new.q3_pdf_path,new.q4_pdf_path) is not null or exists(select 1 from public.document_categories where id=new.category_id and content_scope='transparency') then raise exception 'Transparency attachments require Transparency scope' using errcode='42501'; end if;
 end if;
 return new;
end $$;

-- Retain records and referenced files when the UI deletes reports/modules.
create function public.preserve_transparency_records() returns trigger language plpgsql set search_path='' as $$
begin
 if old.content_scope='transparency' then raise exception 'Use soft deletion for Transparency records' using errcode='23514'; end if;
 return old;
end $$;
revoke all on function public.preserve_transparency_records() from public,anon,authenticated;
create trigger transparency_preserve before delete on public.document_categories for each row execute function public.preserve_transparency_records();
create trigger transparency_preserve before delete on public.municipal_documents for each row execute function public.preserve_transparency_records();
drop policy published_read on public.document_categories;
create policy published_read on public.document_categories for select to anon,authenticated using(published and deleted_at is null);
drop policy published_read on public.municipal_documents;
create policy published_read on public.municipal_documents for select to anon,authenticated using(published and deleted_at is null and (content_scope<>'transparency' or exists(select 1 from public.document_categories c where c.id=category_id and c.published and c.deleted_at is null and c.content_scope='transparency')));
create or replace function public.transparency_pdf_published(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.municipal_documents d join public.document_categories c on c.id=d.category_id
 where d.content_scope='transparency' and c.content_scope='transparency' and d.published and c.published and d.deleted_at is null and c.deleted_at is null
 and p_name=any(array[d.annual_pdf_path,d.q1_pdf_path,d.q2_pdf_path,d.q3_pdf_path,d.q4_pdf_path]));
$$;
create or replace function public.transparency_pdf_unreferenced(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.municipal_documents where p_name=any(array[attachment_path,annual_pdf_path,q1_pdf_path,q2_pdf_path,q3_pdf_path,q4_pdf_path]));
$$;
commit;
