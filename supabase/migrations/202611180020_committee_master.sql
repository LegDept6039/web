begin;
-- Catalog identities are independent of the preserved, term-specific committee IDs.
create table public.committee_master (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(trim(name)) between 1 and 300),
 sort_order integer not null default 0 check(sort_order between 0 and 1000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.committee_master enable row level security;
revoke all on public.committee_master from public,anon,authenticated;
grant select,insert,update on public.committee_master to authenticated;
create policy committee_master_read on public.committee_master for select to authenticated
using(public.is_superadmin() or exists(select 1 from public.departments d where d.department='legislative' and public.can_manage_collection('committees','legislative',d.id,'read')));
create policy committee_master_create on public.committee_master for insert to authenticated with check(public.is_superadmin());
create policy committee_master_update on public.committee_master for update to authenticated using(public.is_superadmin()) with check(public.is_superadmin());
create trigger committee_master_timestamp before update on public.committee_master for each row execute function public.portal_touch_updated_at();
alter table public.committees add column master_id uuid references public.committee_master(id) on delete restrict;

-- Verified initial list of 25 names supplied and confirmed by the municipality.
-- This is editable database seed data, never an application registry.
insert into public.committee_master(name,sort_order) values
('Committee on Finance, Budget and Appropriation',1),
('Committee on Women and Family Concerns, Social Services, Marginalized Sectors',2),
('Committee on Youth and Sports Development',3),
('Committee on Environmental Protection',4),
('Committee on Cooperatives, Peoples Organization, Associations and Non-Government Organizations',5),
('Committee on Rules and Privileges',6),
('Committee on Ordinances and Legal Matters',7),
('Committee on Peace and Order and Public Safety',8),
('Committee on Health and Sanitation',9),
('Committee on Agriculture',10),
('Committee on Education',11),
('Committee on Ways and Means, Public Facilities',12),
('Committee on Games and Amusements',13),
('Committee on Infrastructure and Public Works',14),
('Committee on Zoning and Land Use',15),
('Committee on Tourism and Heritage/Culture and the Arts',16),
('Committee on Trade, Commerce and Industry, Transportation and Communication',17),
('Committee on Labor and Employment',18),
('Committee on Good Governance, Public Ethics and Accountability',19),
('Committee on Justice and Human Rights',20),
('Committee on Personnel and Civil Service',21),
('Committee on Disaster Resilience',22),
('Committee on Barangay Affairs',23),
('Committee on Science, Technology and Innovation (STI)',24),
('Oversight/Accountability',25);
-- Only exact, single-occurrence names are associated automatically. Repeated or
-- differently spelled historical names remain unlinked for manual review.
alter table public.committees disable trigger user;
update public.committees c set master_id=m.id from public.committee_master m
where c.content_scope='legislative' and c.name=m.name
and (select count(*) from public.committees other where other.content_scope='legislative' and other.name=c.name)=1;
alter table public.committees enable trigger user;
create unique index committees_master_term_unique on public.committees(master_id,term_id);

create function public.portal_committee_master() returns trigger
language plpgsql security definer set search_path='' as $$
declare catalog_name text; assignments text[];
begin
 if TG_OP='UPDATE' then
  if new.id is distinct from old.id then raise exception 'Committee IDs cannot change' using errcode='23514'; end if;
  if new.name is distinct from old.name then raise exception 'Historical committee names cannot change; edit the master catalog instead' using errcode='23514'; end if;
  if old.master_id is not null and new.master_id is distinct from old.master_id then raise exception 'An associated committee must retain its master identity' using errcode='23514'; end if;
  -- Publication ordering must not force unrelated historical records to be assigned.
  if (to_jsonb(new)-array['updated_at','sort_order'])=(to_jsonb(old)-array['updated_at','sort_order']) then return new; end if;
 end if;
 if new.content_scope<>'legislative' then
  if new.master_id is not null then raise exception 'Committee masters require Legislative ownership' using errcode='42501'; end if;
  return new;
 end if;
 if new.master_id is null then raise exception 'Choose a Master Committee' using errcode='23514'; end if;
 select name into catalog_name from public.committee_master where id=new.master_id for share;
 if not found then raise exception 'Choose an existing Master Committee' using errcode='23503'; end if;
 if TG_OP='INSERT' then new.name=catalog_name; end if;
 assignments=array_remove(array[new.chair_id,new.vice_chair_id,new.member_1_id,new.member_2_id,new.member_3_id,new.member_4_id],null);
 if cardinality(assignments)<>(select count(distinct x) from unnest(assignments) x) then
  raise exception 'Choose a different official for each committee position' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.portal_committee_master() from public,anon,authenticated;
create trigger committee_master_guard before insert or update on public.committees for each row execute function public.portal_committee_master();
commit;
