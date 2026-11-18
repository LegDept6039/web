begin;
-- Validate future saves; preserve all existing identities, authorship and file references.
create index sessions_office_date on public.sessions(office_id,date) where content_scope='legislative';

create function public.portal_document_session_authors() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb=to_jsonb(new); document_date date; matches text[]; ref text;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261116,19);
 if new.content_scope<>'legislative' then return new; end if;
 if TG_OP='UPDATE' and
  (to_jsonb(new)-array['updated_at','sort_order'])=(to_jsonb(old)-array['updated_at','sort_order']) then return new; end if;
 if TG_TABLE_NAME in ('ordinances','resolutions') then
  foreach ref in array array[r->>'author_id',r->>'co_author_id'] loop
   if ref is not null and not exists(select 1 from public.officials where id=ref and office_id=new.office_id and content_scope='legislative' and legislative_role='SANGGUNIANG_BAYAN') then
    raise exception 'Authors and co-authors must be Sangguniang Bayan members' using errcode='23514';
   end if;
  end loop;
  document_date=(r->>'date_approved')::date;
 elsif r->>'document_type' in ('agenda','minutes') then
  document_date=(r->>'date')::date;
 else return new;
 end if;
 if new.session_id is not null then
  if not exists(select 1 from public.sessions s join public.legislative_terms t on t.id=s.term_id
    where s.id=new.session_id and s.office_id=new.office_id and s.content_scope='legislative'
    and s.date=document_date and document_date between t.start_date and t.end_date) then
   raise exception 'Session must match the document date, Legislative office and term' using errcode='23514';
  end if;
 else
  select array_agg(id) into matches from (
   select s.id from public.sessions s join public.legislative_terms t on t.id=s.term_id
   where s.office_id=new.office_id and s.content_scope='legislative' and s.date=document_date
    and document_date between t.start_date and t.end_date order by s.id limit 2
  ) candidates;
  if coalesce(cardinality(matches),0)=0 then
   raise exception 'No matching session. Create a session for this document date first' using errcode='23514';
  elsif cardinality(matches)>1 then
   raise exception 'Multiple sessions were held on this date. Choose the correct session' using errcode='23514';
  end if;
  new.session_id=matches[1];
 end if;
 return new;
end $$;
revoke all on function public.portal_document_session_authors() from public,anon,authenticated;
-- Runs before assign_legislative_term, so Agenda/Minutes inherit the matched session term.
do $$ declare t text; begin
 foreach t in array array['ordinances','resolutions','municipal_documents'] loop
  execute format('create trigger a_document_session_authors before insert or update on public.%I for each row execute function public.portal_document_session_authors()',t);
 end loop;
end $$;

create function public.protect_document_session_authors() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261116,19);
 if TG_TABLE_NAME='officials' then
  if new.legislative_role is distinct from old.legislative_role and new.legislative_role is distinct from 'SANGGUNIANG_BAYAN'
   and (exists(select 1 from public.ordinances where content_scope='legislative' and (author_id=old.id or co_author_id=old.id))
    or exists(select 1 from public.resolutions where content_scope='legislative' and (author_id=old.id or co_author_id=old.id))) then
   raise exception 'An author or co-author must remain a Sangguniang Bayan member. Preserve the historical official record' using errcode='23514';
  end if;
 elsif new.date is distinct from old.date then
  if exists(select 1 from public.ordinances where content_scope='legislative' and session_id=old.id and date_approved<>new.date)
   or exists(select 1 from public.resolutions where content_scope='legislative' and session_id=old.id and date_approved<>new.date)
   or exists(select 1 from public.municipal_documents where content_scope='legislative' and document_type in ('agenda','minutes') and session_id=old.id and date<>new.date) then
   raise exception 'This session date is used by linked documents. Preserve it and create a separate session' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.protect_document_session_authors() from public,anon,authenticated;
create trigger protect_document_session_authors before update on public.officials for each row execute function public.protect_document_session_authors();
create trigger protect_document_session_authors before update on public.sessions for each row execute function public.protect_document_session_authors();
commit;
