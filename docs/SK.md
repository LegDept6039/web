# SK profiles

The public header's **Barangays** dropdown contains **Barangay** (`/barangays`) and **SK** (`/sk`). The dashboard has corresponding management links. `/sk` lists published Sangguniang Kabataan profiles; `/sk/[slug]` shows the linked barangay, SK chairperson, square image and formatted body. Public profiles require both the SK profile and its barangay to be published. Unpublishing a barangay hides its SK page without deleting either record.

Only active Superadmins can create or edit SK profiles through `/superadmin/barangays/sk`. Server Actions and database RLS independently enforce this restriction. SK profiles are public content, not departments, staff memberships or new access roles. Each barangay has at most one current SK profile. Create the barangay first, then select it in the SK editor. Profiles created through the editor default to drafts; unpublish them to retain their ID, content and image while removing them from public view.

Selecting the linked barangay is required; the chairperson, image and formatted body are optional and can be completed later. An omitted or blank display order defaults to zero. Public cards still show their SK/barangay name and square image placeholder when the remaining fields are blank. Empty leadership and excerpt sections are hidden, and details without a body show a short notice that more information will be added later.

The server creates a stable page address from the verified barangay name. Editors do not enter a URL name, and existing addresses remain unchanged when the barangay or chairperson is renamed. Concurrent edits use `updated_at` checks. Images are optional; validated uploads are cropped to a centered 1:1 WebP, at most 1200 by 1200 pixels. Missing or broken images use a square placeholder. Referenced images remain in storage on replacement or removal; only newly uploaded, unreferenced files from failed saves may be cleaned up.

## Database setup

Run the contents of [migration 029](../supabase/migrations/202611220029_sk_profiles.sql) after migration 028. It creates the empty `sk_profiles` table, a unique barangay relationship, publication/read policies, active-Superadmin write policies, audit/timestamp triggers and image policies under `municipal-media/sk/<user-id>/`. It does not modify existing barangays, departments, assignments, content or files. It grants no delete permission and does not cascade deletion from barangays.

Run [migration 030](../supabase/migrations/202611230030_barangay_sk_seed.sql) after 029 to permit blank captain/chairperson names and bodies and add the 26 named barangays with matching SK profiles. Newly inserted profiles are published with empty leader names, images and bodies. Existing details, page addresses and publication statuses are preserved. A new SK profile linked to an existing unpublished barangay remains hidden publicly until that barangay is published.

Apply these migrations to the hosted database for the corresponding features and seed records to appear there. Repository tests apply them only to an isolated local database; they do not apply hosted migrations. The editor explains the required setup if the collection is missing. No chairperson names or descriptive content are invented.

Focused local data verification: `npx playwright test --config playwright.data.config.ts sk-profiles.spec.ts`. These tests exercise real SQL migrations, preservation, RLS, active-account revocation, publication of both related records, foreign-key/uniqueness constraints, media retention, rich-text validation and the public adapter. UI checks use the isolated Supabase transport and do not verify the hosted database.
