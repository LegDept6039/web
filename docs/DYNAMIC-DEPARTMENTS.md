# Dynamic departments (migrations 009-010)

Current publication, ordering, rich-text editing and office-navigation behavior is documented in [Admin authoring (migration 012)](ADMIN-AUTHORING.md). Apply 012 after 011 for this application version.
## Finalized workflow (migration 010)

Apply the **contents** of `supabase/migrations/202610050010_department_identity.sql` after migration 009, then deploy this application version. This update has not been applied to live Supabase or deployed to production.

Department creation exists only at `/superadmin/departments/new`. The Superadmin form now includes identity, description/body, department image, head name/title/photo/description, active/published status and display order. Uploads use the existing validation and Storage pipeline; failed saves clean up newly uploaded files. Existing images remain referenced unless explicitly replaced or removed.

Only an active Superadmin can create departments or change their name, acronym, slug, publication, active state and display order. Migration 010 replaces the existing protection trigger; it preserves UUIDs, memberships, content and uploaded files. Existing RLS restricts inserts to active Superadmins. Non-Superadmin identity updates raise SQLSTATE 42501, as used by PostgREST for HTTP 403. Permanent deletion remains blocked.

`/admin` is for content editing. It has no department creation entry point, and its department form excludes identity/publication settings, including for Superadmins (use `/superadmin` for those settings). Server Actions reject forged creation and identity changes. Editors retain their assigned department description, body, head, image, news, program and contact editing permissions. Legislative Access and the existing role enum are unchanged.

The shared public detail page displays head photo on the left, title/name/description on the right, followed by body, owned news, programs and contacts. It queries the live department by slug, resolves preserved aliases, and filters nested content by department UUID at the database request. Missing, inactive and unpublished departments remain unavailable. The directory retains department images and one shared placeholder, with no production fallback registry.

## Upgrade

Apply the **contents** of `supabase/migrations/202610020009_dynamic_departments.sql` in Supabase SQL Editor after migrations 001-008, then deploy this application version. No live migration or deployment was performed by this implementation. Existing environment variables remain valid. Supabase is now the default content source; `CONTENT_SOURCE=mock` must be explicitly requested for an isolated preview/test environment.

The optional historical seed belongs before migration 008. Do not run that old seed against the consolidated schema.

## One live Department model

The former `offices` identity table is extended and renamed to `departments`. Its UUIDs are unchanged, so existing `user_office_access.office_id`, news/program ownership, all Legislative content ownership, and foreign keys continue to reference the **same rows**, now in `departments`. The historical column name `office_id` is retained for compatibility; it is a Department foreign key, not a second Office model. Existing multi-office assignments remain supported.

The former profile table becomes `legacy_department_profiles`, inaccessible to anonymous/authenticated clients. Its rows, original profile IDs and photo URLs are retained; previously unassigned ownership is backfilled during consolidation. Profile name, slug, description, head data, publication/sample flags and display order are copied to the live Department record. Existing content and uploaded files are not deleted. An `offices` compatibility **view** exposes the existing shape to older database helpers; application management reads/writes the live `departments` table.

The migration aborts and rolls back if multiple old profiles reference one office, or if preserved slugs conflict. Review those records before retrying; the migration does not silently pick a department head or discard information. Previously unassigned profiles receive their own identity. Old office slugs are retained in `department_slug_aliases`, and future slug changes retain redirects.

The live record includes name, acronym (`short_name`), unique slug, short description (`description`), body, department image, head name/title/photo/description, active/publication status and order. Heads reuse the existing inline fields rather than adding office-specific tables. Canonical IDs are UUIDs; existing profile-edit bookmarks resolve through `legacy_profile_id`.

## Workflow

1. Open **Superadmin > Departments > Add Department**.
2. Enter the name, acronym, slug and description. New records default to active and published, immediately enabling the shared public route and access options.
3. Fill in body, images and head information in the same form. Later content updates can also use **Page, head & images**; identity/publication settings stay in Superadmin. Existing migrated drafts remain drafts until deliberately published.
4. Open User Management. **Office Access** is populated from active Department records. Select the department and the Editor role. New Editor assignments receive editor access automatically; existing memberships remain unchanged during migration. Saving an account aligns its selected office levels with its role (viewer/editor/manager); inactive office assignments are removed with a visible notice.
5. The editor sees only assigned departments and their page/head, news, programs and contacts. Multi-office staff can choose only assigned offices. Superadmins need no assignment.

Department deactivation preserves identities, assignments and content, removes the public department page and access options, and immediately revokes staff editing. Permanent Department deletion is blocked in the database. Previously published news remains available on general news pages until unpublished; it cannot link to an inactive department page.

## Routes and UI

- `/departments`: active, published Executive departments, database acronym/name/description/image, shared image placeholder.
- `/departments/[slug]`: one reusable page for header/image, head, about/body, owned news, programs and contacts. Missing/inactive/unpublished records use not-found.
- `/executive/department`, `/executive/departments`, and the old detail route redirect to the canonical routes. Old aliases resolve to the current slug.
- `/superadmin/departments`: unified identity/access administration; older `/superadmin/offices` URLs redirect.
- Department forms reuse `/admin/content/departments/edit/[id]`; contacts use the existing generic collection routes.

No department-specific routes, office arrays, role names, sidebar implementations or authorization branches were added. `data/departments.ts` was removed. Explicit mock mode has an empty department directory; known names in historical SQL migrations/seeds and isolated tests are data fixtures, not production registries.

## Contacts and images

