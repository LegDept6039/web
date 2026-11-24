begin;
-- Apply after 031. Add one access-only workspace through the existing Department
-- membership system. Preserve every existing identity, assignment and article.
lock table public.departments in access exclusive mode;

do $$
declare workspace public.departments%rowtype; matches integer;
begin
 select count(*) into matches from public.departments
  where slug='barangay-affairs' or lower(trim(name))='barangay affairs';
 if matches>1 then
  raise exception 'Ambiguous Barangay Affairs department; resolve the existing identities before applying migration 032';
 end if;
 select * into workspace from public.departments
  where slug='barangay-affairs' or lower(trim(name))='barangay affairs';
 if found then
  if workspace.slug<>'barangay-affairs' or workspace.name<>'Barangay Affairs'
   or workspace.short_name<>'Barangay Affairs' or workspace.department<>'executive'
   or workspace.published or workspace.sort_order<>0 or workspace.archived_at is not null then
   raise exception 'Conflicting Barangay Affairs department; migration 032 will not rename, reactivate or republish an existing department';
  end if;
  if exists(select 1 from public.news where office_id=workspace.id) then
   raise exception 'Existing Barangay Affairs news needs an explicit barangay mapping before applying migration 032';
  end if;
 end if;
 if exists(select 1 from public.department_slug_aliases a
  where a.slug='barangay-affairs' and (workspace.id is null or a.department_id<>workspace.id)) then
  raise exception 'The Barangay Affairs address is an existing department alias; resolve the conflict before applying migration 032';
 end if;
 if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid='public.departments'::regclass and t.tgname='z_reorder'
   and t.tgenabled='O' and p.proname='portal_reorder_content') then
  raise exception 'Unexpected department ordering trigger state; review before applying migration 032';
 end if;
end;
$$;

-- SQL Editor has no staff JWT. Only the authorization-bearing ordering trigger
-- is suspended, inside this lock/transaction, for the unpublished workspace.
alter table public.departments disable trigger z_reorder;
insert into public.departments(name,short_name,slug,department,description,published,sort_order)
 select 'Barangay Affairs','Barangay Affairs','barangay-affairs','executive',
  'Staff access to barangay profiles and barangay news.',false,0
 where not exists(select 1 from public.departments where slug='barangay-affairs');
set constraints all immediate;
alter table public.departments enable trigger z_reorder;

-- Identity lookup intentionally includes inactive records, so deactivation
-- cannot turn a protected workspace/article into an ordinary department/news.
create function public.is_barangay_affairs_office(p_office uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.departments where id=p_office
  and slug='barangay-affairs' and department='executive');
$$;
create function public.barangay_affairs_office_id() returns uuid
language sql stable security definer set search_path='' as $$
 select id from public.departments where slug='barangay-affairs'
  and department='executive' and active and archived_at is null;
