# Master Committees (migration 020)

Apply the **contents** of `supabase/migrations/202611180020_committee_master.sql` after migration 019, then use this application version. No hosted migration or deployment is performed by this implementation.

## Catalog and compositions

Superadmin manages names and display order at `/superadmin/master-committees`. The municipality confirmed that the initial list contains **25 committees**, correcting the original count of 26. The migration seeds all 25 supplied names in their supplied order. Names are editable database records, not an application registry. Additional committees need no code changes.

`committee_master` contains UUID identities, names, order and timestamps. Existing `committees` rows remain the term-specific compositions with their original primary keys and official relationships. Their new `master_id` references the catalog. A unique `(master_id, term_id)` index prevents duplicate compositions, including concurrent saves. Catalog deletion is not exposed or granted; referenced identities remain protected.

Under **Admin > Legislative Access > Committees**, choose a term. The shared catalog appears with the saved chairperson, vice-chairperson and members, or **Unassigned template**. No database composition is created simply by adding or selecting a term. Choose **Edit composition** and save to create one, including when a document needs a committee relationship before officials have been confirmed. All six official positions are optional; dropdowns contain only officials from the selected term. Existing same-office and same-term validation remains enforced in Server Actions and PostgreSQL.

New compositions snapshot the catalog name. Existing saved names never change when a master name changes; the CMS shows both the current catalog name and saved historical name when they differ. Composition edits preserve their primary key and linked Ordinance/Resolution records. Descriptions and publication/order controls remain in the existing form.

The composition form shows a single **Master Committee** field: a selector for new/unlinked records and a read-only field for linked records. A saved historical name appears as a note only when it differs from the selected catalog name. There is no duplicate Committee Name input; saving still derives the name on the server.

## Historical review

The migration associates a historical committee automatically only when its name exactly matches a supplied catalog name and occurs only once among existing Legislative committees. It does not normalize spelling/case, guess similar names, combine duplicates, or assign terms. Repeated or unmatched names remain unlinked.

Review **Unassigned historical records**, and **Historical Associations to Review** within each term. Open the original record, choose the verified master and term, and save. Historical names, IDs, memberships and document links stay intact. Once a record has a master identity, ordinary composition editing cannot transfer it to another master. Existing migration-019 protections also reject term changes that would strand related records. If the destination already has a saved composition, resolve the records deliberately; the application does not merge or delete them automatically.

Catalog templates are not proof that a committee existed in a historical term. Public pages keep their existing saved/published/term filtering and never read the master catalog or show unsaved placeholders. Draft compositions remain private. No public route, storage object or uploaded file is changed.

## Access and validation

Only active Superadmins can create/edit catalog entries. Assigned Legislative staff can read the catalog and use their existing role/membership permissions for compositions. Viewers remain read-only; Executive-only staff cannot access the catalog or manage Legislative compositions. Database RLS protects direct requests independently of navigation and action checks. No new user role, module permission or parallel committee system is introduced.

Local checks: `npm run test:data`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npx playwright test --config playwright.committee-master.config.ts`. Database tests use the real SQL migrations in PGlite. Browser tests use an isolated Supabase transport fixture; they do not verify the hosted deployment.

Validation completed: 147 data scenarios passed across the full run and focused reruns (two older route-test fixtures were updated for the existing authentication diagnostics). Typecheck, full lint, targeted lint and the production build passed. All eight new desktop/mobile browser scenarios passed across the suite and focused reruns, covering 25-item catalog display, create/edit/order, empty compositions, term filtering, historical adoption, name/ID preservation, public publication rules and role restrictions. All ten existing Legislative Terms browser scenarios also passed. Desktop and mobile screenshots were reviewed. Browser test assertions completed, but the Windows test-server teardown stayed open; owned sessions were interrupted afterward and those commands therefore exit 1 during cleanup. No hosted database or deployment was modified.

The existing desktop Legislative workspace scenario also passed with its catalog selector updated. It covers creating/editing a committee and using that composition in the five document workflows, including PDF upload/replacement. Total verified browser scenarios: 19 across full and focused runs.
