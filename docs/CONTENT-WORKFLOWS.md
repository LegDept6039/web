# Department, program and news workflows (migration 011)

Current publication, ordering, rich-text editing and office-navigation behavior is documented in [Admin authoring (migration 012)](ADMIN-AUTHORING.md). Apply 012 after 011 for this application version.
## Apply before deploying this version

After migrations 001–010, run the **contents** of `supabase/migrations/202610080011_content_workflows.sql` in Supabase SQL Editor. Do not paste its filename or rerun the historical seed. Then deploy the application and run `npm run db:check` with the target environment configured. No live migration or deployment was performed during this implementation.

The guarded migration keeps existing department publication flags, program IDs, news slugs, ownership, timestamps, and image references. It adds a unique immutable news UUID, database-generated IDs for new programs, globally unique program slugs, an optional program image, and news image path/MIME/size metadata. Existing program slugs start with their existing ID. News slugs retain their existing uniqueness constraint/primary key for compatibility; administration uses the new unique UUID. No records are deleted or reassigned. Unassigned historical records remain preserved; the normal ownership guard still requires an office before they can be edited.

## Findings and changes

- Department publication already existed in the database, Superadmin form, public adapter and RLS. The management table lacked a publication column. It now shows explicit Published/Unpublished indicators. Unpublishing does not deactivate the department or revoke assigned staff access.
- `department-page-and-head` was not a recognized collection name and therefore returned not-found. It now resolves to the existing departments collection, with the same membership filtering and authorized edit form. Current sidebar links continue to use canonical department UUIDs.
- News administration previously used the public slug as its record key. It now uses a stable UUID for listing/edit/update/delete, so changing the public slug does not invalidate the edit URL. Old slug-based edit bookmarks resolve to the UUID after authorization. Program edits retain the existing stable ID.
- The checked-in generic edit route already existed for news and programs. An independent missing-route cause for the reported deployed 404s was not established; the completed create/list/edit/update/reload browser tests exercise the current implementation. Missing records and unauthorized ownership still intentionally return not-found. Do not bypass authorization to hide these failures.
- Programs had a required manual ID field and no public detail route. New program IDs now come from PostgreSQL; the form ignores client IDs. `/programs` and `/programs/[slug]` reuse the established layout and published-content adapter. Program cards, including the Executive directory, link to the detail route. Invalid, missing and unpublished records return not-found. Slugs are unique across all departments.
- News had only an image URL text field. It now supports image selection, preview, client validation, authenticated upload preparation, server byte validation and image replacement. Successful saves show a status message and refresh the collection; optimistic `updated_at` conflict checks remain in place.

## Storage and upload sequence

Migration 011 creates private `municipal-news-staging` with JPEG/PNG MIME restrictions and a 10 MiB file limit. It reuses public `municipal-media` for validated final images. The existing public bucket must retain JPEG/PNG in its allowed MIME types (migration 002 supplies them). Ensure the project's global Storage upload limit is at least 10 MiB. Existing server-only environment variables remain valid; this flow uses the user's session and RLS, not the service-role key.

The browser requests a signed URL from `/admin/news-upload`; that endpoint verifies origin, staff access, live department ownership and existing record access. The file is sent directly to private Storage. Only its generated path is sent through the Server Action. This avoids routing 10 MiB through Vercel's [function payload limit](https://vercel.com/docs/functions/limitations); signing uses Supabase's [signed-upload API](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).

Before saving, the server checks the staged path against the authenticated user and authorized department, downloads and decodes actual bytes with Sharp, rejects unreadable/animated/unsupported images, enforces 10 MiB and a 40-megapixel decoding limit, and re-encodes to the actual JPEG or PNG format. JPEG stays `.jpg`; PNG stays `.png`. Metadata is stripped by re-encoding.

For new news, a UUID is allocated on the server before upload and the same UUID is inserted into the record; the client cannot choose it. This allows a single record insert after a successful upload, without creating incomplete draft rows. The final path is:

```text
news/<department UUID>/<authenticated user UUID>/<version UUID>/<department>_news_<slug>_<record UUID>.jpg
```

The normalized acronym (or department slug), content slug and actual record UUID form the basename. PNG uses `.png`. A fresh version directory prevents collisions and stale replacement caches. The action preserves the existing image until the database update succeeds, stores URL/path/MIME/size together, and attempts removal of the newly uploaded file if saving fails. Consumed staging files are removed even when byte validation fails. Storage RLS limits paths to the caller's authorized department and protects referenced final images from deletion.

Old final images are deliberately retained, including shared assets. Interrupted browser uploads or failures before the save action reaches validation can leave private staging objects; periodically remove staging objects older than one day through the Storage API/dashboard. Do not delete `storage.objects` rows directly. Cleanup failure cannot replace a working database reference with a missing image, but may leave an unreferenced file requiring later cleanup. The public bucket remains unsuitable for confidential draft imagery.

