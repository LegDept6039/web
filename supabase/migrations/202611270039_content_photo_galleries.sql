begin;
-- Optional gallery photos supplement existing covers; no existing text, IDs,
-- authorship, ownership, publication, ordering, timestamps or assets are changed.
alter table public.news add column gallery_images text[] not null default '{}';
alter table public.programs add column gallery_images text[] not null default '{}';
create function public.valid_gallery_images(p_images text[]) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(array_ndims(p_images),1)=1 and cardinality(p_images)<=12 and not exists(
  select 1 from unnest(p_images) image where image is null or length(image)>2000
   or image !~ '^(/[^/]|https://)' or image ~ '[[:space:]<>"\\]'
 );
$$;
alter table public.news add constraint news_valid_gallery check(public.valid_gallery_images(gallery_images));
alter table public.programs add constraint programs_valid_gallery check(public.valid_gallery_images(gallery_images));

-- Append view columns, preserving migration 034 visibility/source rules exactly.
create or replace view public.published_news with (security_barrier=true) as
select n.slug,n.title,n.category,n.date,n.excerpt,n.image,n.content,n.is_sample,n.office_id,n.content_scope,n.published,n.sort_order,
 jsonb_build_object('name',case when n.barangay_id is not null then b.name else coalesce(d.name,'Municipal information portal') end,
  'slug',case when n.barangay_id is null and public.public_department_visible(d.id) then d.slug else null end) as source,
 n.id,n.rich_body,n.barangay_id,n.gallery_images
from public.news n left join public.departments d on d.id=n.office_id
 left join public.barangays b on b.id=n.barangay_id
where n.published and public.barangay_news_visible(n.barangay_id,n.office_id,n.content_scope);
create or replace view public.published_programs with (security_barrier=true) as
select p.id,p.slug,p.name,p.description,p.category,p.status,p.image,p.is_sample,p.office_id,p.content_scope,p.published,p.sort_order,
 jsonb_build_object('name',coalesce(d.name,'Municipal information portal'),
  'slug',case when public.public_department_visible(d.id) then d.slug else null end) as source,p.rich_body,p.gallery_images
from public.programs p left join public.departments d on d.id=p.office_id where p.published;

-- Reuse the private staging bucket and the same per-office content permissions.
-- News paths remain valid. Programs gain image uploads only for their editors.
create or replace function public.can_upload_news(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.departments d
 where d.id::text=split_part(p_name,'/',2)
 and split_part(p_name,'/',1) in ('news','programs')
 and split_part(p_name,'/',3)=(select auth.uid())::text
 and public.can_manage_collection(split_part(p_name,'/',1),d.department,d.id,'write'));
$$;
-- Never remove an image referenced by a cover or a gallery, including drafts.
create or replace function public.news_media_unreferenced(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.news where image_path=p_name or image like '%/municipal-media/'||p_name
  or exists(select 1 from unnest(gallery_images) photo where photo like '%/municipal-media/'||p_name))
 and not exists(select 1 from public.programs where image like '%/municipal-media/'||p_name
  or exists(select 1 from unnest(gallery_images) photo where photo like '%/municipal-media/'||p_name))
 and not exists(select 1 from public.sessions where image like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.departments where image_url like '%/municipal-media/'||p_name or head_photo like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.officials where photo_url like '%/municipal-media/'||p_name)
 and not exists(select 1 from public.legacy_department_profiles where head_photo like '%/municipal-media/'||p_name);
$$;
commit;