`department_contacts.office_id` references the live Department. Each record has type (`PHONE`, `LANDLINE`, `EMAIL`, `LOCATION`), value, optional label, order, publication status and timestamps. Multiple records of each type are supported. Public contact groups are rendered only when nonempty; phone/email links are generated from the values. Contacts are not exposed for inactive departments.

Department and head uploads reuse the municipal-media bucket and existing JPEG/PNG/WebP validation and WebP conversion. Each image is limited to 2 MB; the server action request limit is 5 MB to accommodate both uploads together. A shared SVG is used when the department image is missing or fails. Referenced current/archived photos are protected from cleanup deletion.

## Authorization and APIs

Roles remain `superadmin`, `admin`, `editor`, `viewer`; no Department or Legislative account role is added. Authentication still verifies the Supabase user and active staff record. Authorization reads current Department memberships from the database.

Executive editors with editor/manager membership can edit their Department page/head and create/update/delete their own news, programs and contacts. They cannot create/delete departments, change access settings/branch, assign users, or enter Legislative management. Viewer access remains read-only. Legislative Access remains one existing scope with its existing role limits. Superadmins retain system-wide management.

Admin queries filter authorized Department IDs. Every update/delete reads the existing resource's database ownership before permission checks; submitted IDs or roles do not establish permission. PostgreSQL RLS independently enforces the same boundaries, including direct PostgREST calls. Unauthorized database writes raise SQLSTATE 42501 (HTTP 403 through PostgREST). Existing Server Actions display permission errors through the action protocol; no redundant REST mutation API was introduced. Unauthorized admin pages retain the application's not-found behavior.

The published news projection now joins directly to the live Department, and sources link to `/departments/[slug]`. The public data adapter filters Department active/publication status. Contact reads use the same published-content adapter.

## Main changes

- Schema: `supabase/migrations/202610020009_dynamic_departments.sql`.
- Models/data: `types/index.ts`, `lib/content/{schema,config,mock,supabase}.ts`, `lib/api/index.ts`; removed `data/departments.ts`.
- Authorization/forms: `lib/offices/{server,collections}.ts`, `lib/admin/{content,users}.ts`, `app/admin/content`, `app/superadmin/departments`, UserForm and admin navigation.
- Public pages: `app/(public)/departments`, old Executive redirects, DepartmentGrid/Image/Contacts, news source links, Header and shared CSS.
- Diagnostics: `scripts/check-auth.mjs`, `scripts/check-supabase.mjs`.
- Tests: `tests/data/dynamic-departments.spec.ts`, `tests/dynamic-department-admin.spec.ts`, existing regression suites and Supabase transport fixture.

## Migration-010 validation

- Typecheck, lint and production build passed.
- 90 data tests passed in the full run; the added scoped-query test passed in the eight-test adapter rerun, and the added Superadmin rename/publication/alias test passed in the seven-test migration-009/010 rerun (92 distinct data tests covered).
- All 24 admin desktop/mobile scenarios passed across the full run and targeted reruns. Updated old viewer assertions for the removed identity fields and scoped action-error selectors to exclude Next.js's route announcer.
- All 14 public desktop/mobile scenarios passed.
- The unknown-department browser scenario now creates head/body/order and both images in Superadmin, verifies public output, assigns an Editor, replays the real Superadmin creation action with that Editor's cookies, rejects forged generic creation and identity updates, edits content, manages contacts and deactivates the department.
- Real PostgreSQL migrations in PGlite verify non-Superadmin creation denial, Editor identity/publication denial, content ownership, Superadmin identity updates, slug preservation, unpublished/inactive filtering and permanent deletion protection. This checks the database permissions used by PostgREST, not the live hosted gateway.
- Reviewed desktop/mobile department screenshots and searched production app/components/lib code for individual department names and routes. No individual-office registries or conditions remain there.

Browser tests use isolated transport fixtures. Windows test-server teardown again remained running after assertions; owned sessions were interrupted once results were collected, yielding exit 1 on teardown. No live Supabase migration or Vercel deployment was performed.

## Prior migration-009 validation

- `npm run test:data`: 89 tests passed. The five migration-009 tests were rerun after strengthening the existing-head/photo preservation assertion and passed again.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- Admin browser suite: 24 desktop/mobile scenarios passed across the full run and targeted reruns. The older single-file-input test was updated for separate head and department uploads.
- Public browser suite: all 14 desktop/mobile scenarios passed, including news details, filters, legacy redirects, responsive layouts, and long legislative titles.
- The new end-to-end scenario creates an unknown department through Superadmin, verifies its directory/detail/placeholder, creates and assigns an Editor, edits head/body/images, manages multiple contacts, rejects unrelated admin routes, and deactivates it. The database tests separately verify Editor news/program/contact CRUD, forged ownership rejection, protected Department settings, FK preservation, private legacy archive and inactive-record filtering.
- Reviewed generated department screenshots and searched `app`, `components`, and `lib` for office-specific names/conditions and old office-table queries; none remain for the individual offices tested.

Browser tests use an isolated Supabase transport fixture. Database permission tests execute the real migrations in PGlite. These are local checks, not a live Supabase/Vercel deployment verification. The Windows Playwright web-server teardown remained running after its assertions; owned test sessions were interrupted after collecting results, so those interrupted commands exit 1 even though the reported assertions passed.

## Homepage ordering and activities

See [UI and navigation improvements](UI-NAVIGATION.md) for bounded homepage department cards, visible sort order, compact contacts and the dynamic UUID-based activities filter. No additional migration is required.
