-- Public files only. Never upload private drafts or personal records to this bucket.
-- Use the Supabase Dashboard to upload files; no website upload permissions are granted.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('municipal-media', 'municipal-media', true, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy municipal_media_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'municipal-media');
commit;