## Main files

- Migration: `supabase/migrations/202610080011_content_workflows.sql`.
- Admin: `app/superadmin/departments/page.tsx`, `app/staff.css`, `app/admin/content/ContentForm.tsx`, `actions.ts`, collection list/edit pages, `app/admin/news-upload/route.ts`, `lib/admin/content.ts`, `lib/admin/news-image.ts`, `lib/admin/news-image-validation.ts`.
- Public/data: `app/(public)/programs/{page.tsx,[slug]/page.tsx}`, Executive programs page, `components/departments/DepartmentGrid.tsx`, `lib/api/index.ts`, `lib/content/{schema,supabase}.ts`, `types/index.ts`, `scripts/check-supabase.mjs`. The new `published_programs` projection includes the responsible office name without linking to unpublished department pages.
- Checks: `tests/content-workflows.spec.ts`, `tests/data/content-workflows.spec.ts`, `tests/data/news-image.spec.ts`, administration config and Supabase transport fixture. Historical SQL tests explicitly retain their old news slug key for the migration versions they test.

## Verification

Local tests use PGlite for real SQL/RLS and an isolated Supabase transport for browser workflows; they do not establish hosted Supabase or Vercel behavior.

- All 101 data tests passed, including migration rerun/preservation, stable IDs, unique slugs, publication, upload RLS and byte validation at the 10 MiB boundary.
- Production build, TypeScript and lint checks passed.
- The three new workflows passed on desktop and mobile: program create/edit/slug changes/draft blocking, news upload/replacement/stable edit URLs/cross-department denial, and department publication/page/head editing.
- The final mobile run also passed all three existing department admin scenarios: six tests passed with a clean exit, including office-specific navigation, Legislative navigation and department/news/program editing.
- All 14 public desktop/mobile regression assertions passed. Reviewed the mobile program detail screenshot and checked horizontal overflow.
- Some Windows browser-server teardown runs needed interruption after assertions. A trace-writing ENOSPC error was resolved by removing only generated production build cache; the subsequent build passed. Sandbox helper initialization failed on resume; remaining checks ran through approved execution outside that sandbox.

The browser Storage transport is simulated. Actual byte validation tests use Sharp, and actual SQL policy tests use PGlite. Perform one real hosted upload and edit check after applying migration 011 and deploying; no live upload, live migration, or deployment was performed here.

## Image save/display follow-up

A read-only check on 2026-10-08 confirmed the configured project's public media bucket, private news staging bucket, allowed image types and 10 MiB limits. The built image hostname matched that project. At the time of the check, none of its six news or eighteen department records had a remote image reference; this is not evidence that Vercel uses the same environment.

The department detail page omitted `image_url` entirely and displayed only the head photo. It now renders the saved department image above the head section. Superadmin department forms now preview both selected and saved images.

The content creation page supplied only Executive offices to its form, even in Legislative workflows. Legislative news upload preparation therefore lacked the owning department. It now supplies authorized offices from the selected branch. Form instances are keyed by record/office so an unsaved selection cannot carry into a different record.

React resets native file inputs after a Server Action returns a validation error. Previously the preview remained visible while a retry could submit no file. Content and Superadmin department forms now retain selected files across retries, matching their previews. Server-side file reading uses the FormData file interface rather than a realm-specific `instanceof File` check; malformed attachments fail explicitly instead of being silently skipped, while empty native file inputs remain optional. Department image selection now validates its existing 2 MiB/type limit immediately. News retains its 10 MiB limit.

These fixes need an application update, not a new SQL migration. Reopen the affected record, select the image again and save; a previous save with no stored image reference cannot recover the original file. Local browser fixtures explicitly exercise news and department validation-error retries and the public department image. Live data was inspected but not changed.

## Photo size limit

Official photos, department images and department-head photos now accept JPEG/PNG/WebP files up to 10 MiB each. News remains at 10 MiB. Server validation and client labels use the same limit. Local/self-hosted Server Actions allow 22 MiB for two department photos plus form data. Restart the app after this configuration change.

Vercel still caps function requests at 4.5 MB. The new request setting does not override that platform limit: department/official photos above that request size need a direct-to-Storage flow before they can work on Vercel. News already uses direct Storage uploads. No database migration is required for this size setting; migration 011 already allows 10 MiB in the media bucket.

## Activities navigation and filtering

`/activities` and `/executive/activities` now filter published Executive news using department UUIDs from the public department directory. Editorial category remains independent. Existing ownership enforcement and source attribution are unchanged. See [UI and navigation improvements](UI-NAVIGATION.md).
