begin;
-- Apply after 034. This preference controls only the head portrait on a
-- department's own page. The department directory always keeps its portrait.
-- The default preserves every existing page. No content, identity, membership,
-- file reference, timestamp, policy or trigger is changed by this migration.
alter table public.departments
 add column show_head_photo_on_page boolean not null default true;
commit;
