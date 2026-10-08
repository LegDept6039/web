# Migration workflow

Inspect ordered `supabase/migrations/*.sql` and the affected policies/triggers before extending the schema. Add a new incremental migration for installed systems instead of rewriting already-applied history. Preserve IDs, memberships, historical content, authorship and uploaded-file references. Surface ambiguous mappings; do not silently choose or discard records.

Current lineage:

- 001-004: content, Storage, staff auth and office-based access.
- 005-006: historical Legislative module permissions and official photos.
- 007: consolidates Legislative Access and archives obsolete module choices.
- 008: department ownership/profile pages and head uploads.
- 009: renames former offices to canonical departments, preserves UUID/FK relationships, privately archives old profiles, adds contacts and slug aliases.
- 010: restricts Department identity/publication/order/access changes through the existing protection trigger. Permanent deletion remains blocked.

Optional historical `supabase/seed.sql` belongs before 008 in an isolated initial setup. Do not rerun it on the consolidated schema. Historical tests intentionally check older upgrade stages; they are not permission specifications for the latest application.

For manual SQL Editor setup, instruct the user to run file **contents**, in order, not filenames. Check installed migration state before advising reruns. See `docs/DYNAMIC-DEPARTMENTS.md` for 009 conflict rollback behavior and upgrade details. Do not claim hosted state from file presence.

Use PGlite tests in `tests/data/dynamic-departments.spec.ts` for preservation, RLS, cross-office writes, identity changes, aliases and deactivation; adapter tests cover publication/ownership filtering and failure behavior. Include migration-specific tests when changing those guarantees. Report required manual steps and local-vs-live validation explicitly; production mutation requires the user's explicit instruction.
