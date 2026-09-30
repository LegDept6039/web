-- Initial municipal content schema. Run once on a new Supabase project.
-- Portable PostgreSQL tables; client roles have published SELECT access only.
begin;
grant usage on schema public to anon, authenticated;

create function public.portal_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.portal_touch_updated_at() from public, anon, authenticated;

create table public.officials (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  role text not null,
  branch text not null check (branch in ('executive', 'legislative')),
  description text not null,
  photo_url text,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.officials enable row level security;
revoke all on table public.officials from public, anon, authenticated;
grant select on table public.officials to anon, authenticated;
create policy published_read on public.officials
  for select to anon, authenticated using (published = true);
create index officials_published_order on public.officials (sort_order, id) where published = true;
create trigger update_timestamp before update on public.officials
  for each row execute function public.portal_touch_updated_at();

create table public.ordinances (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  number text not null,
  title text not null,
  date_approved date not null,
  year integer not null,
  author text not null,
  co_author text,
  status text not null,
  summary text not null,
  pdf_url text,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint year_matches_date check (year = extract(year from date_approved))
);
alter table public.ordinances enable row level security;
revoke all on table public.ordinances from public, anon, authenticated;
grant select on table public.ordinances to anon, authenticated;
create policy published_read on public.ordinances
  for select to anon, authenticated using (published = true);
create index ordinances_published_order on public.ordinances (sort_order, id) where published = true;
create trigger update_timestamp before update on public.ordinances
  for each row execute function public.portal_touch_updated_at();

create table public.resolutions (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  number text not null,
  title text not null,
  date_approved date not null,
  year integer not null,
  author text not null,
  co_author text,
  status text not null,
  summary text not null,
  pdf_url text,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint year_matches_date check (year = extract(year from date_approved))
);
alter table public.resolutions enable row level security;
revoke all on table public.resolutions from public, anon, authenticated;
grant select on table public.resolutions to anon, authenticated;
create policy published_read on public.resolutions
  for select to anon, authenticated using (published = true);
create index resolutions_published_order on public.resolutions (sort_order, id) where published = true;
create trigger update_timestamp before update on public.resolutions
  for each row execute function public.portal_touch_updated_at();

create table public.news (
  slug text not null primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  category text not null,
  date date not null,
  excerpt text not null,
  image text not null,
  content text[] not null default '{}'::text[],
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.news enable row level security;
revoke all on table public.news from public, anon, authenticated;
grant select on table public.news to anon, authenticated;
create policy published_read on public.news
  for select to anon, authenticated using (published = true);
create index news_published_order on public.news (sort_order, slug) where published = true;
create trigger update_timestamp before update on public.news
  for each row execute function public.portal_touch_updated_at();

create table public.sessions (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  number text not null,
  type text not null check (type in ('Regular session', 'Special session', 'Caucus meeting')),
  date date not null,
  description text not null,
  agenda text[] not null default '{}'::text[],
  image text not null,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sessions enable row level security;
revoke all on table public.sessions from public, anon, authenticated;
grant select on table public.sessions to anon, authenticated;
create policy published_read on public.sessions
  for select to anon, authenticated using (published = true);
create index sessions_published_order on public.sessions (sort_order, id) where published = true;
create trigger update_timestamp before update on public.sessions
  for each row execute function public.portal_touch_updated_at();

create table public.services (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null,
  icon text not null,
  office text not null,
  steps text[] not null default '{}'::text[],
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.services enable row level security;
revoke all on table public.services from public, anon, authenticated;
grant select on table public.services to anon, authenticated;
create policy published_read on public.services
  for select to anon, authenticated using (published = true);
create index services_published_order on public.services (sort_order, id) where published = true;
create trigger update_timestamp before update on public.services
  for each row execute function public.portal_touch_updated_at();

create table public.departments (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.departments enable row level security;
revoke all on table public.departments from public, anon, authenticated;
grant select on table public.departments to anon, authenticated;
create policy published_read on public.departments
  for select to anon, authenticated using (published = true);
create index departments_published_order on public.departments (sort_order, id) where published = true;
create trigger update_timestamp before update on public.departments
  for each row execute function public.portal_touch_updated_at();

create table public.programs (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null,
  category text not null,
  status text not null,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.programs enable row level security;
revoke all on table public.programs from public, anon, authenticated;
grant select on table public.programs to anon, authenticated;
create policy published_read on public.programs
  for select to anon, authenticated using (published = true);
create index programs_published_order on public.programs (sort_order, id) where published = true;
create trigger update_timestamp before update on public.programs
  for each row execute function public.portal_touch_updated_at();

create table public.committees (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  responsibility text not null,
  chair text not null,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.committees enable row level security;
revoke all on table public.committees from public, anon, authenticated;
grant select on table public.committees to anon, authenticated;
create policy published_read on public.committees
  for select to anon, authenticated using (published = true);
create index committees_published_order on public.committees (sort_order, id) where published = true;
create trigger update_timestamp before update on public.committees
  for each row execute function public.portal_touch_updated_at();

create table public.hearings (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  date date not null,
  venue text not null,
  sectors text not null,
  related_ordinance text not null,
  status text not null check (status in ('Upcoming', 'Previous')),
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hearings enable row level security;
revoke all on table public.hearings from public, anon, authenticated;
grant select on table public.hearings to anon, authenticated;
create policy published_read on public.hearings
  for select to anon, authenticated using (published = true);
create index hearings_published_order on public.hearings (sort_order, id) where published = true;
create trigger update_timestamp before update on public.hearings
  for each row execute function public.portal_touch_updated_at();

create table public.document_categories (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null,
  href text,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.document_categories enable row level security;
revoke all on table public.document_categories from public, anon, authenticated;
grant select on table public.document_categories to anon, authenticated;
create policy published_read on public.document_categories
  for select to anon, authenticated using (published = true);
create index document_categories_published_order on public.document_categories (sort_order, id) where published = true;
create trigger update_timestamp before update on public.document_categories
  for each row execute function public.portal_touch_updated_at();

create table public.municipal_documents (
  id text not null primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id text not null references public.document_categories(id) on delete restrict,
  title text not null,
  description text not null,
  date date not null,
  file_url text not null,
  is_sample boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.municipal_documents enable row level security;
revoke all on table public.municipal_documents from public, anon, authenticated;
grant select on table public.municipal_documents to anon, authenticated;
create policy published_read on public.municipal_documents
  for select to anon, authenticated using (published = true);
create index municipal_documents_published_order on public.municipal_documents (sort_order, id) where published = true;
create trigger update_timestamp before update on public.municipal_documents
  for each row execute function public.portal_touch_updated_at();

commit;
