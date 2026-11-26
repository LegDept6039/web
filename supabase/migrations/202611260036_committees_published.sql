begin;
-- Apply after 035. Every committee composition is published. Each Legislative
-- Term receives its own empty compositions from the editable Master Committee
-- catalog; officials are assigned separately within that term, never copied.
lock table public.legislative_terms,public.committees in access exclusive mode;
lock table public.departments,public.committee_master in share mode;

create temporary table portal_committee_publication_context (
 office_id uuid not null
) on commit drop;
create temporary table portal_committee_publication_before on commit drop as
 select id,to_jsonb(c) as original from public.committees c;

-- Resolve the single nonarchived Legislative workspace without hardcoded IDs.
-- Refuse ambiguous historical matches instead of adding a duplicate identity.
do $$
declare resolved_office uuid; matches integer; guard record;
begin
 select count(*),min(id::text)::uuid into matches,resolved_office
  from public.departments where department='legislative' and active and archived_at is null;
 if matches<>1 then raise exception 'Expected one active Legislative Access office before applying migration 036'; end if;
 insert into portal_committee_publication_context values(resolved_office);
 if not exists(select 1 from public.committee_master) then
  raise exception 'The Master Committee catalog is empty; review before applying migration 036';
 end if;
 for guard in select * from (values
  ('z_reorder','portal_reorder_content'),
  ('assign_legislative_term','portal_term_assignment'),
  ('committee_master_guard','portal_committee_master')
 ) expected(trigger_name,function_name) loop
  if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
   where t.tgrelid='public.committees'::regclass and t.tgname=guard.trigger_name
    and t.tgenabled='O' and p.proname=guard.function_name) then
   raise exception 'Unexpected committee ordering, term or master trigger state; review before applying migration 036';
  end if;
 end loop;
 if exists(select 1 from public.committees c join public.committee_master m on
  lower(regexp_replace(trim(c.name),'[[:space:]]+',' ','g'))=
  lower(regexp_replace(trim(m.name),'[[:space:]]+',' ','g'))
  where c.master_id is null and c.term_id is not null and c.content_scope='legislative') then
  raise exception 'An unlinked historical committee matches a Master Committee in an existing term. Link the existing composition before applying migration 036';
 end if;
 if exists(select 1 from public.committees c where c.master_id is not null and c.term_id is not null
  and (c.office_id is distinct from resolved_office or c.content_scope<>'legislative')) then
  raise exception 'An existing committee composition has different ownership; review before applying migration 036';
 end if;
end;
$$;

-- SQL Editor has no staff JWT. Publication-only changes must not force legacy
-- committees to acquire a term/master. Suspend only these three guards while
-- locked; ownership, references, audit/timestamps and position checks stay on.
alter table public.committees disable trigger z_reorder;
alter table public.committees disable trigger assign_legislative_term;
alter table public.committees disable trigger committee_master_guard;
with positions as (
 select c.id,coalesce((select max(p.sort_order) from public.committees p
   where p.published and public.portal_sort_scope('committees',to_jsonb(p))=
    public.portal_sort_scope('committees',to_jsonb(c))),0)
   +row_number() over(partition by public.portal_sort_scope('committees',to_jsonb(c))
    order by c.sort_order,c.created_at,c.id) as position
 from public.committees c where not c.published
)
update public.committees c set published=true,sort_order=p.position
 from positions p where c.id=p.id;
set constraints all immediate;
alter table public.committees enable trigger assign_legislative_term;
alter table public.committees enable trigger committee_master_guard;

-- Append only missing master/term pairs. Existing snapshots, compositions,
-- assignments, publication positions and all document references stay intact.
insert into public.committees(name,responsibility,chair,published,sort_order,
 office_id,content_scope,term_id,master_id)
select m.name,'','',true,
 (select coalesce(max(c.sort_order),0) from public.committees c
  where c.published and c.content_scope='legislative' and c.office_id=x.office_id)
  +row_number() over(order by t.start_date,t.id,m.sort_order,m.name,m.id),
 x.office_id,'legislative',t.id,m.id
