# Legislative Terms (migration 019)

## Document authors and automatic sessions (migration 021)

Apply the contents of `supabase/migrations/202611180021_document_session_authors.sql` after 020. No hosted migration is applied by this implementation. Authors and co-authors must be Sangguniang Bayan members in the document's office and term; the Vice-Mayor is excluded. This restriction does not remove the Vice-Mayor from committee membership choices.

Ordinances/resolutions use their approval date, and Agenda/Minutes use their document date, to match a session in the same office and term. One match is selected automatically; no match prevents saving with a message to create the session, and multiple matches require selecting one of that date's sessions. Changing the date recalculates both the term and session. Executive Orders remain session-free. Upload/publication timestamps do not determine the session.

The form, Server Actions, CSV importer and PostgreSQL enforce these rules. Supplied session IDs are checked against the database; omitting the ID triggers the same unique-date lookup server-side and in SQL. Existing records, authorship, dates, IDs and files are not rewritten. Editing historical documents with incompatible relationships requires correcting them; timestamp/order-only maintenance preserves historical records. A referenced session cannot be moved to a date that conflicts with its documents, and a referenced author cannot be changed to an ineligible official role.

Local verification for 021: all 151 data tests, standalone typecheck, targeted lint and production build passed. Six desktop/mobile browser scenarios passed across the new automatic-session form, term filtering and CSV relationship checks. Tests cover missing/ambiguous dates, changed document dates, excluded Vice-Mayor authors, blank CSV session IDs, rejected forged relationships and preserved database records. Form screenshots were reviewed. Browser fixtures are isolated; hosted Supabase was not changed. Windows test servers were interrupted only after their assertions completed because teardown remained running.

The existing desktop Legislative workspace regression also passed with automatic session selection, including all five document types and PDF upload/replacement (seven passing browser scenarios total).

## Upgrade and preservation

Apply the **contents** of `supabase/migrations/202611160019_legislative_terms.sql` after migrations 001-018, then deploy this application version. This implementation does not apply a hosted migration or deploy the website.

The migration adds `legislative_terms` with generated UUIDs, dates, and a database exclusion constraint that prevents overlapping inclusive date ranges. Six existing tables receive nullable `term_id` foreign keys: officials, committees, sessions, ordinances, resolutions, and municipal_documents. The existing read-only legislative document view includes term ownership. Existing IDs, numbers, relationships, publication states, attachments and files are preserved. No historical records are automatically assigned.

## Setup workflow

Migration 020 adds a shared [Master Committee List](MASTER-COMMITTEES.md). Committee names are managed by Superadmin; the existing records retain their term-specific compositions and document links. Review historical associations before saving them.

1. In **Superadmin > Legislative Terms**, create the verified historical and current terms with their exact start/end dates. A term ending June 30 and a following term starting July 1 are adjacent, not overlapping.
2. Choose **Unassigned historical records** in the Legislative CMS to find existing content.
3. Assign officials first, then committees. Committee officials must already belong to the selected term. Officials serving multiple terms use separate existing-style Official records.
4. Edit/save sessions using their actual dates. The server assigns their term.
5. Edit/save ordinances and resolutions using their approval dates and matching-term author, optional co-author, committee and session. Agenda/Minutes inherit their session's term. Executive Orders use their issuance date.

New Officials and Committees default to the current term. Existing unassigned records require deliberate selection. Description edits do not silently rewrite historical membership. Date-based forms show an automatically derived read-only term and fail clearly when no term covers the date.

Automatically assigned terms and matched sessions appear as labeled information panels, not text inputs. They update when the record date changes and announce updates to assistive technology. When several sessions share a date, the existing session dropdown still allows staff to select the correct one.

Information-panel verification: type check, targeted lint and production build passed. Existing document/session desktop and mobile scenarios passed, including automatic matching, unmatched dates, manual selection for multiple sessions, saving and reopening. Both screenshots were reviewed. Test-server teardown was interrupted after the assertions completed.

Document forms ask for Date immediately after the document type is selected, before the term and related official/committee fields. Session forms also start with Date. Agenda/Minutes inherit the same-date session's term; their Date and Session fields precede the read-only term. Document lists default to document date descending, and session lists and session dropdowns use session date descending, with IDs breaking ties. Public Supabase lists use the same newest-date order. Session publication remains optional, but its form no longer asks for a manual sort position; the existing database position is retained internally for compatibility. The form/list ordering change does not itself require a migration; the session/author rules above require 021.

Date-first workflow verification: typecheck, targeted lint, production build, 15 adapter/term data tests and four desktop/mobile browser scenarios passed. Browser checks cover field order, automatic term recalculation, session publication without a manual position, and date ordering when an older document is added later. Desktop/mobile form screenshots were reviewed. The test server required interruption after all assertions passed during Windows teardown; the user's development server was left running.

## Bulk add sessions

Open **Admin > Sessions > Bulk add sessions** to enter up to 50 sessions for one Legislative Term. The selected list term carries into the form. Each row includes Date, Name, Session Number and Type (Regular or Special); rows can be added or removed before saving.

All dates must fall within the selected term, including its start and end dates. Sessions default to drafts; **Publish all sessions** publishes the entire batch. Validation errors preserve the entered rows. Matching session number/date/type combinations are checked against the batch and existing records in the same office and term. Saving uses one insert statement, so a database validation or permission failure rejects the whole batch. Existing session ordering, date-derived term triggers and staff permissions remain in force. No new migration is required.

