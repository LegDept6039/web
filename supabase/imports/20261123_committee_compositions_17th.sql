-- One-time content import requested on 2026-11-23. Run in Supabase SQL Editor.
-- Targets only the 17th term (2025-07-01 to 2028-06-30).
-- 25 committees: chairman, vice-chairman and three members each.
-- Reuses registered officials and master committees. Julius Erwin T. Alpas in
-- the supplied list is the existing Hon. Julius Erwin Alpas record; Hon. Atty.
-- Marvin M. Miralles is the existing Hon. Marvin M. Miralles record.
-- Existing committee IDs, historical names, descriptions, publication, order,
-- authorship and document references are retained. New compositions are published.
-- Safe to rerun: missing compositions are inserted and matching roles are skipped.
-- No schema migration, new officials, staff accounts or permission changes.
begin;

-- The ordering trigger requires an application staff session. SQL Editor is a
-- database-admin session, so suspend ONLY that trigger while holding this lock.
-- All FK, term, master, audit, timestamp and position constraints remain active.
-- PostgreSQL restores the trigger state on rollback if any check below fails.
lock table public.committees in access exclusive mode;
lock table public.officials,public.committee_master,public.legislative_terms,public.departments in share mode;

create temporary table portal_committee_import_context (
 term_id uuid not null,
 office_id uuid not null
) on commit drop;
create temporary table portal_committee_roster (
 sequence integer primary key,
 name text not null,
 chair_name text not null,
 vice_name text not null,
 member_1_name text not null,
 member_2_name text not null,
 member_3_name text not null,
 master_id uuid,
 chair_id text,
 vice_chair_id text,
 member_1_id text,
 member_2_id text,
 member_3_id text
) on commit drop;
insert into portal_committee_roster(sequence,name,chair_name,vice_name,member_1_name,member_2_name,member_3_name) values
 (1,'Committee on Finance, Budget and Appropriation','Hon. Marvin M. Miralles','Hon. Julius Erwin Alpas','Hon. Annette J. Navarro','Hon. Joey D. Indino','Hon. Marmie Jeanne B. Albillar'),
 (2,'Committee on Women and Family Concerns, Social Services, Marginalized Sectors','Hon. Julius Erwin Alpas','Hon. Maria Elena C. Limocon','Hon. Annette J. Navarro','Hon. Lorenzo P. Niñal','Hon. Joey D. Indino'),
 (3,'Committee on Youth and Sports Development','Hon. Marmie Jeanne B. Albillar','Hon. Marvin M. Miralles','Hon. Annette J. Navarro','Hon. Lorenzo P. Niñal','Hon. Jesus M. Managaytay'),
 (4,'Committee on Environmental Protection','Hon. Lorenzo P. Niñal','Hon. Jose A. Alqueza','Hon. Julius Erwin Alpas','Hon. Maria Elena C. Limocon','Hon. Annette J. Navarro'),
 (5,'Committee on Cooperatives, Peoples Organization, Associations and Non-Government Organizations','Hon. Maria Elena C. Limocon','Hon. Julius Erwin Alpas','Hon. Marvin M. Miralles','Hon. Jesus M. Managaytay','Hon. Jose A. Alqueza'),
 (6,'Committee on Rules and Privileges','Hon. Marvin M. Miralles','Hon. Richard M. Canillo','Hon. Jesus M. Managaytay','Hon. Julius Erwin Alpas','Hon. Joey D. Indino'),
 (7,'Committee on Ordinances and Legal Matters','Hon. Marvin M. Miralles','Hon. Lorenzo P. Niñal','Hon. Julius Erwin Alpas','Hon. Richard M. Canillo','Hon. Annette J. Navarro'),
 (8,'Committee on Peace and Order and Public Safety','Hon. Jesus M. Managaytay','Hon. Joey D. Indino','Hon. Annette J. Navarro','Hon. Jose A. Alqueza','Hon. Richard M. Canillo'),
 (9,'Committee on Health and Sanitation','Hon. Maria Elena C. Limocon','Hon. Joey D. Indino','Hon. Annette J. Navarro','Hon. Marmie Jeanne B. Albillar','Hon. Jesus M. Managaytay'),
 (10,'Committee on Agriculture','Hon. Jose A. Alqueza','Hon. Maria Elena C. Limocon','Hon. Julius Erwin Alpas','Hon. Lorenzo P. Niñal','Hon. Joey D. Indino'),
 (11,'Committee on Education','Hon. Lorenzo P. Niñal','Hon. Julius Erwin Alpas','Hon. Maria Elena C. Limocon','Hon. Annette J. Navarro','Hon. Marmie Jeanne B. Albillar'),
 (12,'Committee on Ways and Means, Public Facilities','Hon. Julius Erwin Alpas','Hon. Jesus M. Managaytay','Hon. Richard M. Canillo','Hon. Joey D. Indino','Hon. Marvin M. Miralles'),
 (13,'Committee on Games and Amusements','Hon. Jose A. Alqueza','Hon. Marvin M. Miralles','Hon. Richard M. Canillo','Hon. Joey D. Indino','Hon. Annette J. Navarro'),
 (14,'Committee on Infrastructure and Public Works','Hon. Richard M. Canillo','Hon. Marvin M. Miralles','Hon. Jesus M. Managaytay','Hon. Maria Elena C. Limocon','Hon. Marmie Jeanne B. Albillar'),
 (15,'Committee on Zoning and Land Use','Hon. Annette J. Navarro','Hon. Julius Erwin Alpas','Hon. Marvin M. Miralles','Hon. Jose A. Alqueza','Hon. Lorenzo P. Niñal'),
 (16,'Committee on Tourism and Heritage/Culture and the Arts','Hon. Annette J. Navarro','Hon. Lorenzo P. Niñal','Hon. Richard M. Canillo','Hon. Maria Elena C. Limocon','Hon. Marmie Jeanne B. Albillar'),
 (17,'Committee on Trade, Commerce and Industry, Transportation and Communication','Hon. Joey D. Indino','Hon. Marvin M. Miralles','Hon. Maria Elena C. Limocon','Hon. Jesus M. Managaytay','Hon. Julius Erwin Alpas'),
 (18,'Committee on Labor and Employment','Hon. Richard M. Canillo','Hon. Maria Elena C. Limocon','Hon. Annette J. Navarro','Hon. Jesus M. Managaytay','Hon. Jose A. Alqueza'),
 (19,'Committee on Good Governance, Public Ethics and Accountability','Hon. Marvin M. Miralles','Hon. Julius Erwin Alpas','Hon. Joey D. Indino','Hon. Annette J. Navarro','Hon. Jesus M. Managaytay'),
 (20,'Committee on Justice and Human Rights','Hon. Jesus M. Managaytay','Hon. Marvin M. Miralles','Hon. Annette J. Navarro','Hon. Richard M. Canillo','Hon. Maria Elena C. Limocon'),
 (21,'Committee on Personnel and Civil Service','Hon. Maria Elena C. Limocon','Hon. Lorenzo P. Niñal','Hon. Marvin M. Miralles','Hon. Julius Erwin Alpas','Hon. Joey D. Indino'),
 (22,'Committee on Disaster Resilience','Hon. Julius Erwin Alpas','Hon. Annette J. Navarro','Hon. Joey D. Indino','Hon. Jesus M. Managaytay','Hon. Jose A. Alqueza'),
 (23,'Committee on Barangay Affairs','Hon. Joey D. Indino','Hon. Jesus M. Managaytay','Hon. Annette J. Navarro','Hon. Jose A. Alqueza','Hon. Julius Erwin Alpas'),
 (24,'Committee on Science, Technology and Innovation (STI)','Hon. Marmie Jeanne B. Albillar','Hon. Maria Elena C. Limocon','Hon. Lorenzo P. Niñal','Hon. Jose A. Alqueza','Hon. Marvin M. Miralles'),
 (25,'Oversight/Accountability','Hon. Lorenzo P. Niñal','Hon. Marvin M. Miralles','Hon. Maria Elena C. Limocon','Hon. Annette J. Navarro','Hon. Julius Erwin Alpas');

