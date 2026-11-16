# Legislative Access workspace (migration 014)

## Upgrade

Apply the **contents** of `supabase/migrations/202611060014_legislative_workspace.sql` in Supabase SQL Editor after migrations 001-013, then deploy this application version. This implementation does not apply migrations or deploy to live Supabase/Vercel.

Migration 014 extends the existing tables; it does not create a parallel CMS or document identity system. Existing IDs, publication state, text, image/file URLs, and memberships remain intact. The optional historical seed must not be rerun against this schema.

## Navigation and dashboard

Legislative Access remains one department assignment with existing role and membership limits. Its collapsible menu has OFFICE OVERVIEW (Officials, Committees, Sessions) and DOCUMENTS (Add Document, Ordinances, Resolutions, Minutes, Agenda, Executive Orders). These labels are headings, not additional modules. Executive offices retain their existing navigation.

The Legislative office dashboard shows actual Supabase counts for officials, ordinances, resolutions, sessions, committees, and documents. Document counts include only published records. Staff assigned only to Legislative Access also see this overview at `/admin`; multi-office staff choose their office as before.

## Editing

- Officials reuse the existing table, upload validation and publication controls. New role choices are Vice-Mayor and Sangguniang Bayan Member. Existing Secretary records remain editable with their existing role.
- Sessions reuse the existing table with an added `name` column. The form has Name, Date, No. and Regular/Special type. Existing descriptions, agenda arrays, images and legacy Caucus type are retained on updates.
- Committees use `chair_id`, `vice_chair_id` and four fixed `member_1_id` through `member_4_id` foreign keys to Officials. There is no dynamic membership subsystem. Unfilled member positions are NULL.
- Add Document opens the combined published-document table, ordered by creation date descending. Its Add Document button asks for a type, then opens the existing generic create route with the matching fields.
- Ordinances/resolutions stay in their respective existing tables. `author_id`, `co_author_id`, `committee_id`, and `session_id` reference existing records. There is exactly one author and at most one co-author; N/A stores NULL. The official document number is separate from the generated internal UUID string.
- Agenda, minutes and executive orders use `municipal_documents.document_type`; agenda/minutes have a Session FK. Body uses the existing `description` field. Existing category and attachment references remain intact.

Dropdown options load from the current Legislative office's records, with pagination. Names are resolved from relationships when rendered, not copied into new document records. Historical free-text author/chair values are preserved; they are not guessed into foreign keys. When editing a historical record, staff explicitly choose its related records. Unclassified existing municipal documents can be assigned a type when edited.

## Publication and security

The document workspace manages published documents only. A valid new document is published on save, with no Draft/Unpublished controls. Existing unpublished documents are excluded and cannot be published by opening this editor. No migration publishes or deletes them.

`legislative_documents` is a read-only union view of ordinances, resolutions and municipal_documents, using `security_invoker=true` so existing source-table RLS remains authoritative. Server queries explicitly filter by assigned scope and publication. Existing authenticated-session checks, ownership checks, optimistic updated_at checks, audit triggers and publication ordering are retained.

The server checks actual related records and ownership. PostgreSQL FKs and branch/office triggers also reject missing or cross-scope relationships and deletion of referenced records. Referenced Officials/Sessions/Committees cannot be moved out of their Legislative scope. Existing legacy NULL relationships remain valid until deliberately linked.

## Routes and public content

The existing `/admin/content/[collection]`, `/new`, and `/edit/[id]` routes are reused. Separate document lists use the existing collection paths or `documents?type=minutes|agenda|executive-order`. Each supports title search, sort, view and edit; lists are paginated. Read-only details use `/admin/content/[collection]/view/[id]`, with a skeleton fallback.

Published ordinances and resolutions retain their existing public routes. Their detail pages now render dynamically rather than using empty build-time static parameters, so newly created records can be opened immediately without a rebuild. `/legislative/documents` and `/legislative/documents/[id]` provide the shared public templates for agenda, minutes and executive orders, linked from the Legislative page. Public queries remain published-only; the adapter resolves author/co-author/committee/session names through FKs, respecting the related records' RLS visibility.

## Main files