from public.legislative_terms t cross join public.committee_master m
 cross join portal_committee_publication_context x
where not exists(select 1 from public.committees c where c.term_id=t.id and c.master_id=m.id);

do $$
begin
 if exists(select 1 from portal_committee_publication_before b
  left join public.committees c on c.id=b.id
  where c.id is null
   or (to_jsonb(c)-array['published','sort_order','updated_at'])<>
    (b.original-array['published','sort_order','updated_at'])
   or ((b.original->>'published')::boolean and to_jsonb(c)<>b.original)) then
  raise exception 'Committee publication preservation check failed; no changes committed';
 end if;
 if exists(select 1 from public.legislative_terms t cross join public.committee_master m
  cross join portal_committee_publication_context x
  where not exists(select 1 from public.committees c where c.term_id=t.id and c.master_id=m.id
   and c.office_id=x.office_id and c.content_scope='legislative' and c.published)) then
  raise exception 'Committee catalog coverage check failed; no changes committed';
 end if;
end;
$$;
set constraints all immediate;
alter table public.committees enable trigger z_reorder;
alter table public.committees alter column published set default true;
alter table public.committees add constraint committees_always_published check(published);

-- Trigger-only entry point: no authenticated RPC or user-controlled bypass.
-- Term and master INSERT retain their existing Superadmin RLS policies. A new
-- master also receives a composition in every existing term. Neither UPDATE
-- runs this trigger, so renaming/reordering cannot rewrite/reseed history.
create function public.portal_create_committee_compositions() returns trigger
language plpgsql security definer set search_path='' as $$
declare resolved_office uuid; scope_key text; last_position integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261116,19);
 select id into resolved_office from public.departments
  where department='legislative' and active and archived_at is null for share;
 if not found then raise exception 'An active Legislative Access office is required to create term committees' using errcode='23514'; end if;
 if not exists(select 1 from public.committee_master) then
  raise exception 'The Master Committee catalog is empty' using errcode='23514';
 end if;
 if exists(select 1 from public.committees c join public.committee_master m on
   lower(regexp_replace(trim(c.name),'[[:space:]]+',' ','g'))=
   lower(regexp_replace(trim(m.name),'[[:space:]]+',' ','g'))
   where c.master_id is null and c.term_id is not null and c.content_scope='legislative'
    and ((TG_TABLE_NAME='legislative_terms' and c.term_id=new.id)
     or (TG_TABLE_NAME='committee_master' and m.id=new.id))) then
  raise exception 'An unlinked historical committee matches this Master Committee and term. Link the existing composition first' using errcode='23514';
 end if;
 -- Acquire exactly the normal committee-ordering scope lock after the term
 -- advisory lock and before reading/appending positions. z_reorder purposely
 -- skips nested trigger writes; every other guard still runs.
 scope_key=public.portal_sort_scope('committees',jsonb_build_object('content_scope','legislative','office_id',resolved_office));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('committees:'||scope_key,0));
 select coalesce(max(sort_order),0) into last_position from public.committees
  where published and public.portal_sort_scope('committees',to_jsonb(committees))=scope_key;
 insert into public.committees(name,responsibility,chair,published,sort_order,
  office_id,content_scope,term_id,master_id)
 select m.name,'','',true,last_position+row_number() over(order by t.start_date,t.id,m.sort_order,m.name,m.id),
  resolved_office,'legislative',t.id,m.id
 from public.legislative_terms t cross join public.committee_master m
 where ((TG_TABLE_NAME='legislative_terms' and t.id=new.id)
   or (TG_TABLE_NAME='committee_master' and m.id=new.id))
  and not exists(select 1 from public.committees c where c.term_id=t.id and c.master_id=m.id);
 return new;
end;
$$;
revoke all on function public.portal_create_committee_compositions() from public,anon,authenticated;
create trigger create_term_committees after insert on public.legislative_terms
 for each row execute function public.portal_create_committee_compositions();
create trigger create_master_compositions after insert on public.committee_master
 for each row execute function public.portal_create_committee_compositions();
commit;
