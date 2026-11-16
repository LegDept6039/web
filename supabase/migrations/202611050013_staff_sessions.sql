-- Apply after 012, before deploying the matching application. No content is modified.
begin;
create table public.staff_browser_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (clock_timestamp() + interval '60 minutes')
);
create index staff_browser_sessions_user on public.staff_browser_sessions(user_id);
alter table public.staff_browser_sessions enable row level security;
revoke all on public.staff_browser_sessions from public, anon, authenticated;
-- RPCs expose only the caller's opaque session, never the token or another user's rows.
create function public.start_staff_session(p_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.staff_accounts where user_id=auth.uid() and active and deleted_at is null
  ) then return false; end if;
  delete from public.staff_browser_sessions where user_id=auth.uid() and expires_at <= clock_timestamp();
  insert into public.staff_browser_sessions(token_hash,user_id) values(p_hash,auth.uid());
  return true;
end $$;
create function public.staff_session_deadline(p_hash text, p_touch boolean default false) returns double precision
language plpgsql security definer set search_path = '' as $$
declare deadline timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.staff_accounts where user_id=auth.uid() and active and deleted_at is null
  ) then return null; end if;
  if p_touch then
    update public.staff_browser_sessions set expires_at=clock_timestamp()+interval '60 minutes'
    where token_hash=p_hash and user_id=auth.uid() and expires_at>clock_timestamp()
    returning expires_at into deadline;
  else
    select expires_at into deadline from public.staff_browser_sessions
    where token_hash=p_hash and user_id=auth.uid() and expires_at>clock_timestamp();
  end if;
  return greatest(0, extract(epoch from (deadline-clock_timestamp()))*1000);
end $$;
create function public.end_staff_session(p_hash text) returns void
language sql security definer set search_path = '' as $$
  delete from public.staff_browser_sessions where token_hash=p_hash and user_id=auth.uid();
$$;
revoke all on function public.start_staff_session(text), public.staff_session_deadline(text,boolean), public.end_staff_session(text) from public,anon;
grant execute on function public.start_staff_session(text), public.staff_session_deadline(text,boolean), public.end_staff_session(text) to authenticated;
commit;
