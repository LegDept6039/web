begin;
-- Apply after 023. Reuse contact labels and values; existing contacts, ownership,
-- publication rules, permissions and identifiers remain unchanged.
alter table public.department_contacts drop constraint department_contacts_type_check;
alter table public.department_contacts add constraint department_contacts_type_check
 check (type in ('PHONE','LANDLINE','EMAIL','LOCATION','SOCIAL'));
alter table public.department_contacts add constraint department_contacts_social_link
 check (type <> 'SOCIAL' or (
  label is not null and label ~ '[^[:space:]]' and length(label) <= 100
  and length(value) <= 1000
  and value ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]<>"''\\]*)?$'
 ));
commit;
