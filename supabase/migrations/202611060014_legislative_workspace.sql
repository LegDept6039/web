begin;
-- Add relationships without rewriting legacy IDs, publication flags, text or files.
alter table public.sessions add column name text;
alter table public.sessions alter column id set default gen_random_uuid()::text;
alter table public.committees alter column id set default gen_random_uuid()::text;
alter table public.committees
 add column chair_id text references public.officials(id) on delete restrict,
 add column vice_chair_id text references public.officials(id) on delete restrict,
 add column member_1_id text references public.officials(id) on delete restrict,
 add column member_2_id text references public.officials(id) on delete restrict,
 add column member_3_id text references public.officials(id) on delete restrict,
 add column member_4_id text references public.officials(id) on delete restrict;
do $$ declare t text; c text; begin
 foreach t in array array['ordinances','resolutions'] loop
 execute format('alter table public.%I alter column id set default gen_random_uuid()::text',t);
 execute format('alter table public.%I add column author_id text references public.officials(id) on delete restrict, add column co_author_id text references public.officials(id) on delete restrict, add column committee_id text references public.committees(id) on delete restrict, add column session_id text references public.sessions(id) on delete restrict',t);
 foreach c in array array['author_id','co_author_id','committee_id','session_id'] loop
 execute format('create index %I on public.%I(%I)',t||'_'||c||'_idx',t,c);
 end loop;
 end loop;
 foreach c in array array['chair_id','vice_chair_id','member_1_id','member_2_id','member_3_id','member_4_id'] loop
 execute format('create index %I on public.committees(%I)','committees_'||c||'_idx',c);
 end loop;
end $$;
alter table public.municipal_documents alter column id set default gen_random_uuid()::text;
alter table public.municipal_documents alter column category_id drop not null;
alter table public.municipal_documents alter column file_url set default '';
alter table public.municipal_documents add column document_type text check(document_type in ('agenda','minutes','executive-order'));
alter table public.municipal_documents add column session_id text references public.sessions(id) on delete restrict;
create index municipal_documents_session_idx on public.municipal_documents(session_id);
create index municipal_documents_type_created_idx on public.municipal_documents(document_type,created_at desc);
-- FK constraints protect identity; this trigger additionally protects branch/office ownership.
create function public.portal_legislative_relations() returns trigger language plpgsql security definer set search_path='' as $$
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
 if TG_TABLE_NAME in ('ordinances','resolutions') and r->>'author_id' is null and (TG_OP='INSERT' or to_jsonb(old)->>'author_id' is not null) then
  raise exception 'Choose one author' using errcode='23514';
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
do $$ declare t text; begin
 foreach t in array array['committees','ordinances','resolutions','municipal_documents'] loop
 execute format('create trigger legislative_relations before insert or update on public.%I for each row execute function public.portal_legislative_relations()',t);
 end loop;
end $$;
-- Do not let a referenced official/session/committee move into another access scope.
create function public.portal_protect_legislative_reference() returns trigger language plpgsql security definer set search_path='' as $$
declare t text; c text; cols text[]; referenced boolean;
begin
 if new.office_id is not distinct from old.office_id and new.content_scope is not distinct from old.content_scope then return new; end if;
 foreach t in array array['ordinances','resolutions','committees','municipal_documents'] loop
  cols=case when TG_TABLE_NAME='officials' and t in ('ordinances','resolutions') then array['author_id','co_author_id']
    when TG_TABLE_NAME='officials' and t='committees' then array['chair_id','vice_chair_id','member_1_id','member_2_id','member_3_id','member_4_id']
    when TG_TABLE_NAME='sessions' and t in ('ordinances','resolutions','municipal_documents') then array['session_id']
    when TG_TABLE_NAME='committees' and t in ('ordinances','resolutions') then array['committee_id'] else array[]::text[] end;
  foreach c in array cols loop
   execute format('select exists(select 1 from public.%I where %I=$1)',t,c) into referenced using old.id;
   if referenced then raise exception 'Referenced Legislative records cannot change office or branch' using errcode='42501'; end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.portal_protect_legislative_reference() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['officials','sessions','committees'] loop
 execute format('create trigger protect_legislative_reference before update on public.%I for each row execute function public.portal_protect_legislative_reference()',t);
 end loop;
end $$;
-- A read-only union over existing tables; RLS of each source remains authoritative.
create view public.legislative_documents with (security_invoker=true) as
 select 'ordinances'::text collection,'ordinance'::text document_type,id,title,number,date_approved date,summary body,created_at,updated_at,published,office_id,content_scope from public.ordinances where content_scope='legislative'
 union all
 select 'resolutions','resolution',id,title,number,date_approved,summary,created_at,updated_at,published,office_id,content_scope from public.resolutions where content_scope='legislative'
 union all
 select 'documents',coalesce(document_type,'legacy'),id,title,null,date,description,created_at,updated_at,published,office_id,content_scope from public.municipal_documents where content_scope='legislative';
revoke all on public.legislative_documents from public,anon,authenticated;
grant select on public.legislative_documents to anon,authenticated;
commit;
