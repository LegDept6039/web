-- Apply after migration 009. Preserve all department identities, content and media.
begin;
create or replace function public.portal_protect_department() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Deactivate departments to preserve users and content' using errcode='42501'; end if;
 if not public.is_superadmin() and (
   new.name is distinct from old.name
   or new.short_name is distinct from old.short_name
   or new.slug is distinct from old.slug
   or new.published is distinct from old.published
   or new.sort_order is distinct from old.sort_order
   or new.is_sample is distinct from old.is_sample
   or new.id is distinct from old.id
   or new.department is distinct from old.department
   or new.active is distinct from old.active
   or new.archived_at is distinct from old.archived_at
   or new.legacy_profile_id is distinct from old.legacy_profile_id
 ) then
  raise exception 'Only superadmins can change department identity and access settings' using errcode='42501';
 end if;
 if new.department is distinct from old.department then raise exception 'Department branch cannot be changed after creation' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function public.portal_protect_department() from public,anon,authenticated;

commit;
