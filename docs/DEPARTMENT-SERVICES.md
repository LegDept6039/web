# Department Services

The Services collection requires migration 025 after 024. Formatted service bodies also require the **contents** of `supabase/migrations/202611200027_service_rich_text.sql`, applied after migration 026 before deploying this application version. No hosted migration is applied by this implementation.

In **Admin > Offices > [Department] > Services**, select **Add record**. Enter a **Title** (up to 300 characters) and **Body** (up to 30,000 text characters). The Body uses the same editor as News: bold, italic, underline, bullet and numbered lists, paragraph sizes, undo/redo and clear formatting. Pasting uses plain text. There is no service date. Body line breaks are preserved. Choose Published and the display position when ready; unpublished services remain drafts. The owning department is supplied by the selected workspace.

Assigned department Admins and Editors can create, edit, publish and delete services. Assigned Viewers can read records in the CMS. Superadmins retain full access and can select the owning department. Database policies and server actions enforce these limits.

Published services appear in a compact expandable **Department Services** section on that department's public page and in the existing `/services` directory. Empty department service sections are hidden. A service is public only while its owning department is active, published and not archived. Public reads use the existing uncached published-content adapter, so saves and unpublishing are reflected on the next request.

The `/services` directory displays four compact cards per row on desktop and fewer columns on smaller screens. Search matches service titles, summaries and department names immediately. The Department dropdown lists public CMS departments alphabetically and filters by their stable office IDs; renaming a department does not break the filter. **Clear filters** resets both controls. Legacy services without an office assignment remain visible under **All departments**. This interface change needs no additional migration.

The migration extends the existing `services` table with an optional stored body and a UUID default for new IDs. Existing service IDs, legacy descriptions/steps, publication states, ownership and history are preserved. Existing services without a body continue to display their description and steps; the editor combines those into an initial body. Saving a legacy service deliberately adopts it into an owning department. Renaming a service keeps its URL. Existing ordering, audit, pagination and ownership mechanisms are reused.

Migration 027 adds nullable `rich_body` JSON without rewriting existing records. The server validates the same supported formatting as News, saves the structured document, and derives plain `body` and compact `description` from it for previews and search. Public service detail pages and department service cards use the shared safe renderer; raw HTML is never rendered. Existing unedited plain bodies retain their original display, and opening old text in the editor preserves blank lines. Viewers cannot edit or use formatting controls.

Service detail pages use request-time rendering. Their previous empty `generateStaticParams` list triggered a static-rendering conflict with the live content adapter on new detail URLs in production; removing that override aligns services with the other CMS detail routes.

## Verification

For the rich-text update, 37 focused data tests passed, including real migration 027 checks, legacy preservation, formatting validation, publication privacy and office permissions. Production build (including TypeScript) and full lint passed. All six desktop/mobile browser scenarios passed with the isolated Supabase transport fixture, covering formatting, save/reopen, public rendering, legacy paragraphs, viewer restrictions and directory filtering. Screenshots were reviewed on both sizes. The browser command was interrupted during Windows teardown after all assertions passed (exit 1); its temporary port 3003 was confirmed stopped. No live Supabase data was changed.

Earlier service implementation validation:

Production build (including TypeScript), full lint with targeted lint after final edits, and all 193 data tests passed. The data suite includes 12 new service validation and real-migration cases covering preservation, permissions, publication, ordering and ownership. Four desktop/mobile service workflows and two department-navigation regressions passed across the final targeted runs using the isolated Supabase transport fixture. They cover creation, editing, stable URLs, live public changes, draft exclusion, unpublishing, viewer restrictions, forged-owner rejection, multiline text, no date field and no horizontal overflow. Desktop/mobile screenshots were reviewed. Windows test-server teardown required stopping the verified temporary port-3003 processes after assertions completed. No hosted database migration or deployment was performed.
