begin;
-- Apply after 026. Services share the validated text/list format used by News
-- and Programs. Existing plain bodies, legacy descriptions/steps, ownership,
-- publication, identifiers, files and audit history remain unchanged.
alter table public.services add column rich_body jsonb;
alter table public.services add constraint valid_rich_body check (
 rich_body is null or (
  octet_length(rich_body::text)<=200000
  and rich_body->>'type'='doc'
  and public.portal_valid_rich_node(rich_body)
 )
);
commit;