- Schema: migration 014; `types/index.ts`; `lib/content/schema.ts` and `supabase.ts`.
- Validation/navigation/options: `lib/legislative/`.
- Admin UI: `components/admin/Legislative*`, `DocumentTypeSelector`, `OfficesNav`, `AdminShell`, generic content routes/actions/forms, and `app/admin/page.tsx`.
- Public: Legislative document routes, DocumentDetail, SessionCard and Legislative landing links.
- Tests: `tests/data/legislative-workspace.spec.ts`, `tests/legislative-workspace.spec.ts`, existing Legislative tests and fixture; `playwright.legislative.config.ts` uses isolated port 3014.

## Validation

- The full `npm run test:data` run passed 113 tests. After extending migration-014 coverage, its two targeted tests passed, including preserved legacy values, FK/ownership enforcement, referenced-record protection, anonymous publication filtering, and document validation.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. The production build lists ordinance/resolution detail routes as dynamic.
- All 12 Legislative desktop/mobile scenarios passed across the suite and targeted reruns: account assignment, collapsed navigation, Executive access rejection, official image validation/editing, public ordering, and the new complete workflow. The new workflow creates/edits officials, sessions and committees, creates/views/edits all five document types, opens their public details, and checks document search/sort and mobile overflow.
- The Executive navigation assertions were rerun on desktop/mobile and passed with the existing office module order. Reviewed desktop/mobile dashboard and document-list screenshots.
- Browser tests use the isolated Supabase transport fixture; migration tests execute SQL in PGlite. These checks are not live Supabase/Vercel verification. The Windows Playwright server teardown remained running after reporting assertions; the owned test sessions were interrupted after collecting results. Those interrupted commands exit 1 despite their individual passing assertions.

Reproduce the Legislative browser checks after building with `npx playwright test --config playwright.legislative.config.ts`.

## PDF attachments (migration 015)

Apply the **contents** of `supabase/migrations/202611090015_legislative_pdf_uploads.sql` after migrations 001-014, then deploy the matching application. This migration has not been applied to live Supabase by this implementation. It adds a private upload staging bucket and Storage policies; it does not change content tables, existing URLs, records or files. No new environment variables are required.

All five Legislative document forms now have an optional **PDF attachment** field, limited to one PDF up to 10 MB. Select the file and save normally. Edit shows **View current PDF**; choosing another PDF replaces the record's link. Saving without a new selection keeps the existing attachment. Replaced files remain in Storage to preserve any shared or historical references.

The browser uploads directly to private `municipal-document-staging`, using the same signed-upload workflow as news images. `/admin/document-upload` checks the staff session, Legislative assignment, editing permission and existing record ownership. The save action validates the staging path against the authenticated user, office and collection, then checks size, PDF MIME type, header and EOF framing before copying to the existing public `municipal-media` bucket. These framing checks are not a full PDF parser or malware scan. The existing `pdf_url` (ordinances/resolutions) or `file_url` (agenda/minutes/EO) stores the server-generated URL; client-submitted URLs are ignored in this workflow.

Admin detail pages and public detail pages link to the attached file. Saved attachments are public, matching this workspace's published-only documents. Database Storage policies deny Executive/viewer uploads and protect referenced attachments from cleanup. Newly uploaded public files are removed after a failed database save; private temporary files are removed after validation. A form rejected before file validation can leave a private staged upload, as with the existing news upload flow.

Main files: `components/admin/PdfAttachment.tsx`, `app/admin/document-upload/route.ts`, `lib/admin/document-pdf*.ts`, the existing ContentForm/save action/admin detail page, migration 015 and PDF/Legislative tests.

PDF validation: five targeted data/PGlite tests passed (file validation, path ownership, Storage RLS, reference protection and Legislative preservation). Typecheck, lint and the production build passed. Four desktop/mobile browser scenarios passed, covering all five document types, upload/replacement, preserving existing links, retrying a selected PDF after a form error, public attachment links and rejected Executive upload requests. Reviewed desktop/mobile form screenshots. Browser uploads use the isolated Storage transport fixture, not live Supabase. As above, the Windows test-server teardown required interruption after assertions completed.
