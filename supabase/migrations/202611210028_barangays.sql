begin;
-- Apply after 027. Barangay profiles are municipal content, not staff offices.
-- This adds an empty collection; existing departments, assignments and files stay intact.
create table public.barangays (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 160),
 slug text not null unique check (length(slug) <= 180 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 captain_name text not null check (length(trim(captain_name)) between 1 and 200),
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
alter table public.barangays enable row level security;
revoke all on public.barangays from public,anon,authenticated;
grant select on public.barangays to anon,authenticated;
grant insert,update on public.barangays to authenticated;
create policy barangays_public_read on public.barangays for select to anon,authenticated using(published);
create policy barangays_superadmin_read on public.barangays for select to authenticated using((select public.is_superadmin()));
create policy barangays_superadmin_insert on public.barangays for insert to authenticated with check((select public.is_superadmin()));
create policy barangays_superadmin_update on public.barangays for update to authenticated
 using((select public.is_superadmin())) with check((select public.is_superadmin()));
create index barangays_public_order on public.barangays(sort_order,name,id) where published;
create trigger barangays_timestamp before update on public.barangays for each row execute function public.portal_touch_updated_at();
create trigger barangays_audit after insert or update on public.barangays for each row execute function public.portal_audit();

create function public.barangay_image_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.barangays where image_url like '%/storage/v1/object/public/municipal-media/'||p_name);
$$;
revoke all on function public.barangay_image_unreferenced(text) from public,anon,authenticated;
grant execute on function public.barangay_image_unreferenced(text) to authenticated;
create policy barangay_image_insert on storage.objects for insert to authenticated with check(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='barangays'
 and (storage.foldername(name))[2]=(select auth.uid())::text and (select public.is_superadmin())
);
-- Only failed, unreferenced uploads may be cleaned up. Referenced/replaced images are preserved.
create policy barangay_image_delete on storage.objects for delete to authenticated using(
 bucket_id='municipal-media' and (storage.foldername(name))[1]='barangays'
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and (select public.is_superadmin()) and public.barangay_image_unreferenced(name)
);
commit;
