begin;
-- Immutable uploads in the existing public bucket; no overwrite of another record's image.
create policy official_photo_insert on storage.objects for insert to authenticated with check (
 bucket_id='municipal-media' and (storage.foldername(name))[1]='officials' and (storage.foldername(name))[2]=(select auth.uid())::text
 and (public.can_manage_module('officials','write') or exists(select 1 from public.offices o where o.department='executive' and public.can_manage_office(o.id,'write')))
);
-- Cleanup is limited to the caller's unreferenced uploads. Existing images are retained on replacement.
create function public.official_photo_unreferenced(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.officials where photo_url like '%/storage/v1/object/public/municipal-media/'||p_name);
$$;
revoke all on function public.official_photo_unreferenced(text) from public,anon,authenticated;
grant execute on function public.official_photo_unreferenced(text) to authenticated;
create policy official_photo_delete on storage.objects for delete to authenticated using (
 bucket_id='municipal-media' and (storage.foldername(name))[1]='officials' and (storage.foldername(name))[2]=(select auth.uid())::text
 and public.official_photo_unreferenced(name)
 and (public.can_manage_module('officials','write') or exists(select 1 from public.offices o where o.department='executive' and public.can_manage_office(o.id,'write')))
);
commit;
