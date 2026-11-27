# Service forms, photo galleries and contact numbers

The shared CMS supports the same features for authorized Admin and Superadmin users. Existing office assignments and content permissions still apply.

- **Services:** optionally upload one PDF form, up to 10 MB. The public service and department service list show a download link. The editor can replace or remove the link. Files remain private; a public download checks the service and owning department's current publication and visibility. Staff previews require the existing read permission. Previous attached versions remain preserved.
- **News and programs:** upload a featured JPG/PNG plus up to 12 additional JPG/PNG photos, 10 MB each. Existing covers remain unchanged until replaced. Remove extra photos individually in the editor. Public detail pages show the cover first, arrows, thumbnails and a photo count; one photo omits unnecessary controls. Galleries support keyboard navigation and mobile screens.
- **Contacts:** Phone shows a fixed `(+63)` prefix with exactly 10 digits. Pasting a numeric `09…` or `+63…` number normalizes the value. Saves use `+63##########`. Landline and municipal Telephone inputs accept digits only. Server validation rejects letters independently of browser checks. Existing stored numbers are not rewritten by this update.

## Database deployment

These schema changes are prepared locally and are **not applied to hosted Supabase automatically**. After confirming migration 037 is installed, run the **contents** of these files in Supabase SQL Editor, in order, then deploy the corresponding application version:

1. `supabase/migrations/202611270038_service_form_attachments.sql`
2. `supabase/migrations/202611270039_content_photo_galleries.sql`

Migration 038 adds optional service form references, a private PDF bucket and storage policies based on existing content access. A reference ledger preserves previously attached versions. Migration 039 adds optional gallery URL arrays to news/programs, appends them to existing published views and permits program photo uploads through the existing private image staging flow. Cover, ownership, source-link and publication rules are retained. The gallery cleanup guard also protects files referenced by draft galleries.

Neither migration changes existing IDs, text, ownership, authorship, staff assignments, publication settings, order or uploaded files. New columns default to empty/null. These migrations require 037 and their earlier dependencies; they are one-time incremental migrations, not rerunnable imports.

Public content reads remain fresh. PDF downloads and staff responses use no shared cache. This work does not add a cache, change infrastructure or perform hosted content writes.

## Local checks

Production build and TypeScript, scoped lint, PGlite migration/RLS tests, upload validation tests, and isolated desktop/mobile CMS/public browser scenarios cover the new behavior. Browser fixtures do not verify the hosted project; a hosted smoke check is still needed after the migrations and application are deployed.
