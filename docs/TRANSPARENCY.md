# Dynamic Transparency management

Apply the **contents** of `supabase/migrations/202611130018_transparency_access.sql` in Supabase SQL Editor **after migrations 001?017**, before running/deploying this application version. If you have only applied through 015, apply 016, 017, then 018. Do not rerun already-installed migrations or paste file paths into SQL Editor. No hosted migration or deployment was performed. Existing environment variables remain valid.

## Routes and access

Transparency uses explicit per-user assignment and the existing account roles. In **Superadmin ? Users & access control**, create/edit a user, select their role, select **Transparency** in **Office Access**, and save. Only Superadmins can change assignments. Transparency appears alongside departments in the same Office Access selector. It reuses the migration-018 content-area assignment internally; it does not create an Executive department or a new role. Staff can have Transparency access alongside existing office memberships, or Transparency alone.

| Account | Transparency access |
| --- | --- |
| Active Superadmin | Full access without assignment |
| Assigned active Editor or Admin | Create/edit/publish/soft-delete all Transparency modules and reports; upload/replace PDFs |
| Assigned active Viewer | Read modules, drafts/reports and private PDF previews; no mutation or upload |
| Unassigned, disabled or deleted account | No management access |

- `/admin/transparency`: searchable report table and PDF previews.
- `/admin/transparency/reports/new` and `/admin/transparency/reports/[id]`: protected report forms.
- `/admin/transparency/modules`: modules, descriptions, document counts and permitted actions.
- `/admin/transparency/modules/new` and `/admin/transparency/modules/[id]`: protected module forms.
- `/transparency`: published reports in compact module accordions, with title search and Module/Year filters. Empty modules and missing attachments are hidden.

Old Superadmin module bookmarks redirect to the shared admin workspace when opened by Superadmin. Assigned staff use `/admin/transparency/modules`; other Superadmin pages remain protected. Module/report forms retain route skeletons.

Migration 018 adds `staff_accounts.transparency_access` (default false), extends the existing Superadmin-only `manage_staff` transaction to save assignments with account settings, records assignment changes in the audit log, and updates existing collection and Storage authorization helpers. No existing account is automatically granted access. Existing departments, memberships, records, publication states, IDs and files are preserved. Applying this migration before the new application is safe; deploying the application first will fail staff-profile reads because the new column is required.

Authorization uses the verified session and current database account. Route/action guards, collection RLS, ownership/order triggers and private Storage policies enforce the assignment and role. Removing the assignment, disabling the account, or changing its role takes effect on subsequent protected requests without requiring a new login. A Transparency-only account with revoked access cannot continue into staff pages; staff with other active office assignments retain those offices. Deleting an account clears its Transparency assignment. Already-issued PDF URLs retain their existing 60-second lifetime.

## Workflow

1. In **Transparency modules**, add a module with its name and description. Modules are database records in the existing `document_categories` table. New modules immediately appear in the report dropdown, without source changes.
2. In **Transparency reports**, add a document and choose its module, report title, frequency, year, optional description and status.
3. Annual reports have one PDF slot. Quarterly reports have independent Q1–Q4 slots. Each PDF can be up to **10 MB**.
4. Drafts may have no attachments. Publishing requires at least one attachment; quarterly reports can be published with incomplete quarters and completed later. The public only sees the uploaded quarters.
5. Editing/replacing one attachment preserves the other slots. A replacement takes priority over its Remove checkbox. Removing the last attachment requires saving as Draft. To change frequency on a report with saved PDFs, remove the attachments and save a draft first.
6. Report titles are not unique: the same title can be reused across different years. Search and year/module filters work on both the public and management pages.

## Deletion and preservation

Delete removes a report from management lists and public pages using `deleted_at`, unpublishes it and retains the underlying row and file references. Direct permanent deletion is blocked for Transparency records. The UI requires confirmation.

A module containing nondeleted reports cannot be deleted. Move those reports to another module or delete them first. Database locking and checks enforce this independently of the UI, preventing concurrent report creation from orphaning content. Deleted records are retained for recovery; recovery is not exposed in this interface.

