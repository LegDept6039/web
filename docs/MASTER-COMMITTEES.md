# Master Committees

For installations through migration 035, apply the **contents** of [migration 036](../supabase/migrations/202611260036_committees_published.sql) after 035 before using automatic publication and term setup. Existing installations already have migration 020; do not rerun it. No hosted migration or deployment is performed by this implementation.

## Catalog and compositions

Superadmin manages names and display order at `/superadmin/master-committees`. The municipality confirmed that the initial list contains **25 committees**, correcting the original count of 26. The migration seeds all 25 supplied names in their supplied order. Names are editable database records, not an application registry. Additional committees need no code changes.

`committee_master` contains UUID identities, names, order and timestamps. Existing `committees` rows remain the term-specific compositions with their original primary keys and official relationships. Their new `master_id` references the catalog. A unique `(master_id, term_id)` index prevents duplicate compositions, including concurrent saves. Catalog deletion is not exposed or granted; referenced identities remain protected.

Under **Admin > Legislative Access > Committees**, choose a term and edit its published compositions. Creating a Legislative Term automatically creates one published composition for each Master Committee. Adding a Master Committee also creates its published compositions for all existing terms. The database performs this work in the same transaction, so a failed setup does not leave a partial term or catalog entry.

New compositions contain the catalog name and empty membership/description fields. All six official positions are optional; officials are never copied from another term. Membership dropdowns contain only officials from the selected term. Existing same-office and same-term validation remains enforced in Server Actions and PostgreSQL.

New compositions snapshot the catalog name. Existing saved names never change when a master name changes; the CMS shows both the current catalog name and saved historical name when they differ. Composition edits preserve their primary key and linked Ordinance/Resolution records. Committees always publish; the form has no draft toggle or manual ordering input. Term or catalog edits do not regenerate compositions or reset their membership.

The composition form shows a single **Master Committee** field: a selector for new/unlinked records and a read-only field for linked records. A saved historical name appears as a note only when it differs from the selected catalog name. There is no duplicate Committee Name input; saving still derives the name on the server.

Existing deletion permissions and reference protections remain unchanged. A missing composition has an editor-only **Restore composition** action. Specific old Add links open the existing composition when present, preventing duplicate forms; a valid missing slot can still be restored as a published record.

## Historical review

Migration 020 associated a historical committee automatically only when its name exactly matched a supplied catalog name and occurred only once among existing Legislative committees. It did not normalize spelling/case, guess similar names, combine duplicates, or assign terms. Repeated or unmatched names remain unlinked.

Review **Unassigned historical records**, and **Historical Associations to Review** within each term. Open the original record, choose the verified master and term, and save. Historical names, IDs, memberships and document links stay intact. Once a record has a master identity, ordinary composition editing cannot transfer it to another master. Existing migration-019 protections also reject term changes that would strand related records. If the destination already has a saved composition, resolve the records deliberately; the application does not merge or delete them automatically.

Public pages display the published term-specific records, including newly created compositions with empty memberships. They continue to read compositions rather than the Master Committee catalog. Review historical membership and descriptions before filling them; automatic setup does not infer who served in a previous term. No public route, storage object or uploaded file is changed.

## Migration 036 preservation

The migration publishes existing draft committees and inserts only missing `(master_id, term_id)` compositions for existing terms in the canonical active Legislative Access workspace. Existing primary keys, historical names, descriptions, role assignments, term/office ownership, creation metadata and document references remain intact. Previously published sort positions stay intact; newly published and newly created rows are appended within the existing office ordering scope.

Unassigned historical records remain unassigned. If a term already has an unlinked historical committee matching a catalog name, migration 036 stops for identity review rather than adding a second record or guessing an association. Missing or ambiguous Legislative Access ownership also stops the transaction. The same guards apply when generating compositions for a new term or master.

The database defaults publication to true and rejects `published=false`. Trigger-only functions populate term/catalog additions; no public seeding RPC or new staff permission is introduced. The existing audit, ownership, relationship and ordering constraints remain enforced. Manual SQL Editor changes run inside the migration transaction with only the specific authorization/assignment triggers temporarily suspended for the publication backfill, then restored before commit.

## Access and validation

Only active Superadmins can create/edit catalog entries. Assigned Legislative staff can read the catalog and use their existing role/membership permissions for compositions. Viewers remain read-only; Executive-only staff cannot access the catalog or manage Legislative compositions. Database RLS protects direct requests independently of navigation and action checks. No new user role, module permission or parallel committee system is introduced.

Local checks: `npm run test:data`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npx playwright test --config playwright.committee-master.config.ts`. Database tests use the real SQL migrations in PGlite. Browser tests use an isolated Supabase transport fixture; they do not verify the hosted deployment.

Migration 036 validation: nine real SQL scenarios passed against migrations 001–036 in PGlite, covering preservation, missing pairs, new term/master inserts, publication defaults and constraints, atomic rollback, unchanged RLS, historical conflicts, references and ordering. Three committee parser scenarios passed. Full lint, TypeScript and the production build passed. These are local checks; the hosted migration is still a separate SQL Editor step.

Twenty-two desktop/mobile browser scenarios passed across full and focused runs: ten Master Committee scenarios, ten Legislative Terms scenarios and both existing Legislative workspace scenarios. They cover automatic published catalogs, empty memberships, duplicate-safe bookmarks and restoration, term isolation, historical names, role restrictions and committee links in all five document workflows. Desktop/mobile workspace screenshots were reviewed. Two old scalar test locators were scoped to the intended committee/form after automatic setup added more records; reruns passed. Windows test-server teardown required stopping only the verified isolated Next processes after assertions completed.

Hosted verification on November 26, 2026, after the user confirmed applying migration 036: read-only Supabase queries found 25 Master Committees and 75 published compositions. Each of the three existing terms had all 25 compositions, with zero missing pairs, drafts or unlinked name conflicts. Future insert-trigger behavior was tested locally; hosted verification did not create test terms or change content.
