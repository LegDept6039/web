# Current schema and media

Use `lib/content/schema.ts`, `types/index.ts` and migrations 009-010 as the source of exact mappings; do not substitute conceptual names from older requests.

| Concept | Existing representation |
| --- | --- |
| Department identity | `departments.id` UUID; name, `short_name` (acronym), unique slug |
| Branch | `departments.department` = executive/legislative |
| Page/head | description, body, image_url, head_name, head_title, head_photo, head_description |
| State/order | active, published, archived_at, is_sample, sort_order, timestamps |
| Staff/membership | `staff_accounts`; `user_office_access(user_id, office_id, permission_level)` |
| Owned content | Existing `news`, `programs`, `department_contacts`, using office_id + content_scope |
| Compatibility | Generated Department office_id=self and content_scope=branch; `offices` view; private `legacy_department_profiles`; legacy_profile_id edit lookup |
| Slug history | `department_slug_aliases` retains old slugs for redirects |

Department heads are inline reusable fields, not separate per-office tables. Contacts have type PHONE/LANDLINE/EMAIL/LOCATION, value, optional label, sort_order, publication/sample flags and timestamps. Multiple contacts per type are supported; hide empty public categories. Office hours/social contacts would require an explicit schema/UI change, not a guessed existing field.

Public access: `lib/api` -> cached-per-request repository -> published Supabase adapter -> typed decoder. Department detail uses slug filters and alias lookup; related content uses UUID filters. `published_news` is the public news projection with source information. Apply active/nonarchived/published Executive filtering for Department pages. Deactivation hides department pages/contacts but does not automatically unpublish general news.

Media: `lib/admin/photo.ts` validates nonanimated JPEG/PNG/WebP, max 2 MB each, re-encodes with Sharp to WebP, and uploads under user-owned paths in `municipal-media`. Server Actions permit 5 MB for two images. Preserve referenced current/archived media; clean up newly uploaded files after failed saves. Shared directory fallback: `public/images/department-placeholder.svg`; head photos use OfficialPhoto's silhouette. The public bucket is unsuitable for confidential files.
