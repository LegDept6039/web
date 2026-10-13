-- Apply after 011. Backfill preserves historical (sort_order,id) order in each scope.
begin;
create or replace function public.portal_sort_scope(t text, r jsonb) returns text language sql immutable set search_path='' as $$
 select case when t='departments' then r->>'department' else coalesce(r->>'content_scope','')||':'||coalesce(r->>'office_id','unassigned') end;
$$;
revoke all on function public.portal_sort_scope(text,jsonb) from public,anon;
grant execute on function public.portal_sort_scope(text,jsonb) to authenticated;
-- Exclusive locks and transaction rollback protect the one-time normalization.
do $$ declare t text; begin
 foreach t in array array['officials','departments','news','programs','ordinances','resolutions','sessions','services','committees','hearings','document_categories','municipal_documents','department_contacts'] loop
  execute format('lock table public.%I in access exclusive mode',t);
  execute format('alter table public.%I disable trigger user',t);
  execute format('with ranked as (select id, row_number() over(partition by public.portal_sort_scope(%L,to_jsonb(x)) order by sort_order,id) as pos from public.%I x where published) update public.%I x set sort_order=r.pos from ranked r where x.id=r.id',t,t,t);
  execute format('update public.%I set sort_order=0 where not published',t);
  execute format('alter table public.%I enable trigger user',t);
  execute format('alter table public.%I add constraint publication_position check ((published and sort_order>0) or (not published and sort_order=0))',t);
 end loop;
end $$;

create function public.portal_reorder_content() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb; o jsonb; ns text; os text; oldpos integer; target integer; total integer; k text; begin
 if pg_trigger_depth()>1 then return new; end if;
 n=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_OP<>'INSERT' then o=to_jsonb(old); end if;
 ns=public.portal_sort_scope(TG_TABLE_NAME,n); os=public.portal_sort_scope(TG_TABLE_NAME,o);
 -- The helper may shift sibling rows, so explicitly authorize the caller before doing so.
 if TG_TABLE_NAME='departments' then
  if TG_OP='UPDATE' and new.published=old.published and new.sort_order=old.sort_order then return new; end if;
  if not public.is_superadmin() then raise exception 'Only superadmins can order departments' using errcode='42501'; end if;
 else
  if not public.can_manage_collection(TG_TABLE_NAME,n->>'content_scope',(n->>'office_id')::uuid,case when TG_OP='DELETE' then 'delete' else 'write' end)
    or (o is not null and not public.can_manage_collection(TG_TABLE_NAME,o->>'content_scope',(o->>'office_id')::uuid,case when TG_OP='DELETE' then 'delete' else 'write' end)) then
   raise exception 'No ordering access to this collection' using errcode='42501'; end if;
 end if;
 -- Sort scope lock order is consistent during transfers. Concurrent row deadlocks abort safely.
 for k in select distinct v from unnest(array[ns,os]) v where v is not null order by v loop
  perform pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||':'||k,0));
 end loop;
 oldpos=case when coalesce((o->>'published')::boolean,false) then (o->>'sort_order')::integer else null end;
 if TG_OP='UPDATE' and ns=os and new.published=old.published and new.sort_order=old.sort_order then return new; end if;
 if TG_OP<>'DELETE' and new.published then
  if new.sort_order is null or new.sort_order<1 then raise exception 'Choose a positive published position' using errcode='23514'; end if;
  execute format('select count(*) from public.%I x where published and public.portal_sort_scope(%L,to_jsonb(x))=$1 and id::text<>$2',TG_TABLE_NAME,TG_TABLE_NAME) into total using ns,n->>'id';
  if new.sort_order>total+1 then raise exception 'Position changed; reload and choose an available position' using errcode='40001'; end if;
  target=new.sort_order;
 end if;
 -- Remove the old slot, then make room at the requested slot, all within this transaction.
 if oldpos is not null then
  execute format('update public.%I x set sort_order=sort_order-1 where published and public.portal_sort_scope(%L,to_jsonb(x))=$1 and sort_order>$2 and id::text<>$3',TG_TABLE_NAME,TG_TABLE_NAME) using os,oldpos,n->>'id';
 end if;
 if target is not null then
  execute format('update public.%I x set sort_order=sort_order+1 where published and public.portal_sort_scope(%L,to_jsonb(x))=$1 and sort_order>=$2 and id::text<>$3',TG_TABLE_NAME,TG_TABLE_NAME) using ns,target,n->>'id';
 end if;
 if TG_OP='DELETE' then return old; end if;
 if not new.published then new.sort_order=0; end if;
 return new;
