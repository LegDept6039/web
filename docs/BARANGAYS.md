# Barangay directory

The public **Barangays** dropdown appears immediately before **Contact**, with **Barangay** and **SK** links. `/barangays` lists published profiles; `/barangays/[slug]` shows the barangay image, captain and formatted body. Uploaded images are cropped to a centered 1:1 WebP, at most 1200 × 1200 pixels. Missing/broken images use a square placeholder.

Only active Superadmins can manage profiles through **Superadmin > Barangays > Barangay** (`/superadmin/barangays`). The same dashboard dropdown includes **SK**, with a separate [SK profile editor](SK.md). Server Actions and database RLS independently enforce this restriction. Barangays are public content, not departments or staff memberships; this feature grants no new office access.

Only the barangay name is required. The captain, image and formatted body can be left blank and completed later; an omitted or blank display order defaults to zero. The server generates the page address from the name and adds a unique suffix when necessary; there is no URL-name field. Existing page addresses remain stable when names or captains change. Profiles created through the editor default to drafts. Check **Published** to show them publicly; unpublish to hide a profile while preserving its ID, content and image. Concurrent edits are checked using `updated_at`.

Public cards and pages remain available with just a name and a square image placeholder. Empty captain and excerpt sections are hidden; details without a body show a short notice that more information will be added later. No leader names or descriptive content are invented.

## Database setup

Run the contents of [migration 028](../supabase/migrations/202611210028_barangays.sql) after migration 027. It creates the empty `barangays` collection, publication/read policies, Superadmin write policies, audit/timestamp triggers and restricted image-upload/failed-upload-cleanup policies in the existing `municipal-media` bucket. It does not modify existing records, accounts, assignments or files.

Apply [migration 029](../supabase/migrations/202611220029_sk_profiles.sql) next for the linked SK collection, then [migration 030](../supabase/migrations/202611230030_barangay_sk_seed.sql). Migration 030 permits blank captain/chairperson names and bodies and adds the 26 named barangays with matching SK profiles. Newly inserted profiles are published with blank leader names, images and bodies, so the directories can display their names immediately. Existing profile details, page addresses and publication statuses are preserved. This migration does not create staff accounts or change department access.

These migrations must be applied to the hosted database for the corresponding features and seed records to appear there. Repository tests use an isolated local database; they do not apply hosted migrations. Before setup, the Superadmin list explains the required migration and the public directory shows its empty state.

Referenced images are retained on replacement or removal; only new, unreferenced uploads from a failed save may be cleaned up. The media bucket is public. The editor accepts non-animated JPEG, PNG and WebP images up to 10 MB and validates actual image contents before re-encoding.

Verification: `npm run build`, `npm run lint`, `npx playwright test --config playwright.data.config.ts barangays.spec.ts`, and `npx playwright test --config playwright.administration.config.ts barangays-admin.spec.ts`. Data tests exercise real migrations, RLS, publication visibility, media protection, rich-content validation and preservation. Browser tests use isolated Supabase transport and cover desktop/mobile editing, square geometry, public navigation, publishing and staff denial.
