begin;
-- Apply after 029. Keep existing content, identities, links, media, publication
-- and display order intact. Only missing profiles are seeded and published.
lock table public.barangays,public.sk_profiles in share row exclusive mode;

create temporary table portal_barangay_sk_seed (
 name text not null,
 slug text primary key,
 sort_order integer not null,
 barangay_id uuid,
 existing boolean not null default false
) on commit drop;
insert into portal_barangay_sk_seed(name,slug,sort_order) values
 ('Anislag','anislag',1),
 ('Anopog','anopog',2),
 ('Binabag','binabag',3),
 ('Buhingtubig','buhingtubig',4),
 ('Busay','busay',5),
 ('Butong','butong',6),
 ('Cabiangon','cabiangon',7),
 ('Camugao','camugao',8),
 ('Duangan','duangan',9),
 ('Guimbawian','guimbawian',10),
 ('Lamac','lamac',11),
 ('Lut-od','lut-od',12),
 ('Mangoto','mangoto',13),
 ('Opao','opao',14),
 ('Pandacan','pandacan',15),
 ('Poblacion','poblacion',16),
 ('Punod','punod',17),
 ('Rizal','rizal',18),
 ('Sacsac','sacsac',19),
 ('Sambagon','sambagon',20),
 ('Sibago','sibago',21),
 ('Tajao','tajao',22),
 ('Tangub','tangub',23),
 ('Tanibag','tanibag',24),
 ('Tupas','tupas',25),
 ('Tutay','tutay',26);

-- Resolve every existing record before changing the schema or inserting content.
-- Ambiguous identities require an explicit correction instead of choosing a row.
do $$
declare
 seed record;
 matched_id uuid;
 matches integer;
begin
 for seed in select * from portal_barangay_sk_seed order by sort_order loop
  select count(*),min(b.id::text)::uuid into matches,matched_id
   from public.barangays b where lower(trim(b.name))=lower(seed.name);
  if matches>1 then
   raise exception 'Ambiguous barangay name: %. Resolve duplicate names before applying migration 030.',seed.name;
  end if;
  if exists(select 1 from public.barangays b where b.slug=seed.slug and b.id is distinct from matched_id) then
   raise exception 'Conflicting barangay page address: %. Resolve the existing record before applying migration 030.',seed.slug;
  end if;
  if exists(select 1 from public.sk_profiles p where p.slug=seed.slug and p.barangay_id is distinct from matched_id) then
   raise exception 'Conflicting SK page address: %. Resolve the existing profile before applying migration 030.',seed.slug;
  end if;
  update portal_barangay_sk_seed set barangay_id=coalesce(matched_id,gen_random_uuid()),existing=(matches=1)
   where slug=seed.slug;
 end loop;
end;
$$;

alter table public.barangays
 alter column captain_name set default '',
 alter column body set default '',
 drop constraint barangays_captain_name_check,
 add constraint barangays_captain_name_check check(length(trim(captain_name)) between 0 and 200),
 drop constraint barangays_body_check,
 add constraint barangays_body_check check(length(trim(body)) between 0 and 30000);
alter table public.sk_profiles
 alter column chairperson_name set default '',
 alter column body set default '',
 drop constraint sk_profiles_chairperson_name_check,
 add constraint sk_profiles_chairperson_name_check check(length(trim(chairperson_name)) between 0 and 200),
 drop constraint sk_profiles_body_check,
 add constraint sk_profiles_body_check check(length(trim(body)) between 0 and 30000);

insert into public.barangays(id,name,slug,published,sort_order)
 select barangay_id,name,slug,true,sort_order from portal_barangay_sk_seed
 where not existing
 on conflict do nothing;
insert into public.sk_profiles(barangay_id,slug,published,sort_order)
 select s.barangay_id,s.slug,true,s.sort_order from portal_barangay_sk_seed s
 where not exists(select 1 from public.sk_profiles p where p.barangay_id=s.barangay_id)
 on conflict do nothing;
commit;
