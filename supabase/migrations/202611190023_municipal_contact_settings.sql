begin;
-- Apply after 022. This shared municipal contact section is independent of
-- department-owned contacts; no existing content, assignments or files change.
create table public.municipal_contact_settings (
 id text primary key default 'municipal' check (id = 'municipal'),
 municipality_name text not null check (length(trim(municipality_name)) >= 1 and length(municipality_name) <= 160),
 address text not null check (length(trim(address)) >= 1 and length(address) <= 1000),
 telephone text check (telephone is null or (length(trim(telephone)) >= 1 and length(telephone) <= 100)),
 email text check (email is null or (
  length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 )),
 office_hours text check (office_hours is null or (length(trim(office_hours)) >= 1 and length(office_hours) <= 1000)),
 social_label text check (social_label is null or (length(trim(social_label)) >= 1 and length(social_label) <= 100)),
 social_url text check (social_url is null or (
  length(social_url) between 1 and 2048
  and social_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]<>"\\]*)?$'
 )),
 map_embed_url text check (map_embed_url is null or (
  length(map_embed_url) between 1 and 4096
  and map_embed_url ~ '^https://www[.]google[.]com/maps/embed[?]pb=[^&#[:space:]<>"\\]+(&[^#[:space:]<>"\\]+)*$'
 )),
 updated_at timestamptz not null default now()
);
alter table public.municipal_contact_settings enable row level security;
revoke all on public.municipal_contact_settings from public, anon, authenticated;
grant select on public.municipal_contact_settings to anon, authenticated;
grant update on public.municipal_contact_settings to authenticated;
create policy municipal_contact_read on public.municipal_contact_settings
 for select to anon, authenticated using (true);
create policy municipal_contact_update on public.municipal_contact_settings
 for update to authenticated using ((select public.is_superadmin()))
 with check ((select public.is_superadmin()));
create trigger municipal_contact_timestamp before update on public.municipal_contact_settings
 for each row execute function public.portal_touch_updated_at();
create trigger municipal_contact_audit after update on public.municipal_contact_settings
 for each row execute function public.portal_audit();

-- Initial values reproduce the current public address and the supplied map.
-- No unverified telephone, email, hours or social accounts are introduced.
insert into public.municipal_contact_settings(municipality_name, address, map_embed_url)
values (
 'Municipality of Pinamungajan',
 E'Municipal Hall\nPinamungajan, Cebu\nPhilippines',
 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d635.3927542769925!2d123.58431921186467!3d10.270176820265034!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a96f90bd4bd703%3A0x7e7ba0656a6eb073!2sPinamungajan%20Municipal%20Hall!5e1!3m2!1sen!2sph!4v1795094335905!5m2!1sen!2sph'
);
commit;
