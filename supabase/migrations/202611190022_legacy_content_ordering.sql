begin;
-- Apply after 021. Preserve existing records, ownership and file references.
-- Assigning a legacy article to a department closes its former published slot.
-- The ordering trigger may therefore update untouched, still-unassigned peers.
create or replace function public.portal_require_department_owner() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.office_id is null then
  if TG_OP='UPDATE' and pg_trigger_depth()>1 then
   if old.office_id is null
    and (to_jsonb(new)-array['sort_order','updated_at'])=(to_jsonb(old)-array['sort_order','updated_at']) then
    return new;
   end if;
  end if;
  raise exception 'An owning office is required' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function public.portal_require_department_owner() from public,anon,authenticated;
commit;