## Current term and browsing

Public and admin term labels append years from the saved start/end dates: `16th 2022-2025`. The current term uses `17th 2025-Current`; previous and upcoming terms show their actual end year. This shared display format does not change stored names, term IDs or date assignments. Superadmin continues to edit the base name and dates separately.

Term-label verification: TypeScript, targeted lint and production build passed. All six focused desktop/mobile scenarios passed for public term browsing, staff forms and Superadmin term management; screenshots were reviewed. The Windows browser-test server teardown was interrupted after the assertions completed. No database migration is required for this presentation change.

Current/Previous/Upcoming status is computed using the calendar date in **Asia/Manila**, including inclusive start and end dates. There is no manual current toggle. Request-time rendering and uncached term reads allow the default term to switch at Philippine midnight without deployment.

The Legislative dashboard and public Legislative landing page, members, committees, sessions, ordinances, resolutions and documents offer a term selector. Existing public publication filtering, order and search remain in place. No current term produces an explanatory message and no guessed roster. Unassigned published historical content remains accessible through the explicit historical option; direct existing public detail URLs remain valid.

Dashboard cards count only the selected term. The Documents count covers municipal documents (Agenda/Minutes/EO), so ordinances and resolutions are not counted twice. Creating a dated record always follows its date, even if the list/dashboard was viewing another term.

## Authorization and consistency

Only active Superadmins can create/edit term definitions. Existing Department, Legislative Access and Transparency assignments are unchanged. Term metadata (name and dates) is public; individual records still use existing RLS/publication rules.

Server actions validate assignments and related records. PostgreSQL independently derives date/session terms, rejects cross-term relationships, and protects already assigned dependent records. Changing a parent's term is rejected if it would strand assigned dependents in another term. Create a term-specific official/committee/session instead when preserving an existing linked record is necessary. Date edits to term definitions cannot exclude assigned dated records. Term deletion is unavailable; foreign keys preserve links.

Historical rows remain null until deliberately edited; order/timestamp-only updates caused by existing publication ordering preserve unassigned peers. Storage and files are unchanged.

## Troubleshooting an official edit page

Older official IDs such as `committees` are preserved database IDs, not the official's current name. Renaming an official or assigning its term must keep that ID and its existing relationships. A null term does not prevent opening the edit form.

If an Edit link returns not-found, refresh the page and inspect the server's `[portal-auth]` diagnostic with stage `content_edit:officials`. `missing_or_not_visible` means the authenticated query returned no record; `access_denied` means the record was read but the current account's office permissions rejected it; `query_error` identifies a database request failure. The diagnostic excludes record content and credentials. Do not rename IDs or bypass authorization to resolve a 404.

The legacy-ID regression covers opening an unassigned official from the list, assigning a term, renaming it and reopening its unchanged ID on desktop/mobile. These checks and the existing public roster/dashboard checks passed together (six scenarios). During local debugging, corrupted `.next/dev/types` files caused type-check failures; restarting the development server with a fresh `.next/dev` cache restored valid generated types. Build, lint and a subsequent standalone type check passed. Cache repair does not require a database migration.

The same lookup diagnostics apply to resolutions with stage `content_edit:resolutions`. A browser console's HTTP 404 alone does not identify an authorization failure. If even an anonymous request to the Edit URL returns not-found instead of redirecting to login, check whether `.next/dev/types/routes.d.ts` includes `/admin/content/[collection]/edit/[id]`. During the November 20 resolution investigation, both Edit and View were missing from the running development server's generated routes despite intact source files and a valid published resolution. Stopping that project's development server, preserving `.next/dev` in a backup, and restarting with a fresh cache restored the routes.

The fresh compilation also exposed an empty local `node_modules/sharp` package. Restoring the exact locked version (0.35.5), with archive integrity checked against `package-lock.json`, fixed compilation without changing package versions. The same Resolution Edit URL then reached its expected login guard in an anonymous request. Four routing/PDF validation tests and a fresh production build passed. The desktop Legislative workspace browser regression passed in 50.9 seconds against the isolated transport fixture, including opening/editing/saving a resolution and preserving its PDF; Windows teardown required interruption after assertions passed. This repair changes local generated files/dependencies only; it requires no migration and does not change resolution IDs, attachments or permissions.

## Verification

Use `npm run test:data`, `npm run typecheck`, `npm run lint`, and `npm run build`. Browser scenarios: `npx playwright test --config playwright.terms.config.ts` (isolated transport fixture, desktop/mobile). Database tests execute real migrations with PGlite; the browser fixture is not a substitute for hosted Supabase verification.

Validation results: the full data suite passed 136 tests. The four focused term tests then passed, including one additional date-edit case. TypeScript, full lint, targeted lint and production build passed. Eight desktop/mobile browser scenarios passed across the full and targeted runs: public publication/term filtering, membership, relationship dropdowns, counts, Superadmin create/edit, and actual-date assignment/reassignment on save. Desktop/mobile screenshots were reviewed. The Windows Playwright server teardown remained running after completed assertions and was interrupted; those browser commands exit 1 during cleanup. No hosted Supabase or Vercel verification was performed.

The existing desktop Legislative workspace regression also passed after its save helper was updated to wait for the saved table before navigating again. It covers Officials/Committees/Sessions and all five document types, optional co-author, validation retries, PDF upload/replacement and public attachment access. Total passing browser scenarios across runs: nine. Authentication implementation was unchanged.
