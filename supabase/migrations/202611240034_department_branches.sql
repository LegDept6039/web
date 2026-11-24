begin;
-- Apply after 033. Branch offices remain canonical departments with their own
-- UUID, content and explicit staff assignments. No membership is inherited.
lock table public.departments in access exclusive mode;
lock table public.department_slug_aliases in share mode;

do $$
begin
 if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid='public.departments'::regclass and t.tgname='z_reorder'
   and t.tgenabled='O' and p.proname='portal_reorder_content') then
  raise exception 'Unexpected department ordering trigger state; review before applying migration 034';
 end if;
end;
$$;

alter table public.departments
 add column parent_department_id uuid references public.departments(id) on delete restrict,
 add constraint departments_not_own_parent check(parent_department_id is null or parent_department_id<>id),
 add constraint departments_executive_branch check(parent_department_id is null or department='executive');
create index departments_parent on public.departments(parent_department_id,sort_order,id)
 where parent_department_id is not null;

create temporary table portal_department_branch_before on commit drop as
 select id,to_jsonb(d) as original from public.departments d;
create temporary table portal_department_branch_seed (
 sequence integer primary key,
 name text not null,
 slug text not null unique,
 parent_key text not null,
 parent_id uuid,
 existing_id uuid
) on commit drop;
insert into portal_department_branch_seed(sequence,name,slug,parent_key) values
 (1,'Market Affairs','market-affairs','treasury'),
 (2,'Slaughter House','slaughter-house','treasury'),
 (3,'Waterworks','waterworks','engineering');

-- Resolve stable existing identities without hardcoded hosted UUIDs. Alias and
-- acronym matches are considered together, so conflicting candidates abort.
do $$
declare seed record; resolved_parent uuid; resolved_existing uuid; matches integer; current_row public.departments%rowtype;
begin
 for seed in select * from portal_department_branch_seed order by sequence loop
  select count(*),min(d.id::text)::uuid into matches,resolved_parent
  from public.departments d
  where (seed.parent_key='treasury' and (
    lower(trim(d.short_name))='treasury' or d.slug='municipal-treasurer'
    or lower(trim(d.name))='municipal treasurer''s office'
    or exists(select 1 from public.department_slug_aliases a where a.department_id=d.id and a.slug='municipal-treasurer')))
   or (seed.parent_key='engineering' and (
    lower(trim(d.short_name))='engineering' or d.slug in ('engineering','municipal-engineering')
    or lower(trim(d.name))='municipal engineering office'
    or exists(select 1 from public.department_slug_aliases a where a.department_id=d.id and a.slug in ('engineering','municipal-engineering'))));
  if matches<>1 then
   raise exception 'Missing or ambiguous % parent department; resolve the existing identities before applying migration 034',seed.parent_key;
  end if;
  select * into current_row from public.departments where id=resolved_parent;
  if current_row.department<>'executive' or current_row.parent_department_id is not null
   or current_row.slug='barangay-affairs' or current_row.archived_at is not null then
   raise exception 'The % parent must be a nonarchived top-level Executive department',seed.parent_key;
  end if;
  select count(*),min(d.id::text)::uuid into matches,resolved_existing
   from public.departments d where d.slug=seed.slug or lower(trim(d.name))=lower(seed.name);
  if matches>1 then
   raise exception 'Ambiguous branch identity: %. Resolve duplicate name/slug matches before applying migration 034',seed.name;
  end if;
  if matches=1 then
   select * into current_row from public.departments where id=resolved_existing;
   if current_row.slug<>seed.slug or lower(trim(current_row.name))<>lower(seed.name)
    or current_row.department<>'executive' or current_row.slug='barangay-affairs'
    or current_row.archived_at is not null
    or (current_row.parent_department_id is not null and current_row.parent_department_id<>resolved_parent) then
    raise exception 'Conflicting existing branch identity: %. No existing profile will be renamed, reactivated or transferred',seed.name;
   end if;
  end if;
  if exists(select 1 from public.department_slug_aliases a
   where a.slug=seed.slug and a.department_id is distinct from resolved_existing) then
   raise exception 'The branch address % is an existing department alias; resolve the conflict before applying migration 034',seed.slug;
  end if;
  update portal_department_branch_seed s set parent_id=resolved_parent,existing_id=resolved_existing where s.sequence=seed.sequence;
 end loop;
end;
$$;

create function public.portal_validate_department_parent() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent public.departments%rowtype;
begin
 -- A hidden/archived parent must not prevent edits to an existing child page.
 -- Changing the relationship still requires a valid, nonarchived parent.
 if TG_OP='UPDATE' and new.parent_department_id is not distinct from old.parent_department_id then return new; end if;
 if new.parent_department_id is null then return new; end if;
 if new.parent_department_id=new.id or new.department<>'executive' or new.slug='barangay-affairs' then
  raise exception 'Only ordinary Executive departments may be branch offices' using errcode='23514';
 end if;
 -- Lock the parent row so concurrent nesting/reparenting either sees the
 -- committed relationship or aborts safely, rather than creating a cycle.
 select * into parent from public.departments where id=new.parent_department_id for update;
 if not found then raise exception 'Parent department not found' using errcode='23503'; end if;
 if parent.department<>'executive' or parent.parent_department_id is not null
  or parent.slug='barangay-affairs' or parent.archived_at is not null then
  raise exception 'Choose a nonarchived top-level Executive parent department' using errcode='23514';
 end if;
 if exists(select 1 from public.departments where parent_department_id=new.id) then
  raise exception 'A department with branch offices cannot become a branch office' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function public.portal_validate_department_parent() from public,anon,authenticated;