Migration 017 extends the existing `municipal_documents` table with `report_frequency`, `report_year`, five attachment paths, and deletion state. Existing Transparency records become Annual reports, with the year taken from their existing date and the existing PDF copied into the annual attachment reference. IDs, original dates/descriptions, category relationships and stored bytes remain unchanged. It does not convert or remove Legislative documents. The migration runs in a transaction and rolls back if existing data violates the new constraints.

## File handling and publication

Uploads retain the private `municipal-document-staging` and `municipal-transparency` buckets introduced by migrations 015/016. The browser uploads each PDF directly using a signed upload URL; the server validates its size, MIME and PDF framing, copies it to an immutable server-generated path, and updates the report only after all selected files succeed. A failed save cleans up newly created final objects. Staging objects from abandoned requests may need periodic maintenance.

Public downloads use `/transparency/files/[id]?period=annual|q1|q2|q3|q4`. Protected previews use `/admin/transparency/files/[id]` with the same period. Each request checks the report, module, publication/deletion state, frequency and exact slot before issuing a Storage URL valid for 60 seconds. This avoids passing large files through Vercel response limits. Already issued URLs may remain usable for up to 60 seconds after unpublishing or deletion; already downloaded files cannot be recalled.

Storage RLS exposes only paths referenced by a published, nondeleted report in a published, nondeleted module. Draft/deleted files remain private. Referenced files, including soft-deleted records, cannot be removed by upload-failure cleanup. Replaced objects are retained privately.

## Verification

- `npm run test:data`: migration preservation, partial quarterly publication, independent replacement, reusable titles, access denial, safe deletion, Storage protection and public adapter checks using PGlite/isolated transport.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npx playwright test --config playwright.transparency.config.ts`: desktop/mobile report/module workflow, annual and partial-quarter PDFs, replacements, filters, accordions, deletion and access rejection; also includes the existing Legislative workflow regression.

These checks are local. Browser tests use an isolated Supabase fixture and do not verify the hosted project. After migration/deployment, verify a real annual PDF and a partially completed quarterly report through the live website.

Implementation validation: all 123 data tests, type checking, lint and the production build passed. Desktop/mobile Transparency workflows passed after targeted reruns; six permission scenarios and both Legislative regression scenarios passed in the broader browser run. Responsive screenshots were reviewed. Windows browser-test server teardown did not finish normally after the assertions, so assertion results are reported separately from process completion. No live migration or deployment was performed.

Rerun on November 12, 2026: all 123 data tests, type checking, lint and the production build passed again. All 10 browser scenarios passed in one run (desktop/mobile Transparency workflows, six access-denial scenarios and two Legislative regressions). The runner stalled during Windows server teardown after completing the assertions; its session was interrupted and exited 1. No application fixes were needed, and no hosted database changes or deployment were performed.


## RBAC validation (018)

The Office Access selector now includes Transparency and replaces the separate assignment checkbox. Existing assignments remain selected when editing a user. Saving a selection with both a department and Transparency preserves both; deselecting Transparency revokes only that area. No additional migration is required beyond 018. The two selection-parser tests, desktop/mobile assignment and revocation scenarios, targeted lint and the production build (including TypeScript) passed. The browser runner was interrupted after passed assertions because Windows server teardown stalled.

The SQL tests exercise the real migrations in PGlite: default denial and data preservation, Superadmin-only assignment, Editor module/report/PDF management without office membership, cross-branch rejection, Viewer read-only access, revocation/disablement/deletion, private-file rules and safe soft deletion. Browser tests exercise assignment through User Management, Transparency-only login, module/report creation, draft PDF previews, Viewer downgrade and revocation. These use isolated fixtures; they are not evidence of a live migration or deployment.

November 13 validation: 127 data tests, type checking, lint and the production build passed. All 10 Transparency browser scenarios passed across the main run and targeted reruns, including the new assignment/revocation workflow on desktop and mobile. All 11 login-resolution scenarios passed across the main run and targeted reruns. Test fixes wait for the staff-session check and navigation to finish, use the Role combobox locator, and explicitly send session cookies for private PDF API requests to the HTTP fixture. Windows test-server teardown stalled after assertions; owned test sessions were interrupted, producing exit 1 despite the passing assertions. Migration 018 was tested locally but has not been applied to the hosted database.
