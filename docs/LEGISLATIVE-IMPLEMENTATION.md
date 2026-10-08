> Migration **009** consolidates the Department system. See [Dynamic departments](DYNAMIC-DEPARTMENTS.md) for the current architecture and deployment steps.

> Current department scoping and public routes require migration **008**. See [Department implementation](DEPARTMENT-IMPLEMENTATION.md) for upgrade instructions and verification.

# Single Legislative Access office

The current access model is **Branch -> Office -> User**. There is no Legislative account role and no module-permission checklist.

```
Executive
  Assessor / RHU / MPDC / Treasurer / other offices
Legislative
  Legislative Access
```

Assign Legislative Access through the same Users form and office permission level used for Executive offices. That assignment covers every Legislative content area, including officials, ordinances, resolutions, news, sessions, hearings, committees, departments, categories, and documents. Existing account roles still cap operations: Viewer reads, Editor creates/updates, Admin can delete with Manager office access, and Superadmin is unrestricted. For full Legislative management, select account role **Admin** and office level **Manager**. No individual feature selections are required.

## Apply the upgrade

Run the complete contents of `supabase/migrations/202610010007_single_legislative_access.sql` in Supabase SQL Editor once, then deploy/restart the matching application. This session has not applied the migration to your live project.

Migration 007 follows migrations 001-006. If 005 and 006 were not applied yet, apply them first, in order, and then apply 007. Do not rerun migrations already applied, reset the database, or drop existing content tables. Keep historical migration files for reproducible upgrades and fresh installations.

The migration:

- Creates the single `Legislative Access` office and prevents additional unarchived Legislative offices.
- Consolidates memberships from active former Legislative offices. Prior effective role limits are preserved by assigning Viewer/Editor/Manager office levels according to the existing account role. Old module exclusions no longer restrict access, as requested.
- Preserves disabled/deleted account status. Memberships belonging only to previously inactive offices are archived without activating access; Superadmin can explicitly assign those users if needed.
- Archives the former SB, VMO, and Secretary office records and memberships rather than deleting history. Archived offices no longer appear in assignment forms or the admin directory and cannot be assigned through the account RPC.
- Assigns all existing Legislative content to the new office. Keeps previous office attribution in `legacy_office_id`, retains creator IDs, content IDs, public official roles, descriptions, published status, documents, and image URLs. No Storage objects are changed or deleted.
- Moves unassigned committees and unassigned news explicitly categorized `Legislative` into Legislative Access. Other unassigned mixed-use content stays under Superadmin control; the migration does not guess ownership from a creator's identity. Executive-owned content is unchanged.
- Replaces content and upload policies with the same office authorization checks used for Executive access, including account activity, office activity, and operation limits. Prevents forged branch/office combinations.
- Restores the office-only `manage_staff` RPC without module arguments. Removes module authorization functions and archives the obsolete choices privately as `legacy_user_module_permissions`. Application code does not read or write that archive.

No new environment variable or bucket is required. The existing `municipal-media` bucket, upload validation, previews, replacement, public official role enum, automatic official IDs, and informational cards remain intact. Public Vice-Mayor/member/Secretary distinctions are independent of staff access.

## Application changes

- Office-only checks in `lib/offices/server.ts` and content actions; list queries use office IDs.
- Removed module checkboxes, loading, parsing, and RPC parameters from `app/superadmin/users/**` and `lib/admin/users.ts`.
- One Legislative Access entry in the office directory/sidebar, with all content areas available according to the normal office operation level.
- Public official-role definitions live in `lib/officials/roles.ts`; they are not authentication roles.
- Archived offices are excluded from normal office management/assignment pages.
- Existing photo upload and public pages are preserved.

## Verification

Run `npm run test:data`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:admin -- --workers=2`, and `npm run test:public`.

The new PostgreSQL tests apply the complete upgrade, compare content before/after, verify photo/document URL preservation, consolidated assignments, office-only CRUD on Legislative tables, Executive isolation, role caps, account RPC behavior, upload policies, and deactivation. Historical migration tests intentionally retain the old module contract only to verify the 005 upgrade stage, not the current application.

Browser tests cover office-only user creation/edit/login, access to all Legislative content without checkboxes, rejection of forged cross-branch submissions, photo upload/replacement, public cards, and existing Executive/authentication workflows. Tests use isolated synthetic Supabase data and do not create production users or files.

After applying 007, run `npm run db:check` and `npm run auth:check`, then sign in with a Legislative Access user and verify an existing record and photo. The auth diagnostic checks `offices.archived_at` to detect a missing 007 migration.

### Results of this refactor

- Database suite: 75 passing tests; the final 007-specific suite was rerun successfully after adding unassigned Legislative news/committee classification and document preservation/CRUD checks.
- Typecheck, ESLint, and production build: passed.
- Desktop/mobile browser assertions: all 16 admin/auth cases and all 12 public cases passed.
- Windows browser-runner teardown remained waiting after all cases passed; the owned test sessions were stopped. These browser command exits were interrupted rather than clean zero exits.
- No live migrations, production accounts, content, or files were changed. Apply 007 before deploying this code. No additional secrets or Storage configuration are required.