create trigger validate_department_parent before insert or update on public.departments
 for each row execute function public.portal_validate_department_parent();

-- SQL Editor has no staff JWT. Suspend only ordering authorization while the
-- table is locked. Existing identity, audit, timestamp and FK guards stay on.
-- The old identity trigger does not yet protect the newly introduced column;
-- install that protection after the explicit seed links, before releasing lock.
alter table public.departments disable trigger z_reorder;
update public.departments d set parent_department_id=s.parent_id
 from portal_department_branch_seed s
 where d.id=s.existing_id and d.parent_department_id is distinct from s.parent_id;
insert into public.departments(name,short_name,slug,department,description,body,image_url,
 parent_department_id,published,sort_order)
 select s.name,'',s.slug,'executive','','',null,s.parent_id,true,
  (select coalesce(max(d.sort_order),0) from public.departments d where d.department='executive' and d.published)
   +row_number() over(order by s.sequence)
 from portal_department_branch_seed s where s.existing_id is null;

-- Keep every previous field, publication state, order and identity intact.
-- Only intentional seed links and their timestamp may differ.
do $$
begin
 if exists(select 1 from portal_department_branch_before b
  left join public.departments d on d.id=b.id
  left join portal_department_branch_seed s on s.existing_id=b.id
  where d.id is null
   or (s.existing_id is null and to_jsonb(d)<>b.original)
   or (s.existing_id is not null and (
    d.parent_department_id is distinct from s.parent_id
    or (to_jsonb(d)-array['parent_department_id','updated_at'])<>(b.original-array['parent_department_id','updated_at'])))) then
  raise exception 'Branch seed preservation check failed; no changes committed';
 end if;
end;
$$;
set constraints all immediate;
alter table public.departments enable trigger z_reorder;

create or replace function public.portal_protect_department() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Deactivate departments to preserve users and content' using errcode='42501'; end if;
 if not public.is_superadmin() and (
   new.name is distinct from old.name
   or new.short_name is distinct from old.short_name
   or new.slug is distinct from old.slug
   or new.published is distinct from old.published
   or new.sort_order is distinct from old.sort_order
   or new.is_sample is distinct from old.is_sample
   or new.id is distinct from old.id
   or new.department is distinct from old.department
   or new.active is distinct from old.active
   or new.archived_at is distinct from old.archived_at
   or new.legacy_profile_id is distinct from old.legacy_profile_id
   or new.parent_department_id is distinct from old.parent_department_id
 ) then
  raise exception 'Only superadmins can change department identity and access settings' using errcode='42501';
 end if;
 if new.department is distinct from old.department then raise exception 'Department branch cannot be changed after creation' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function public.portal_protect_department() from public,anon,authenticated;

-- This reveals only public visibility. Security-definer lookup avoids recursive
-- department RLS and staff membership never makes a hidden parent public.
create function public.public_department_visible(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.departments d
  left join public.departments p on p.id=d.parent_department_id
  where d.id=p_id and d.department='executive' and d.slug<>'barangay-affairs'
   and d.active and d.published and d.archived_at is null
   and (d.parent_department_id is null or (
    p.department='executive' and p.parent_department_id is null and p.slug<>'barangay-affairs'
    and p.active and p.published and p.archived_at is null)));
$$;
revoke all on function public.public_department_visible(uuid) from public,anon,authenticated;
grant execute on function public.public_department_visible(uuid) to anon,authenticated;
drop policy department_public on public.departments;
create policy department_public on public.departments for select to anon,authenticated
 using(public.public_department_visible(id));
drop policy public_department_alias on public.department_slug_aliases;
create policy public_department_alias on public.department_slug_aliases for select to anon,authenticated
 using(public.public_department_visible(department_id));
drop policy contacts_public on public.department_contacts;
create policy contacts_public on public.department_contacts for select to anon,authenticated
 using(published and exists(select 1 from public.departments d
  where d.id=department_contacts.office_id and d.active and d.published and d.archived_at is null
   and (d.parent_department_id is null or public.public_department_visible(d.id))));

-- General published news/program visibility stays unchanged. Their source link
-- must not point to a branch page hidden by its parent's current public state.
create or replace view public.published_news with (security_barrier=true) as
select n.slug,n.title,n.category,n.date,n.excerpt,n.image,n.content,n.is_sample,n.office_id,n.content_scope,n.published,n.sort_order,
 jsonb_build_object('name',case when n.barangay_id is not null then b.name else coalesce(d.name,'Municipal information portal') end,
  'slug',case when n.barangay_id is null and public.public_department_visible(d.id) then d.slug else null end) as source,
 n.id,n.rich_body,n.barangay_id
from public.news n left join public.departments d on d.id=n.office_id
 left join public.barangays b on b.id=n.barangay_id
where n.published and public.barangay_news_visible(n.barangay_id,n.office_id,n.content_scope);
create or replace view public.published_programs with (security_barrier=true) as
select p.id,p.slug,p.name,p.description,p.category,p.status,p.image,p.is_sample,p.office_id,p.content_scope,p.published,p.sort_order,
 jsonb_build_object('name',coalesce(d.name,'Municipal information portal'),
  'slug',case when public.public_department_visible(d.id) then d.slug else null end) as source,p.rich_body
from public.programs p left join public.departments d on d.id=p.office_id where p.published;
commit;