$$;
create function public.can_manage_barangays(p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_operation in ('read','create','write') and (public.is_superadmin()
  or public.can_manage_office(public.barangay_affairs_office_id(),
   case when p_operation='create' then 'write' else p_operation end));
$$;
revoke all on function public.is_barangay_affairs_office(uuid),public.barangay_affairs_office_id(),public.can_manage_barangays(text)
 from public,anon,authenticated;
grant execute on function public.is_barangay_affairs_office(uuid),public.barangay_affairs_office_id(),public.can_manage_barangays(text)
 to authenticated;

create function public.portal_protect_barangay_affairs() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and old.slug='barangay-affairs' then
  if new.id is distinct from old.id or new.name is distinct from old.name
   or new.short_name is distinct from old.short_name or new.slug is distinct from old.slug
   or new.department is distinct from old.department or new.published or new.sort_order<>0 then
   raise exception 'Barangay Affairs is an access-only workspace; its identity and publication cannot be changed' using errcode='42501';
  end if;
 elsif new.slug='barangay-affairs' or lower(trim(new.name))='barangay affairs' then
  raise exception 'The Barangay Affairs identity is reserved for its existing access workspace' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function public.portal_protect_barangay_affairs() from public,anon,authenticated;
create trigger protect_barangay_affairs before insert or update on public.departments
 for each row execute function public.portal_protect_barangay_affairs();
drop policy department_editor_update on public.departments;
create policy department_editor_update on public.departments for update to authenticated
 using(not public.is_barangay_affairs_office(id) and public.can_manage_office(id,'write'))
 with check(not public.is_barangay_affairs_office(id) and public.can_manage_office(id,'write'));

-- The workspace grants only its news collection. Preserve ordinary Executive,
-- Legislative and Transparency behavior, including existing Superadmin access.
create or replace function public.can_manage_collection(p_table text,p_scope text,p_office uuid,p_operation text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or (
  p_scope='transparency' and p_office is null and p_table in ('document_categories','municipal_documents')
  and case when p_operation='read' then public.can_read_transparency()
           when p_operation in ('create','write','delete') then public.can_manage_transparency() else false end
 ) or (
  (not public.is_barangay_affairs_office(p_office) or (p_scope='executive' and p_table='news'))
  and (p_scope='legislative' or (p_scope='executive' and p_table in ('departments','news','programs','services','department_contacts')))
  and not (p_table='departments' and p_operation in ('create','delete'))
  and public.can_manage_content(p_scope,p_office,case when p_operation='create' or (p_operation='delete' and p_scope='executive' and p_table in ('news','programs','services','department_contacts')) then 'write' else p_operation end));
$$;

drop policy barangays_superadmin_read on public.barangays;
drop policy barangays_superadmin_insert on public.barangays;
drop policy barangays_superadmin_update on public.barangays;
create policy barangays_staff_read on public.barangays for select to authenticated
 using((select public.can_manage_barangays('read')));
create policy barangays_staff_insert on public.barangays for insert to authenticated
 with check((select public.can_manage_barangays('create')));
create policy barangays_staff_update on public.barangays for update to authenticated
 using((select public.can_manage_barangays('write'))) with check((select public.can_manage_barangays('write')));
-- Deletion stays ungranted. SK profile permissions remain Superadmin-only.
drop policy barangay_image_insert on storage.objects;
drop policy barangay_image_delete on storage.objects;
create policy barangay_image_insert on storage.objects for insert to authenticated with check(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='barangays'
 and (storage.foldername(name))[2]=(select auth.uid())::text and (select public.can_manage_barangays('write'))
);
create policy barangay_image_delete on storage.objects for delete to authenticated using(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='barangays'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and (select public.can_manage_barangays('write')) and public.barangay_image_unreferenced(name)
);

alter table public.news add column barangay_id uuid references public.barangays(id) on delete restrict;
create index news_barangay_public_order on public.news(barangay_id,date desc,id) where published;
create function public.portal_barangay_news_ownership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and (old.barangay_id is not null or new.barangay_id is not null
  or public.is_barangay_affairs_office(old.office_id) or public.is_barangay_affairs_office(new.office_id)) then
  if new.office_id is distinct from old.office_id or new.content_scope is distinct from old.content_scope
   or (new.barangay_id is null) is distinct from (old.barangay_id is null) then
   raise exception 'Barangay news cannot be transferred to or from an ordinary news workspace' using errcode='42501';
  end if;
 end if;
 if new.barangay_id is not null or public.is_barangay_affairs_office(new.office_id) then
  if new.barangay_id is null or new.content_scope<>'executive'
   or not public.is_barangay_affairs_office(new.office_id) then
   raise exception 'Barangay news requires a barangay and the Barangay Affairs workspace' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.portal_barangay_news_ownership() from public,anon,authenticated;
-- Run after content_owner so its branch normalization cannot bypass this check.
create trigger news_barangay_ownership before insert or update on public.news
 for each row execute function public.portal_barangay_news_ownership();

-- Security-definer lookup avoids recursive/privilege-dependent RLS on the
-- unpublished access workspace. It reveals only public visibility, not drafts.
create function public.barangay_news_visible(p_barangay uuid,p_office uuid,p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when p_barangay is null then not public.is_barangay_affairs_office(p_office)
  else p_scope='executive' and exists(select 1 from public.barangays b
   join public.departments d on d.id=p_office and d.slug='barangay-affairs' and d.department='executive'
   where b.id=p_barangay and b.published and d.active and d.archived_at is null) end;
$$;
revoke all on function public.barangay_news_visible(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.barangay_news_visible(uuid,uuid,text) to anon,authenticated;
drop policy published_read on public.news;
create policy published_read on public.news for select to anon,authenticated
 using(published and public.barangay_news_visible(barangay_id,office_id,content_scope));
-- Append the link without changing any existing view column names/order.
create or replace view public.published_news with (security_barrier=true) as
select n.slug,n.title,n.category,n.date,n.excerpt,n.image,n.content,n.is_sample,n.office_id,n.content_scope,n.published,n.sort_order,
 jsonb_build_object('name',case when n.barangay_id is not null then b.name else coalesce(d.name,'Municipal information portal') end,
  'slug',case when n.barangay_id is null and d.department='executive' and d.active and d.published and d.archived_at is null then d.slug else null end) as source,
 n.id,n.rich_body,n.barangay_id
from public.news n left join public.departments d on d.id=n.office_id
 left join public.barangays b on b.id=n.barangay_id
where n.published and public.barangay_news_visible(n.barangay_id,n.office_id,n.content_scope);

-- Add bounded paragraph indentation while retaining all existing node/mark,
-- depth, text, size and list restrictions. Legacy documents stay unchanged.
create or replace function public.portal_valid_rich_node(n jsonb, depth integer default 0) returns boolean language plpgsql immutable set search_path='' as $$
declare typ text; c jsonb; m jsonb; a jsonb; begin
 if depth>12 or jsonb_typeof(n)<>'object' then return false; end if;
 typ=n->>'type';
 if typ is null or typ not in ('doc','paragraph','bulletList','orderedList','listItem','text','hardBreak') then return false; end if;
 if exists(select 1 from jsonb_object_keys(n) k where k not in ('type','content','text','marks','attrs')) then return false; end if;
 a=n->'attrs';
 if a is not null and a<>'null'::jsonb then
  if jsonb_typeof(a)<>'object' then return false; end if;
  if typ='paragraph' then
   if exists(select 1 from jsonb_object_keys(a) k where k not in ('size','indent')) or coalesce(a->>'size','normal') not in ('small','normal','large') then return false; end if;
   if a ? 'indent' then
    if jsonb_typeof(a->'indent') is distinct from 'number' then return false; end if;
    if (a->>'indent')::numeric not between 0 and 6 or trunc((a->>'indent')::numeric)<>(a->>'indent')::numeric then return false; end if;
   end if;
  elsif typ='orderedList' then
   if exists(select 1 from jsonb_object_keys(a) k where k<>'start') or coalesce(a->>'start','1')<>'1' then return false; end if;
  else return false; end if;
 end if;
 if typ='text' then
  if jsonb_typeof(n->'text') is distinct from 'string' or length(n->>'text')>30000 or n ? 'content' then return false; end if;
 elsif n ? 'text' then return false; end if;
 if n ? 'marks' then
  if typ<>'text' or jsonb_typeof(n->'marks')<>'array' then return false; end if;
  for m in select value from jsonb_array_elements(n->'marks') loop
   if jsonb_typeof(m)<>'object' or m->>'type' not in ('bold','italic','underline') or m->>'type' is null or (m - 'type')<>'{}'::jsonb then return false; end if;
  end loop;
 end if;
 if n ? 'content' then
  if jsonb_typeof(n->'content')<>'array' or typ in ('text','hardBreak') then return false; end if;
  for c in select value from jsonb_array_elements(n->'content') loop
   if not public.portal_valid_rich_node(c,depth+1) then return false; end if;
   if (typ='doc' and c->>'type' not in ('paragraph','bulletList','orderedList')) or
      (typ='paragraph' and c->>'type' not in ('text','hardBreak')) or
      (typ in ('bulletList','orderedList') and c->>'type'<>'listItem') or
      (typ='listItem' and c->>'type' not in ('paragraph','bulletList','orderedList')) then return false; end if;
  end loop;
 end if;
 return true;
end $$;
commit;