create or replace function pg_temp.portal_import_name(p_name text) returns text
language sql immutable as $$
 select regexp_replace(replace(lower(trim(p_name)),'.',''),'[[:space:]]+',' ','g');
$$;

-- Validate every reference before writing any persistent content.
do $$
declare
 resolved_term uuid;
 resolved_office uuid;
 resolved_master uuid;
 resolved_official text;
 matches integer;
 seed record;
 position_name text;
 assigned text[];
begin
 select count(*),min(id::text)::uuid into matches,resolved_term
 from public.legislative_terms
 where name='17th' and start_date=date '2025-07-01' and end_date=date '2028-06-30';
 if matches<>1 then raise exception 'Expected exactly one 17th term covering 2025-2028'; end if;
 select count(*),min(id::text)::uuid into matches,resolved_office
 from public.departments
 where name='Legislative Access' and department='legislative' and active and archived_at is null;
 if matches<>1 then raise exception 'Expected one active Legislative Access office'; end if;
 insert into portal_committee_import_context values(resolved_term,resolved_office);
 if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid='public.committees'::regclass and t.tgname='z_reorder'
  and t.tgenabled='O' and p.proname='portal_reorder_content') then
  raise exception 'Unexpected committee ordering trigger state; review before importing';
 end if;
 for seed in select * from portal_committee_roster order by sequence loop
  select count(*),min(id::text)::uuid into matches,resolved_master
  from public.committee_master
  where lower(regexp_replace(name,'[[:space:]]','','g'))=lower(regexp_replace(seed.name,'[[:space:]]','','g'));
  if matches<>1 then raise exception 'Missing or ambiguous Master Committee: %',seed.name; end if;
  if exists(select 1 from public.committees c where c.term_id=resolved_term
   and c.master_id=resolved_master and (c.office_id is distinct from resolved_office or c.content_scope<>'legislative')) then
   raise exception 'Existing composition has different ownership: %',seed.name;
  end if;
  if exists(select 1 from public.committees c where c.term_id=resolved_term and c.master_id is null
   and lower(regexp_replace(c.name,'[[:space:]]','','g'))=lower(regexp_replace(seed.name,'[[:space:]]','','g'))) then
   raise exception 'Unlinked historical committee needs review: %',seed.name;
  end if;
  if exists(select 1 from public.committees c where c.term_id=resolved_term
   and c.master_id=resolved_master and c.member_4_id is not null) then
   raise exception 'Existing fourth member needs review: %',seed.name;
  end if;
  assigned=array[]::text[];
  foreach position_name in array array[seed.chair_name,seed.vice_name,seed.member_1_name,seed.member_2_name,seed.member_3_name] loop
   select count(*),min(id) into matches,resolved_official from public.officials
   where office_id=resolved_office and term_id=resolved_term and content_scope='legislative'
    and pg_temp.portal_import_name(name)=pg_temp.portal_import_name(position_name);
   if matches<>1 then raise exception 'Missing or ambiguous official in the 17th term: %',position_name; end if;
   assigned=array_append(assigned,resolved_official);
  end loop;
  if (select count(distinct id) from unnest(assigned) id)<>5 then
   raise exception 'Duplicate committee positions: %',seed.name;
  end if;
  update portal_committee_roster set master_id=resolved_master,chair_id=assigned[1],vice_chair_id=assigned[2],
   member_1_id=assigned[3],member_2_id=assigned[4],member_3_id=assigned[5] where sequence=seed.sequence;
 end loop;
 if (select count(distinct master_id) from portal_committee_roster)<>25 then
  raise exception 'Expected 25 different Master Committees';
 end if;
