begin;
-- Apply after 028. This creates an empty SK collection without changing barangays,
-- departments, staff assignments, existing content or uploaded files.
create table public.sk_profiles (
 id uuid primary key default gen_random_uuid(),
 barangay_id uuid not null unique references public.barangays(id),
 slug text not null unique check (length(slug) <= 180 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 chairperson_name text not null check (length(trim(chairperson_name)) between 1 and 200),
 image_url text check (image_url is null or length(image_url) between 1 and 2048),
 body text not null check (length(trim(body)) between 1 and 30000),
 rich_body jsonb check (rich_body is null or (
  octet_length(rich_body::text)<=200000 and rich_body->>'type'='doc'
  and public.portal_valid_rich_node(rich_body)
 )),
 published boolean not null default false,
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.sk_profiles enable row level security;
revoke all on public.sk_profiles from public,anon,authenticated;
grant select on public.sk_profiles to anon,authenticated;
grant insert,update on public.sk_profiles to authenticated;
create policy sk_profiles_public_read on public.sk_profiles for select to anon,authenticated using(
 published and exists(select 1 from public.barangays b where b.id=barangay_id and b.published)
);
create policy sk_profiles_superadmin_read on public.sk_profiles for select to authenticated using((select public.is_superadmin()));
create policy sk_profiles_superadmin_insert on public.sk_profiles for insert to authenticated with check((select public.is_superadmin()));
create policy sk_profiles_superadmin_update on public.sk_profiles for update to authenticated
 using((select public.is_superadmin())) with check((select public.is_superadmin()));
create index sk_profiles_public_order on public.sk_profiles(sort_order,slug,id) where published;
create trigger sk_profiles_timestamp before update on public.sk_profiles for each row execute function public.portal_touch_updated_at();
create trigger sk_profiles_audit after insert or update on public.sk_profiles for each row execute function public.portal_audit();

create function public.sk_image_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.sk_profiles
  where right(image_url,length('/storage/v1/object/public/municipal-media/'||p_name))='/storage/v1/object/public/municipal-media/'||p_name);
$$;
revoke all on function public.sk_image_unreferenced(text) from public,anon,authenticated;
grant execute on function public.sk_image_unreferenced(text) to authenticated;
create policy sk_image_insert on storage.objects for insert to authenticated with check(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='sk'
 and (storage.foldername(name))[2]=(select auth.uid())::text and (select public.is_superadmin())
);
-- Referenced images are retained. Only the uploader's unreferenced files may be cleaned up.
create policy sk_image_delete on storage.objects for delete to authenticated using(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='sk'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and (select public.is_superadmin()) and public.sk_image_unreferenced(name)
);
commit;
