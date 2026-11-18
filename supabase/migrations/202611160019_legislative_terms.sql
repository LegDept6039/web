begin;
-- Existing identities and historical links remain untouched and unassigned.
create table public.legislative_terms (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 150),
 start_date date not null,
 end_date date not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(start_date<=end_date),
 exclude using gist (daterange(start_date,end_date,'[]') with &&)
);
alter table public.legislative_terms enable row level security;
revoke all on public.legislative_terms from public,anon,authenticated;
grant select on public.legislative_terms to anon,authenticated;
grant insert,update on public.legislative_terms to authenticated;
create policy terms_read on public.legislative_terms for select to anon,authenticated using(true);
create policy terms_create on public.legislative_terms for insert to authenticated with check(public.is_superadmin());
create policy terms_update on public.legislative_terms for update to authenticated using(public.is_superadmin()) with check(public.is_superadmin());
create trigger terms_timestamp before update on public.legislative_terms for each row execute function public.portal_touch_updated_at();
do $$ declare t text; begin
 foreach t in array array['officials','committees','sessions','ordinances','resolutions','municipal_documents'] loop
 execute format('alter table public.%I add column term_id uuid references public.legislative_terms(id) on delete restrict',t);
 execute format('create index %I on public.%I(term_id)',t||'_term_idx',t);
 end loop;
end $$;

-- Serialize assignment and term-boundary changes, including concurrent staff saves.
create function public.portal_term_assignment() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb=to_jsonb(new); expected uuid; source_date date; c text; target text; linked uuid; parent_term uuid; ref text; found_ref boolean; cols text[]; t text;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261116,19);
 if new.content_scope<>'legislative' then
  if new.term_id is not null then raise exception 'Only Legislative records may have a term' using errcode='23514'; end if;
  return new;
 end if;
 -- Publication reordering may touch preserved, unassigned peers. Do not
 -- force historical adoption during timestamp/order-only updates.
 if TG_OP='UPDATE' and old.term_id is null and new.term_id is null and
   (to_jsonb(new)-array['updated_at','sort_order'])=(to_jsonb(old)-array['updated_at','sort_order']) then return new; end if;
 if TG_TABLE_NAME in ('officials','committees') then
  if new.term_id is null then raise exception 'Choose a Legislative Term' using errcode='23514'; end if;
 elsif TG_TABLE_NAME='municipal_documents' and r->>'document_type' in ('agenda','minutes') then
  select term_id into expected from public.sessions where id=r->>'session_id' and office_id=new.office_id and content_scope='legislative';
  if expected is null then raise exception 'Assign the selected session to a Legislative Term first' using errcode='23514'; end if;
  new.term_id=expected;
 else
  source_date=case when TG_TABLE_NAME in ('ordinances','resolutions') then (r->>'date_approved')::date else (r->>'date')::date end;
  select id into expected from public.legislative_terms where source_date between start_date and end_date;
  if expected is null then raise exception 'No Legislative Term covers this date. Ask Superadmin to create the term first.' using errcode='23514'; end if;
  new.term_id=expected;
 end if;
 foreach c in array array['author_id','co_author_id','chair_id','vice_chair_id','member_1_id','member_2_id','member_3_id','member_4_id','committee_id','session_id'] loop
  ref=r->>c;
  if ref is not null then
   target=case c when 'committee_id' then 'committees' when 'session_id' then 'sessions' else 'officials' end;
   execute format('select term_id,true from public.%I where id=$1',target) into linked,found_ref using ref;
   if found_ref is not true or linked is distinct from new.term_id then raise exception 'Related records must belong to the same Legislative Term' using errcode='23514'; end if;
  end if;
 end loop;
 -- A parent cannot leave already assigned dependents in a different term.
 if TG_OP='UPDATE' and new.term_id is distinct from old.term_id and TG_TABLE_NAME in ('officials','committees','sessions') then
  foreach t in array array['committees','ordinances','resolutions','municipal_documents'] loop
   cols=case when TG_TABLE_NAME='officials' and t='committees' then array['chair_id','vice_chair_id','member_1_id','member_2_id','member_3_id','member_4_id']
     when TG_TABLE_NAME='officials' and t in ('ordinances','resolutions') then array['author_id','co_author_id']
     when TG_TABLE_NAME='committees' and t in ('ordinances','resolutions') then array['committee_id']
     when TG_TABLE_NAME='sessions' and t in ('ordinances','resolutions','municipal_documents') then array['session_id'] else array[]::text[] end;
   foreach c in array cols loop
    execute format('select term_id from public.%I where %I=$1 and term_id is not null and term_id<>$2 limit 1',t,c) into parent_term using old.id,new.term_id;
    if parent_term is not null then raise exception 'This record is referenced by records in another term. Preserve it and create a term-specific record.' using errcode='23514'; end if;
   end loop;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.portal_term_assignment() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['officials','committees','sessions','ordinances','resolutions','municipal_documents'] loop
 execute format('create trigger assign_legislative_term before insert or update on public.%I for each row execute function public.portal_term_assignment()',t);
 end loop;
end $$;
create function public.protect_term_dates() returns trigger language plpgsql security definer set search_path='' as $$
declare t text; col text; invalid boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261116,19);
 if TG_OP='UPDATE' then
  if new.id<>old.id then raise exception 'Term IDs cannot change' using errcode='23514'; end if;
  foreach t in array array['sessions','ordinances','resolutions','municipal_documents'] loop
   col=case when t in ('ordinances','resolutions') then 'date_approved' else 'date' end;
   execute format('select exists(select 1 from public.%I where term_id=$1 and %I not between $2 and $3 %s)',t,col,
    case when t='municipal_documents' then 'and document_type is distinct from ''agenda'' and document_type is distinct from ''minutes''' else '' end)
    into invalid using old.id,new.start_date,new.end_date;
   if invalid then raise exception 'These dates exclude linked records. Keep dates covering the assigned records.' using errcode='23514'; end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.protect_term_dates() from public,anon,authenticated;
create trigger protect_term_dates before insert or update on public.legislative_terms for each row execute function public.protect_term_dates();
create or replace view public.legislative_documents with (security_invoker=true) as
 select 'ordinances'::text collection,'ordinance'::text document_type,id,title,number,date_approved date,summary body,created_at,updated_at,published,office_id,content_scope,term_id from public.ordinances where content_scope='legislative'
 union all
 select 'resolutions','resolution',id,title,number,date_approved,summary,created_at,updated_at,published,office_id,content_scope,term_id from public.resolutions where content_scope='legislative'
 union all
 select 'documents',coalesce(document_type,'legacy'),id,title,null,date,description,created_at,updated_at,published,office_id,content_scope,term_id from public.municipal_documents where content_scope='legislative';
commit;
