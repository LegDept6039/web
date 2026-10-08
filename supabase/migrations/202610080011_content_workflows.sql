begin;
-- Keep historical slugs/IDs and every existing image reference.
alter table public.news add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists news_stable_id on public.news(id);
alter table public.news add column if not exists image_path text;
alter table public.news add column if not exists image_mime text;
alter table public.news add column if not exists image_size integer check (image_size > 0 and image_size <= 10485760);
alter table public.programs alter column id set default gen_random_uuid()::text;
alter table public.programs add column if not exists slug text;
-- Old unassigned records are retained; this schema-only backfill does not reassign them.
-- ALTER TABLE holds an exclusive lock until commit; all guards are restored below.
alter table public.programs disable trigger content_owner;
alter table public.programs disable trigger require_owner;
alter table public.programs disable trigger update_timestamp;
alter table public.programs disable trigger content_audit;
update public.programs set slug=id where slug is null;
alter table public.programs enable trigger content_owner;
alter table public.programs enable trigger require_owner;
alter table public.programs enable trigger update_timestamp;
alter table public.programs enable trigger content_audit;
alter table public.programs alter column slug set not null;
create unique index if not exists programs_unique_slug on public.programs(slug);
alter table public.programs add column if not exists image text;
create or replace function public.portal_content_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.id is distinct from old.id then
   raise exception 'Record IDs cannot be changed' using errcode='42501';
 end if;
 if TG_TABLE_NAME='programs' and new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
   raise exception 'Invalid program slug' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists stable_content_identity on public.news;
create trigger stable_content_identity before update on public.news for each row execute function public.portal_content_identity();
drop trigger if exists stable_content_identity on public.programs;
create trigger stable_content_identity before insert or update on public.programs for each row execute function public.portal_content_identity();
-- Append to the existing public projection without changing its source/visibility rules.
create or replace view public.published_news with (security_barrier=true) as
select n.slug,n.title,n.category,n.date,n.excerpt,n.image,n.content,n.is_sample,n.office_id,n.content_scope,n.published,n.sort_order,
 jsonb_build_object('name',coalesce(d.name,'Municipal information portal'),'slug',case when d.department='executive' and d.active and d.published and d.archived_at is null then d.slug else null end) as source,n.id
from public.news n left join public.departments d on d.id=n.office_id where n.published;
create or replace view public.published_programs with (security_barrier=true) as
select p.id,p.slug,p.name,p.description,p.category,p.status,p.image,p.is_sample,p.office_id,p.content_scope,p.published,p.sort_order,
 jsonb_build_object('name',coalesce(d.name,'Municipal information portal'),'slug',case when d.department='executive' and d.active and d.published and d.archived_at is null then d.slug else null end) as source
from public.programs p left join public.departments d on d.id=p.office_id where p.published;
revoke all on public.published_programs from public,anon,authenticated;
grant select on public.published_programs to anon,authenticated;

-- Direct uploads are staged privately, then decoded and copied to public media by the server.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('municipal-news-staging','municipal-news-staging',false,10485760,array['image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png'];
update storage.buckets set file_size_limit=greatest(coalesce(file_size_limit,10485760),10485760) where id='municipal-media';
create or replace function public.can_upload_news(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.departments d
 where d.id::text=split_part(p_name,'/',2)
 and split_part(p_name,'/',1)='news'
 and split_part(p_name,'/',3)=(select auth.uid())::text
 and public.can_manage_collection('news',d.department,d.id,'write'));
$$;
revoke all on function public.can_upload_news(text) from public,anon;
grant execute on function public.can_upload_news(text) to authenticated;
drop policy if exists news_staging_insert on storage.objects;
create policy news_staging_insert on storage.objects for insert to authenticated
with check(bucket_id='municipal-news-staging' and public.can_upload_news(name));
drop policy if exists news_staging_read on storage.objects;
create policy news_staging_read on storage.objects for select to authenticated
using(bucket_id='municipal-news-staging' and public.can_upload_news(name));
drop policy if exists news_staging_delete on storage.objects;
create policy news_staging_delete on storage.objects for delete to authenticated
using(bucket_id='municipal-news-staging' and public.can_upload_news(name));
drop policy if exists news_media_insert on storage.objects;
create policy news_media_insert on storage.objects for insert to authenticated
with check(bucket_id='municipal-media' and public.can_upload_news(name));
-- Global reference check: RLS must not hide another record sharing an old asset.
create or replace function public.news_media_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.news where image_path=p_name or image like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.programs where image like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.sessions where image like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.departments where image_url like '%/municipal-media/'||p_name or head_photo like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.officials where photo_url like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.legacy_department_profiles where head_photo like '%/municipal-media/'||p_name);
$$;
revoke all on function public.news_media_unreferenced(text) from public,anon;
grant execute on function public.news_media_unreferenced(text) to authenticated;
drop policy if exists news_media_delete on storage.objects;
create policy news_media_delete on storage.objects for delete to authenticated
using(bucket_id='municipal-media' and public.can_upload_news(name) and public.news_media_unreferenced(name));
commit;
