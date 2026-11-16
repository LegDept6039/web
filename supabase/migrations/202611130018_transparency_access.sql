-- Apply after 017. Assignments default to false; existing content and files are preserved.
begin;
alter table public.staff_accounts add column transparency_access boolean not null default false;
-- Only the existing Superadmin RPC can update accounts; clients retain SELECT-only grants.
drop function public.manage_staff(uuid,text,boolean,text,jsonb,boolean);
create function public.manage_staff(p_user_id uuid,p_role text,p_active boolean,p_display_name text,p_access jsonb,p_delete boolean default false,p_transparency_access boolean default null)
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
 transparency_access=case when p_delete then false else coalesce(p_transparency_access,transparency_access) end,
 deleted_at=case when p_delete then coalesce(deleted_at,now()) else null end where user_id=p_user_id;
 if not found then raise exception 'Account not found' using errcode='22023'; end if;
 delete from public.user_office_access where user_id=p_user_id;
 if not p_delete then
 insert into public.user_office_access(user_id,office_id,permission_level)
 select p_user_id,(x->>'office_id')::uuid,x->>'permission_level' from jsonb_array_elements(p_access) x;
 end if;
end;
$$;
revoke all on function public.manage_staff(uuid,text,boolean,text,jsonb,boolean,boolean) from public,anon,authenticated;
grant execute on function public.manage_staff(uuid,text,boolean,text,jsonb,boolean,boolean) to authenticated;


create function public.can_read_transparency() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_accounts where user_id=auth.uid() and active and deleted_at is null
 and (role='superadmin' or (transparency_access and role in ('admin','editor','viewer'))));
$$;
create or replace function public.can_manage_transparency() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_accounts where user_id=auth.uid() and active and deleted_at is null
 and (role='superadmin' or (transparency_access and role in ('admin','editor'))));
$$;
revoke all on function public.can_read_transparency(),public.can_manage_transparency() from public,anon,authenticated;
grant execute on function public.can_read_transparency(),public.can_manage_transparency() to authenticated;

-- Reuse existing collection RLS and ordering checks. Other office boundaries stay unchanged.
create or replace function public.can_manage_collection(p_table text,p_scope text,p_office uuid,p_operation text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or (
  p_scope='transparency' and p_office is null and p_table in ('document_categories','municipal_documents')
  and case when p_operation='read' then public.can_read_transparency()
           when p_operation in ('create','write','delete') then public.can_manage_transparency() else false end
 ) or (
  (p_scope='legislative' or (p_scope='executive' and p_table in ('departments','news','programs','department_contacts')))
  and not (p_table='departments' and p_operation in ('create','delete'))
  and public.can_manage_content(p_scope,p_office,case when p_operation='create' or (p_operation='delete' and p_scope='executive' and p_table in ('news','programs','department_contacts')) then 'write' else p_operation end));
$$;
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
   if not public.can_manage_transparency() then raise exception 'Transparency editing access required' using errcode='42501'; end if;
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


create or replace function public.can_upload_transparency_pdf(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_manage_transparency() and split_part(p_name,'/',2)=auth.uid()::text
 and p_name ~ '^transparency/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$';
$$;
drop policy transparency_pdf_admin_read on storage.objects;
create policy transparency_pdf_admin_read on storage.objects for select to authenticated
using(bucket_id='municipal-transparency' and public.can_read_transparency());

create function public.audit_transparency_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.transparency_access is distinct from old.transparency_access then
  insert into public.audit_logs(user_id,action,entity_type,entity_id,description)
  values(auth.uid(),'transparency_access','staff_accounts',new.user_id::text,
   case when new.transparency_access then 'Transparency access granted' else 'Transparency access revoked' end);
 end if;
 return new;
end $$;
revoke all on function public.audit_transparency_assignment() from public,anon,authenticated;
create trigger staff_transparency_audit after update on public.staff_accounts
for each row execute function public.audit_transparency_assignment();
commit;
