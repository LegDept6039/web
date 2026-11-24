begin;
-- Apply after 030. Sessions are always published; this includes existing drafts.
-- Preserve identities, terms, ownership, content, linked documents and media.
lock table public.sessions in access exclusive mode;

-- SQL Editor has no staff JWT. Suspend only ordering authorization and date-based
-- term assignment while changing publication/order, then restore both below.
-- Historical unassigned sessions must not acquire a term during this backfill.
do $$
begin
 if not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid='public.sessions'::regclass and t.tgname='z_reorder'
   and t.tgenabled='O' and p.proname='portal_reorder_content')
  or not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
   where t.tgrelid='public.sessions'::regclass and t.tgname='assign_legislative_term'
    and t.tgenabled='O' and p.proname='portal_term_assignment') then
  raise exception 'Unexpected session ordering or term trigger state; review before applying migration 031';
 end if;
end;
$$;

create temporary table portal_session_publication_before on commit drop as
 select id,to_jsonb(s) as original from public.sessions s;

alter table public.sessions disable trigger z_reorder;
alter table public.sessions disable trigger assign_legislative_term;

-- Append drafts within their existing ordering scope. Existing published
-- positions stay intact; newest sessions are appended first, with stable ties.
with positions as (
 select s.id,coalesce((select max(p.sort_order) from public.sessions p
   where p.published and public.portal_sort_scope('sessions',to_jsonb(p))=
    public.portal_sort_scope('sessions',to_jsonb(s))),0)
   +row_number() over(partition by public.portal_sort_scope('sessions',to_jsonb(s)) order by s.date desc,s.id) as position
 from public.sessions s where not s.published
)
update public.sessions s set published=true,sort_order=p.position
 from positions p where s.id=p.id;

-- Keep audit/timestamp, ownership, reference, FK and deferred position checks
-- active. Abort if any trigger unexpectedly rewrote preserved session fields.
do $$
begin
 if exists(select 1 from portal_session_publication_before b
  full join public.sessions s on s.id=b.id
  where b.id is null or s.id is null
   or (to_jsonb(s)-array['published','sort_order','updated_at'])<>
    (b.original-array['published','sort_order','updated_at'])
   or ((b.original->>'published')::boolean and
    (to_jsonb(s)-'updated_at')<>(b.original-'updated_at'))) then
  raise exception 'Session publication preservation check failed; no changes committed';
 end if;
end;
$$;

set constraints all immediate;
alter table public.sessions enable trigger assign_legislative_term;
alter table public.sessions enable trigger z_reorder;
alter table public.sessions alter column published set default true;
alter table public.sessions add constraint sessions_always_published check(published);
commit;