end $$;
revoke all on function public.portal_reorder_content() from public,anon,authenticated;

create function public.portal_check_positions() returns trigger language plpgsql security definer set search_path='' as $$
declare bad boolean; begin
 execute format('select exists(select 1 from public.%I x where published group by public.portal_sort_scope(%L,to_jsonb(x)),sort_order having count(*)>1)',TG_TABLE_NAME,TG_TABLE_NAME) into bad;
 if bad then raise exception 'Published position conflict; reload and retry' using errcode='40001'; end if;
 return null;
end $$;
revoke all on function public.portal_check_positions() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['officials','departments','news','programs','ordinances','resolutions','sessions','services','committees','hearings','document_categories','municipal_documents','department_contacts'] loop
  execute format('create trigger z_reorder before insert or update or delete on public.%I for each row execute function public.portal_reorder_content()',t);
  execute format('create constraint trigger ordered_positions after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.portal_check_positions()',t);
 end loop;
end $$;

-- JSON documents contain only the supported text/list nodes and predefined sizes.
create function public.portal_valid_rich_node(n jsonb, depth integer default 0) returns boolean language plpgsql immutable set search_path='' as $$
declare typ text; c jsonb; m jsonb; a jsonb; begin
 if depth>12 or jsonb_typeof(n)<>'object' then return false; end if;
 typ=n->>'type';
 if typ is null or typ not in ('doc','paragraph','bulletList','orderedList','listItem','text','hardBreak') then return false; end if;
 if exists(select 1 from jsonb_object_keys(n) k where k not in ('type','content','text','marks','attrs')) then return false; end if;
 a=n->'attrs';
 if a is not null and a<>'null'::jsonb then
  if jsonb_typeof(a)<>'object' then return false; end if;
  if typ='paragraph' then
   if exists(select 1 from jsonb_object_keys(a) k where k<>'size') or coalesce(a->>'size','normal') not in ('small','normal','large') then return false; end if;
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
revoke all on function public.portal_valid_rich_node(jsonb,integer) from public,anon;
grant execute on function public.portal_valid_rich_node(jsonb,integer) to authenticated;
alter table public.news add column rich_body jsonb;
alter table public.programs add column rich_body jsonb;
alter table public.news add constraint valid_rich_body check(rich_body is null or (octet_length(rich_body::text)<=200000 and rich_body->>'type'='doc' and public.portal_valid_rich_node(rich_body)));
alter table public.programs add constraint valid_rich_body check(rich_body is null or (octet_length(rich_body::text)<=200000 and rich_body->>'type'='doc' and public.portal_valid_rich_node(rich_body)));
-- Keep legacy text untouched. Applications adapt it until an editor saves formatted content.
create or replace view public.published_news with (security_barrier=true) as
select n.slug,n.title,n.category,n.date,n.excerpt,n.image,n.content,n.is_sample,n.office_id,n.content_scope,n.published,n.sort_order,
 jsonb_build_object('name',coalesce(d.name,'Municipal information portal'),'slug',case when d.department='executive' and d.active and d.published and d.archived_at is null then d.slug else null end) as source,n.id,n.rich_body
from public.news n left join public.departments d on d.id=n.office_id where n.published;
create or replace view public.published_programs with (security_barrier=true) as
select p.id,p.slug,p.name,p.description,p.category,p.status,p.image,p.is_sample,p.office_id,p.content_scope,p.published,p.sort_order,
 jsonb_build_object('name',coalesce(d.name,'Municipal information portal'),'slug',case when d.department='executive' and d.active and d.published and d.archived_at is null then d.slug else null end) as source,p.rich_body
from public.programs p left join public.departments d on d.id=p.office_id where p.published;
commit;
