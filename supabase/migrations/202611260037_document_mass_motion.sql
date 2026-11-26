begin;
-- Apply after 036. Mass motion records collective Legislative approval without
-- assigning authorship to an individual. Existing documents keep their content,
-- identities, authorship, links, publication, ordering, timestamps and files.
-- Adding a default does not run UPDATE, audit or timestamp triggers.
alter table public.ordinances
 add column approval_mode text not null default 'authored',
 add constraint ordinances_approval_mode check(approval_mode in ('authored','mass_motion')),
 add constraint ordinances_mass_motion_authorship check(approval_mode<>'mass_motion' or
  (content_scope='legislative' and author_id is null and co_author_id is null
   and author='' and (co_author is null or co_author='')));
alter table public.resolutions
 add column approval_mode text not null default 'authored',
 add constraint resolutions_approval_mode check(approval_mode in ('authored','mass_motion')),
 add constraint resolutions_mass_motion_authorship check(approval_mode<>'mass_motion' or
  (content_scope='legislative' and author_id is null and co_author_id is null
   and author='' and (co_author is null or co_author='')));

-- Extend only migration 014's individual-author requirement. Existing office,
-- relationship, session, term, SB-role, FK and authorization guards stay active.
-- Previously authored legacy documents without an author ID remain compatible;
-- changing a mass-motion document back to authored requires an individual author.
create or replace function public.portal_legislative_relations() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb=to_jsonb(new); c text; target text; ref text; valid boolean;
begin
 if new.content_scope<>'legislative' then
  if TG_TABLE_NAME='committees' and coalesce(r->>'chair_id',r->>'vice_chair_id',r->>'member_1_id',r->>'member_2_id',r->>'member_3_id',r->>'member_4_id') is not null
    or TG_TABLE_NAME in ('ordinances','resolutions') and coalesce(r->>'author_id',r->>'co_author_id',r->>'committee_id',r->>'session_id') is not null
    or TG_TABLE_NAME='municipal_documents' and coalesce(r->>'document_type',r->>'session_id') is not null then
   raise exception 'Legislative relationships require Legislative ownership' using errcode='42501';
  end if;
  return new;
 end if;
 if TG_TABLE_NAME in ('ordinances','resolutions') and r->>'approval_mode'<>'mass_motion'
  and r->>'author_id' is null and (TG_OP='INSERT' or to_jsonb(old)->>'author_id' is not null
   or to_jsonb(old)->>'approval_mode'='mass_motion') then
  raise exception 'Choose one author or select Mass motion' using errcode='23514';
 end if;
 if TG_TABLE_NAME='municipal_documents' and r->>'document_type' in ('agenda','minutes') and r->>'session_id' is null then
  raise exception 'Choose a session' using errcode='23514';
 end if;
 foreach c in array array['author_id','co_author_id','chair_id','vice_chair_id','member_1_id','member_2_id','member_3_id','member_4_id','committee_id','session_id'] loop
  ref=r->>c;
  if ref is not null then
   target=case c when 'committee_id' then 'committees' when 'session_id' then 'sessions' else 'officials' end;
   execute format('select exists(select 1 from public.%I where id=$1 and content_scope=''legislative'' and office_id=$2)',target) into valid using ref,new.office_id;
   if not valid then raise exception 'Related record must belong to this Legislative office' using errcode='42501'; end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function public.portal_legislative_relations() from public,anon,authenticated;
commit;