end;
$$;

alter table public.committees disable trigger z_reorder;

-- Append missing compositions without moving any existing published position.
insert into public.committees(name,responsibility,chair,published,sort_order,
 office_id,content_scope,term_id,master_id,chair_id,vice_chair_id,member_1_id,member_2_id,member_3_id,member_4_id)
select s.name,'','',true,
 (select coalesce(max(c.sort_order),0) from public.committees c
  where c.published and c.content_scope='legislative' and c.office_id=x.office_id)
  +row_number() over(order by s.sequence),
 x.office_id,'legislative',x.term_id,s.master_id,s.chair_id,s.vice_chair_id,s.member_1_id,s.member_2_id,s.member_3_id,null
from portal_committee_roster s cross join portal_committee_import_context x
where not exists(select 1 from public.committees c where c.master_id=s.master_id and c.term_id=x.term_id);

-- Update only supplied role fields. Preserve all other existing content.
update public.committees c set chair_id=s.chair_id,vice_chair_id=s.vice_chair_id,
 member_1_id=s.member_1_id,member_2_id=s.member_2_id,member_3_id=s.member_3_id
from portal_committee_roster s cross join portal_committee_import_context x
where c.master_id=s.master_id and c.term_id=x.term_id and c.office_id=x.office_id
 and (c.chair_id,c.vice_chair_id,c.member_1_id,c.member_2_id,c.member_3_id)
 is distinct from (s.chair_id,s.vice_chair_id,s.member_1_id,s.member_2_id,s.member_3_id);

-- Finish deferred position checks before changing the trigger state.
set constraints all immediate;
alter table public.committees enable trigger z_reorder;

-- Abort the entire transaction if any of the 125 assignments is incomplete.
do $$
begin
 if (select count(*) from portal_committee_roster s cross join portal_committee_import_context x
  join public.committees c on c.master_id=s.master_id and c.term_id=x.term_id
   and c.office_id=x.office_id and c.content_scope='legislative'
   and (c.chair_id,c.vice_chair_id,c.member_1_id,c.member_2_id,c.member_3_id,c.member_4_id)
    is not distinct from (s.chair_id,s.vice_chair_id,s.member_1_id,s.member_2_id,s.member_3_id,null::text))<>25 then
  raise exception 'Committee assignment verification failed; no changes committed';
 end if;
end;
$$;

select '17th' as legislative_term,count(*) as committees,count(*) as chairmen,
 count(*) as vice_chairmen,count(*)*3 as members
from portal_committee_roster;
commit;
