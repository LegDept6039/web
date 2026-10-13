# Admin authoring and office navigation (migration 012)

## Upgrade

Apply the **contents** of `supabase/migrations/202610100012_admin_authoring.sql` once, after migrations 001-011, using the Supabase SQL Editor. Then deploy this application version. Do not paste the filename as SQL and do not rerun the historical seed. No live database migration or deployment was performed for this change. No new environment variables or Storage configuration are needed.

The migration takes table locks while normalizing positions, so schedule it when editors are not saving records. The transaction preserves record IDs, slugs, office assignments, text, images and uploaded-file references. It assigns positive positions to published records in their existing `sort_order, id` order within each scope; unpublished records become zero. It does not publish drafts or unpublish existing records. Deployment requires 012 because the public projections now include `rich_body`.

## Publication and sorting

Unpublished records have position 0 and no visible sort input. Check Published, then explicitly choose a positive position in the available range. A new record starts unpublished (Contacts retain their existing published default but still require an explicit position). Existing published records retain their current position. The numeric selector shows the collection's current range; stale ranges are checked again by PostgreSQL.

Selecting an occupied position shifts neighboring records. Moving, unpublishing and deleting close the old gap; publishing or transferring opens the chosen slot. Sorting uses the existing `sort_order` column. Department identities are ordered by branch; other collections are ordered by content branch and owning department UUID. Legislative officials share the unified Legislative Access scope. Homepage queries still take the first four eligible records in stable sort order; positive positions 1-4 represent those first four.

The database trigger authorizes the caller before shifting siblings, uses transaction-scoped advisory locks for affected scopes, and checks duplicate published positions at commit. Existing RLS and department identity guards remain in place. Department publication/order remains Superadmin-only. Shifted siblings receive normal updated timestamps/audit events, so existing optimistic `updated_at` checks reject stale saves. Conflicts or deadlocks roll back and ask the editor to reload; they are not silently retried over another edit. Local database tests use a single PGlite backend, not a multi-connection hosted concurrency stress test.

## Rich text

News Content and Program Body use an admin-only, dynamically loaded Tiptap editor. Supported controls: bold, italic, underline, bullet/numbered lists, paragraph, small/normal/large text, Undo/Redo and Clear formatting. Explicit toolbar operations form separate undo steps. Paste accepts plain text; links, images, HTML embeds and arbitrary CSS are not supported in article bodies. Existing image upload controls remain separate.

Nullable `news.rich_body` and `programs.rich_body` hold validated JSON, not HTML. Application validation limits node types, child relationships, marks, attributes, depth, node count and text length. Database constraints independently reject unsupported nodes/attributes and oversized documents. The shared public `RichText` component emits escaped React text and a fixed set of elements. No `dangerouslySetInnerHTML` is used and the editor bundle is not imported by public components.

Legacy news paragraph arrays and program descriptions are adapted on read/edit without rewriting historical content. Once formatted news is saved, its existing `content` array is maintained as a plain-text compatibility projection for existing readers. Program `description` remains the short summary, separate from the new formatted Body. Legacy programs without `rich_body` still render their description. New editor submissions require nonempty body text. Previously supported plain-text clients remain accepted by server parsing.

Required labels use shared red-star styling derived from actual HTML required fields, with native validation semantics. The editor declares `aria-required` and reports empty content through client and server validation. Optional fields remain unmarked; user office assignment retains its existing optional setup behavior.

## Office navigation and public cards

Superadmin retains independent Dashboard, Departments, Users and Audit links plus global content management. The separate Offices section comes from active database departments. Only one office expands at a time. Current office/module follows the URL, and mobile navigation closes after following a module link. Executive offices show only their four applicable collections; Legislative Access uses existing branch/collection metadata for its additional modules. Global Superadmin authority and resource ownership checks are unchanged.

The department detail News section reuses `NewsCard` with a compact variant: smaller image area, tighter padding, and limited title/excerpt lines. Other news listings keep their current presentation. Department filtering and publication rules are unchanged.

## Files

- Database: `supabase/migrations/202610100012_admin_authoring.sql`.
- Authoring: `components/admin/RichTextEditor.tsx`, `PublicationFields.tsx`; `app/admin/content/{ContentForm.tsx,actions.ts,position-actions.ts}`; `lib/admin/{content.ts,publication.ts}`; department `OfficeForm.tsx` and actions; required Role selector in `app/superadmin/users/UserForm.tsx`.
- Rich data/rendering: `lib/content/{rich-text.ts,schema.ts,supabase.ts}`, `types/index.ts`, `components/shared/RichText.tsx`, public news/program detail pages; `package.json` and lockfile.
- Navigation: `components/admin/{AdminShell.tsx,OfficesNav.tsx}`, `lib/offices/server.ts`, content edit canonical office URLs.
- Presentation: `app/{globals.css,staff.css}`, `components/news/NewsCard.tsx`, public department detail page.
- Diagnostics/docs: `scripts/check-supabase.mjs` checks the new public projection columns; this guide, `SUPABASE.md`, `DYNAMIC-DEPARTMENTS.md`, `CONTENT-WORKFLOWS.md`, `UI-NAVIGATION.md`, and README link the current upgrade.
- Tests: new `tests/admin-authoring.spec.ts`, `tests/data/{admin-authoring,rich-text}.spec.ts`; adapted content-workflow, department, dynamic-department and legislative browser tests; Supabase transport fixture and administration config.

## Validation

- `npm run test:data`: all 110 tests passed.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `npm run test:public`: all 16 desktop/mobile cases passed.
- Full admin run: 71 checks passed and three initially failed (the forged-access scenario on both viewports reached the new required-content check first; mobile formatting lost its text selection). The test precondition and touch selection handling were corrected. The final focused run passed all 14 desktop/mobile cases, including all three failures, rich formatting/clear/undo/redo/save/restore, literal script-text rendering, scoped deletion, uploads, programs and publication. Together these runs cover 62 browser scenarios plus 14 repeated SQL checks in the existing admin configuration.
- Desktop/mobile editor, public formatted content, compact news and Offices navigation screenshots were reviewed. Final mobile Offices width received a separate navigation rerun: both desktop and mobile passed (2/2).
- Database checks cover legacy content/relative-order preservation, positive positions, shifting/unpublishing/deleting, separate scopes, stale-write rejection, protected department publication, viewer denial and unsafe JSON rejection.

Browser tests use an isolated Supabase transport fixture; database tests execute actual migration SQL in PGlite. These checks do not claim verification of a live Supabase/Vercel deployment. The deliberate expired-refresh-cookie test logs its expected Auth error while passing recovery assertions. A trial standalone React-renderer test encountered Playwright's JSX transformation and was replaced by the passing real-browser script-text scenario. `git diff --check` also reports a pre-existing trailing space in `components/home/TourismFeature.tsx`, outside this change.

After applying 012 and deploying, smoke-test publishing/reordering, one formatted news article and program, and the Offices menu using actual staff accounts.
