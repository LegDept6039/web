# Approved Legislative document seed

Status: **applied and verified on November 26, 2026**. The user confirmed SQL Editor completed successfully. Read-only hosted checks verified 69 new ordinances and 141 new resolutions; all 210 are publicly visible.

The user approved importing the 210 records with resolved references and one existing session on each document date:

| Collection | Documents |
| --- | ---: |
| Ordinances | 69 |
| Resolutions | 141 |
| Total | 210 |

These records cover 212 Excel source rows: two pairs of exact duplicates are consolidated into one document per pair. The remaining **446 source rows are held**, including Excel rows **501 and 537**, which have multiple co-authors. The seed does not import held records or choose between unresolved conflicts.

Hosted totals are now 74 ordinances and 142 resolutions, including the six preexisting documents. All imported author/co-author, committee, session, term and office references match. The preexisting 15 terms, 162 officials, 375 committees, 26 sessions, five ordinances and one resolution are unchanged. No held-only document identity was added. See [`hosted-verification.json`](../outputs/legislative-seed-review-20261126/hosted-verification.json).

The workbook does not supply full document bodies or PDFs. As expressly approved, each imported document uses its **title as the temporary body/summary**, with no PDF attachment. Original title text and line breaks are retained; the workbook's BODY formula labels are not treated as full document text.

## Apply the seed

1. Confirm migration **037**, `202611260037_document_mass_motion.sql`, has been applied. The user has confirmed it finished successfully.
2. Open [`20261126_legislative_documents_ready.sql`](../supabase/imports/20261126_legislative_documents_ready.sql).
3. Run the file's **complete contents** in Supabase SQL Editor. The file is one transaction; do not execute selected fragments.
4. Check the two result rows. On the first successful import, expect:

   | collection | approved_documents | inserted_documents | reused_documents |
   | --- | ---: | ---: | ---: |
   | ordinances | 69 | 69 | 0 |
   | resolutions | 141 | 141 | 0 |

An exact rerun reports zero inserted records and 69/141 reused records. If an exact matching record was already present before the first run, its reused count may be higher and its inserted count lower; their sum must remain 69 or 141 respectively.

SQL Editor stored Windows CRLF line endings in the imported titles and summaries. All other characters and line-break positions match the source, and each saved summary exactly equals its saved title. The importer compares titles exactly on reruns, so using a different newline encoding will abort as a content conflict without changing records.

The seed resolves the existing 2025–2028 term, Legislative office, term-specific SB authors/co-authors and committees, and existing sessions by document date. The explicit Julius Erwin T. Alpas name variant reuses the registered Julius Erwin Alpas identity. It creates no officials, sessions, terms, committees, staff assignments, or files.

Existing document IDs, content, authorship, links, publication, order, timestamps and referenced records remain unchanged. New published records are appended. Any missing or ambiguous reference, conflicting number/year, unexpected guard state, or preservation-check failure aborts the entire transaction. Do not work around an error by disabling additional triggers or deleting an existing record; review the reported conflict first. An exact rerun skips matching records without rewriting them or adding audit entries.

## Review and verification

- [`20261126_legislative_documents_ready_manifest.json`](../supabase/imports/20261126_legislative_documents_ready_manifest.json) records the selected source rows and held records.
- [`seed-review.md`](../outputs/legislative-seed-review-20261126/seed-review.md) explains the source audit and exclusions.
- [`legislative-documents-seed.spec.ts`](../tests/data/legislative-documents-seed.spec.ts) passed **8 local SQL tests** against the actual migration 001–037 lineage, covering counts, references, preserved data/access, rerun idempotence, conflict rejection, and rollback after writes to both collections.

Run the focused checks with:

```powershell
npx.cmd playwright test --config playwright.data.config.ts tests/data/legislative-documents-seed.spec.ts
```

The local tests and hosted checks are separate: the eight tests exercise SQL behavior, while the November 26 read-only checks confirm the actual imported records, preserved references and public visibility.
