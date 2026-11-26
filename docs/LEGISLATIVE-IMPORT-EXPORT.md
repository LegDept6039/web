# Legislative CSV Import and Export

The Legislative document list and Add Document screens include **Import CSV** and **Export CSV**. They reuse the existing Legislative Access assignment, document tables, publication rules and Legislative Terms. Apply migration 037 after 036 before using Mass motion approval.

## Import new records

1. Open Legislative Access > Documents > Add Document and choose **Import CSV**.
2. Select a document type and, if applicable, the authorized office.
3. Download the CSV template. Fill one record per row and save as **CSV UTF-8**. Each import accepts up to 100 records and 2 MB.
4. For relationships, download **Reference IDs**. It lists officials, committees and sessions belonging to the selected office, with their Legislative Terms. Copy their IDs into the corresponding columns.
5. Choose the completed CSV and click **Import Records**. The entire file is validated before one database insert. A rejected row prevents the entire batch from being imported.

The **Download Reference IDs** link is inside the Import CSV dialog on the Documents, Ordinances and Resolutions lists and the Add Document screen. Match the document's term using `term_name`: use an `officials` row's `id` for both `author_id` and optional `co_author_id`, and a `committees` row's `id` for `committee_id`. Committee composition IDs are term-specific; do not use Master Committee IDs.

Ordinance and resolution templates omit `session_id`. The importer uses the document's `date` to link its unique existing session in the same Legislative office and term. It does not create a new session. If no session exists on that date, create it in Sessions before importing. If several sessions share the date, add the optional `session_id` header and copy the correct session's ID from Reference IDs. Existing exports retain session IDs for reference.

| Column | Usage |
| --- | --- |
| `id` | Leave empty for new records. Existing IDs cannot be imported or overwritten. |
| `title` | Required report/document title. |
| `number` | Required for ordinances and resolutions; leave empty for other types. |
| `date` | Required valid `YYYY-MM-DD` approval/issuance/document date. |
| `description` | Required summary/description; quoted multiline CSV text is supported. |
| `author_id` | Required for authored ordinances and resolutions; must reference a Sangguniang Bayan member. Leave empty for Mass motion. |
| `co_author_id` | Optional Sangguniang Bayan member for authored ordinances and resolutions; must differ from the author. Leave empty for Mass motion. |
| `committee_id` | Required for ordinances and resolutions. |
| `session_id` | Omitted from ordinance/resolution templates. Omit or leave blank to automatically use the unique existing session on `date` for ordinances, resolutions, agendas and minutes. Required only to choose between multiple sessions on that date; any supplied ID must match that date, office and term. Empty for executive orders. |
| `attachment_url` | Export reference only; ignored during import. |
| `approval_mode` | For ordinances and resolutions: `authored` (the default when empty or omitted) or `mass_motion`. Mass motion records have no individual author or co-author. Leave empty for other document types. |

Required CSV headers are `title`, `date` and `description`; the other supported headers may be omitted when unused. Unknown or duplicate headers are rejected. Do not add office, role, publication or term columns: authorization comes from the authenticated session and the selected permitted office, while the server assigns IDs and derives terms.

For an ordinance or resolution approved by Mass motion, set `approval_mode` to `mass_motion` and leave both `author_id` and `co_author_id` empty. The committee, document number, date, description and matching session remain required. A supplied author/co-author or an unknown approval mode rejects the batch rather than discarding attribution. Older CSV files without this column continue to use authored approval and still require an author. Use the new column for CMS CSV imports; do not put `MASS MOTION` in an ID column. For a separately prepared Excel bulk seed, `MASS MOTION` in the source AUTHOR cell can identify this approval mode during review without creating an official named Mass Motion.

Ordinances, resolutions and executive orders derive their term from the date. Agendas and minutes use the same-date session and its term. Related officials, committees and sessions must belong to the same office and term. Authors/co-authors exclude the Vice-Mayor, and Reference IDs lists only eligible Sangguniang Bayan authors. Apply migration 021 after 020 for database enforcement. As with Add Document, imported records are published immediately. Review the file before submitting; attach PDFs afterward using each record's Edit form.

The importer checks duplicates within the file and existing records in the selected office/type: number and year for ordinances/resolutions; title and date for the other types. Comparisons ignore case and repeated whitespace. It does not update existing records. Duplicate preflight is not a database uniqueness constraint; avoid submitting the same batch simultaneously in multiple sessions. If a network error prevents confirmation, reload the document list before retrying.

## Export

**Export CSV** downloads published records for the selected office and document type, across all terms. It does not use the list's search, pagination or term selection. Exports contain IDs, text, relationship IDs, the approval mode and attachment links, not PDF bytes. Mass motion exports retain empty author/co-author IDs and `approval_mode=mass_motion`. The export is limited to 5,000 records and 10 MB; oversized exports return an error instead of a partial file.

Exports use UTF-8 with a BOM, quoted cells and CRLF line endings. Potential spreadsheet formulas are escaped with an apostrophe. Literal leading apostrophes are doubled so the CSV parser can reverse this convention. Exported IDs prevent accidental re-import; use the blank template for genuinely new documents.

## Permissions and verification

Legislative editors/managers with write access can import; viewers can export only. Executive staff cannot import or export Legislative records through these endpoints. Superadmins retain access to active Legislative offices. Server actions verify current staff/office access, related database records and terms; the authenticated Supabase client retains RLS enforcement. No service-role client is used.

Local checks:

Stop any running `npm start` instance before rebuilding: that production process keeps the previous build in memory while `npm run build` replaces its files. Restart it after the build finishes. For day-to-day local editing, use `npm run dev`. Run only one website server on port 3000; `EADDRINUSE` means another instance is already listening. The development command is `npm run dev`, not `npm start dev`.

```sh
npx playwright test --config playwright.data.config.ts tests/data/document-csv.spec.ts tests/data/legislative-terms.spec.ts
npm run typecheck
npm run lint
npm run build
npx playwright test --config playwright.transfer.config.ts
```

The browser suite uses an isolated Supabase transport fixture on port 3019. Database tests run real migrations in PGlite. Neither applies hosted migrations, changes live records, nor deploys the website.

Validation: six CSV parser/export tests and five Legislative Term database tests passed, including multi-row ordering and complete rollback on an invalid second row. TypeScript, lint and the production build passed. All eight desktop/mobile browser scenarios passed: actual CSV downloads, multi-record imports, preserved selection after submission, invalid-batch rejection, duplicate checks beyond the first database page, reference/term/office validation, viewer export and denied Executive/forged import requests. The fixture deliberately limits relevant database pages to one row to verify complete pagination. Desktop/mobile screenshots were reviewed. Windows test-server teardown was interrupted after all assertions passed, producing cleanup exit 1; this was not an assertion failure. Hosted Supabase/Vercel behavior was not tested.
