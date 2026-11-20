# Department Services

Apply the **contents** of `supabase/migrations/202611200025_department_services.sql` after migration 024 before using this application version. The hosted migration is not applied by this implementation.

In **Admin > Offices > [Department] > Services**, select **Add record**. Enter a **Title** (up to 300 characters) and **Body** (up to 30,000 characters). There is no service date. Body line breaks are preserved. Choose Published and the display position when ready; unpublished services remain drafts. The owning department is supplied by the selected workspace.

Assigned department Admins and Editors can create, edit, publish and delete services. Assigned Viewers can read records in the CMS. Superadmins retain full access and can select the owning department. Database policies and server actions enforce these limits.

Published services appear in a compact expandable **Department Services** section on that department's public page and in the existing `/services` directory. Empty department service sections are hidden. A service is public only while its owning department is active, published and not archived. Public reads use the existing uncached published-content adapter, so saves and unpublishing are reflected on the next request.

The migration extends the existing `services` table with an optional stored body and a UUID default for new IDs. Existing service IDs, legacy descriptions/steps, publication states, ownership and history are preserved. Existing services without a body continue to display their description and steps; the editor combines those into an initial body. Saving a legacy service deliberately adopts it into an owning department. Renaming a service keeps its URL. Existing ordering, audit, pagination and ownership mechanisms are reused.

Service detail pages use request-time rendering. Their previous empty `generateStaticParams` list triggered a static-rendering conflict with the live content adapter on new detail URLs in production; removing that override aligns services with the other CMS detail routes.

## Verification

Production build (including TypeScript), full lint with targeted lint after final edits, and all 193 data tests passed. The data suite includes 12 new service validation and real-migration cases covering preservation, permissions, publication, ordering and ownership. Four desktop/mobile service workflows and two department-navigation regressions passed across the final targeted runs using the isolated Supabase transport fixture. They cover creation, editing, stable URLs, live public changes, draft exclusion, unpublishing, viewer restrictions, forged-owner rejection, multiline text, no date field and no horizontal overflow. Desktop/mobile screenshots were reviewed. Windows test-server teardown required stopping the verified temporary port-3003 processes after assertions completed. No hosted database migration or deployment was performed.
