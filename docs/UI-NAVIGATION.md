# Public navigation, ordering and activities

## Changes

The homepage keeps its static hero/introduction available while independent content sections stream through Suspense. Public, Admin and Superadmin route groups have lightweight content loading boundaries inside their persistent layouts. No delay, extra dependency, or client-side fetch cycle was added. Initial authentication/layout queries still complete before protected layouts render.

Homepage database requests are bounded: four published Legislative officials with a recognized role, four active/published/nonarchived Executive departments, three news items, four services, two sessions and three Executive programs. Canonical `sort_order ASC, id ASC` ordering determines positions; migration 012 normalizes published positions to 1 and above; positions 1-4 represent the first four eligible records. Full directories remain unrestricted. Reads remain uncached across requests so saved order/publication edits appear without redeployment.

Sort Order is visible in the content management table and Superadmin department table. Existing edit controls and authorization remain authoritative. Department order belongs to Superadmin; authorized Legislative staff retain their existing official edit permissions.

Navigation uses click/tap toggles, one open dropdown, outside-pointer dismissal, Escape with trigger focus restoration, close-on-navigation, and dismissal when keyboard focus leaves the header. Listeners exist only while navigation is open and are cleaned up. Existing navigation entries remain; Executive links include Municipal Mayor and Executive Departments.

New public routes `/mayor` and `/activities` reuse the existing Executive pages. `/executive/mayor` and `/executive/activities` remain supported. Mayor data is read from published Executive officials using the existing `Office of the Municipal Mayor` role label; no person is invented. If no matching record exists, the existing pending-information presentation remains. The programs link now sits alongside View Executive Departments.

Activities reuses NewsDirectory search/reset/cards with an optional Department filter. Options come from current public Executive departments; values are stable UUIDs matched against news.office_id. News.category remains intact on general news pages. NewsSource continues using the published database relationship, including current names and only eligible department links. Historical unassigned records remain in All Departments and are not assigned arbitrarily. Selecting a department shows only news owned by its UUID.

Existing news ownership enforcement was inspected and preserved: single-office editors receive automatic assignment, multi-office users choose only permitted offices, and server actions validate current memberships and existing record ownership. RLS remains independent enforcement.

Department contacts use compact responsive groups, smaller icons, wrapping labels/values and the existing tel/mailto links. Empty categories remain hidden.

## Main files

- `lib/content/{repository,supabase}.ts`: bounded reads and filter support.
- `components/home/HomeContent.tsx`, `LeadershipSection.tsx`, `app/(public)/page.tsx`: streamed, bounded homepage sections.
- `components/layout/Header.tsx`, route-group `loading.tsx`, `components/shared/SectionLoading.tsx`.
- `components/news/NewsDirectory.tsx`, Executive activities/mayor pages, new route aliases.
- `components/departments/DepartmentContacts.tsx`, `app/globals.css`, content and Superadmin ordering tables/forms.

## Deployment

The later admin-authoring changes require migration 012 after 011. See [Admin authoring](ADMIN-AUTHORING.md) for current publication rules and deployment steps. No live database operation was performed. These changes do not resolve the separately documented Vercel photo request-size limitation.

## Validation

- `npm run test:data`: 103 passed, including bounded homepage reads, stable ordering, publication filters and existing SQL/RLS tests.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed; the final build also checked TypeScript.
- `npm run test:admin`: 60 passed. The added Legislative four-card/order-edit test then passed on desktop and mobile (62 distinct admin-suite scenarios in total; the full suite includes six SQL test executions).
- `npm run test:public`: initially 15 passed and one mobile test assertion failed because the correctly hidden navigation button was excluded by its role locator. Corrected the assertion. The final homepage/navigation rerun passed all four desktop/mobile scenarios, covering all 16 distinct public scenarios across runs.
- Reviewed desktop/mobile activities and department-contact screenshots. Existing overflow, image, authentication, ownership and publication regressions passed.
- Browser suites exited cleanly. Expected invalid-refresh-token logs occurred in the deliberate stale-session recovery tests, which passed.

Tests use isolated fixtures/PGlite; no hosted Supabase/Vercel verification or deployment was performed. No production performance benchmark or numerical layout-shift measurement was run; the changes bound homepage reads and add streaming without claiming measured latency improvements. Initial protected-layout authentication remains blocking. Existing unrelated whitespace in `components/home/TourismFeature.tsx` was preserved.

## Mayor profile layout

The mayor information section now uses a portrait-left, details-right profile: database name, Municipal Mayor title, database description and two spaced navigation links. Mobile stacks the portrait above the details. The standalone official card and duplicate introduction were removed. Existing data lookup, missing-image fallback and both mayor routes remain. Build/TypeScript and component lint passed; local sample-content browser checks verified both routes, desktop/mobile layout, links and no horizontal overflow.


## Skeleton loading states

Public/root route fallbacks use `PublicPageSkeleton`; homepage Suspense sections reuse `SectionLoading` with structured card placeholders. Admin, Superadmin and account routes use `AdminSkeleton` for content, and their layouts wrap the existing guarded layout in Suspense with a full-shell skeleton. `StaffSessionBoundary` uses the same shell only while checking the session; expiry/failure messages remain visible text. No authorization checks were removed or deferred until after protected content is shown.

The shared CSS includes responsive cards, status announcements, decorative aria-hidden placeholders and reduced-motion support. These are real loading boundaries with no artificial delay. Fast cached responses may show little or no skeleton. No new migration or dependencies are required.

Validation: build (including TypeScript) and lint passed; six existing desktop/mobile login/access browser scenarios passed. Rendered public/admin skeleton previews at 1440px and 390px were reviewed and checked for overflow, a single accessible status and disabled animation under reduced motion. Windows browser-test teardown was interrupted after all six assertions passed.

### Shared admin office dropdowns

Transparency now appears as one expandable entry under Offices/Your offices, with Reports and Modules nested inside. The existing Transparency access check controls visibility. The group expands automatically for its routes, and only the matching section is highlighted, including edit/new pages. Admin and Superadmin share this navigation. Desktop/mobile checks passed for grouping, collapse/expand, keyboard activation, navigation, active state and overflow; screenshots were reviewed. Build/TypeScript and targeted lint passed. No database migration is required.

Admin and Superadmin now reuse OfficesNav for expandable office navigation. Assigned active offices and available modules are still resolved through the existing server-side access helpers. Office overview preserves access to each office dashboard; the selected office expands automatically, with active module highlighting and keyboard-operable toggles.

Validation: production build (including TypeScript) and lint passed. Legislative dropdown navigation passed on desktop and mobile, including collapse/expand, keyboard activation, module navigation, and absence of Superadmin-only links. Screenshots were reviewed. The fixture test server hung during Windows teardown and was interrupted after both scenarios passed; the command exited 1 during cleanup. No live data or permissions were changed.

### Legislative member cards

`/legislative/members` uses the shared OfficialGrid directory variant with clearer name/role hierarchy, a divider before descriptions, and compact four/two/one-column layouts. Portraits are 160px tall, with tighter card padding and readable 14px descriptions. CMS description line breaks are preserved with `white-space: pre-wrap`; committee assignments stay left-aligned for readability. Other OfficialGrid descriptions also preserve line breaks. No content migration is required.

Validation: TypeScript and targeted lint passed. The live local directory was checked at 1440px and 390px, confirming preserved newlines and no horizontal overflow; both screenshots were reviewed.

### Admin route skeletons

Admin content navigation now has nested loading boundaries for office content, collection lists, new records, edit records, module shortcuts, and users. They reuse dashboard, table, and form variants in `components/shared/PageSkeleton.tsx`. The existing protected-layout/session-check skeleton remains in place, and the sidebar stays interactive while page data streams. Cached pages can render immediately; there is no minimum loading timer or production delay.

The UI skill in `.agents/skills/municipality-ui-admin/SKILL.md` documents these patterns for future admin pages. Skeletons announce one loading status, hide decorative shapes from screen readers, and disable animation for reduced-motion preferences.

Run the isolated slow-response checks with `npx playwright test --config playwright.loading.config.ts` after building. That configuration uses port 3013 and opt-in fixture-only database latency; ordinary tests and live Supabase requests are unaffected.

Loading verification: production build, TypeScript and lint passed. Desktop and mobile slow-navigation scenarios passed for list, create and edit pages, including skeleton replacement, reduced motion and mobile overflow; screenshots were reviewed. The mobile test locator was corrected to wait for the collapsed navigation by its DOM ID before opening it. Windows fixture teardown required interruption after successful assertions (command exit 1 during cleanup). Skill frontmatter was parsed and checked with js-yaml; the bundled Python skill validator could not run because PyYAML is not installed.

### Compact committee directory

`/legislative/committees` uses searchable expandable rows for larger committee lists. Each summary shows the committee name and chairperson; opening it displays responsibilities, vice-chairperson and all four supported CMS member slots that resolve to published officials. Search covers committee names, responsibilities and member names. Existing CMS order is retained. Descriptions preserve line breaks, missing assignments have clear empty states, and the sample notice appears only when sample committees are present.

The page reuses existing committee/official data adapters and CMS assignments. No migration is required. TypeScript and targeted lint passed. Desktop (1440px) and mobile (390px) checks verified keyboard expansion, displayed membership, search/clear behavior and no horizontal overflow; screenshots were reviewed against the four currently published committee records.

### Committee description editing

The committee create/edit form now exposes the existing `responsibility` field as **Committee description (optional)**, with a 500-character limit and a live character counter. The save handler validates the limit and supports replacing or clearing existing sample text. The public Responsibilities section reads the saved value, preserves newlines, wraps long words and hides when empty. Existing descriptions are not truncated automatically; no SQL migration is needed.

Validation: TypeScript and the focused parser test passed, covering create, edit, clear, the 500-character boundary and rejection of 501 characters.

### Stable committee edit links

Committee routes use the stored primary key, never the editable title. Historical seed IDs such as `finance` remain valid immutable identifiers; newly created committees receive server-generated UUIDs. Renaming does not re-key records or break related documents.

Admin edit links now use each record's stored owning office. After verifying record access, the edit route redirects stale office query parameters to the canonical owner instead of returning 404. Legislative updates retain the existing record's office instead of selecting the first Legislative office. Missing and unauthorized records still return not-found.

Four focused tests passed for description validation, rename/UUID stability, stale-office redirects and denied/missing records. A live Supabase read could not complete (fetch failed), so the reported live 404's exact cause was not confirmed. No data migration or live record changes were performed.

### Legislative Terms

Legislative public directories and the admin overview now offer a compact term selector, defaulting to the current Philippine-date term. Superadmin manages dates and names under `/superadmin/legislative-terms`. Officials/Committees select a term; dated records display a derived read-only term and filter their relationships accordingly. See `docs/LEGISLATIVE-TERMS.md` for migration 019 and deliberate adoption of historical records.

### Council directory spacing

Page titles (`h1`) and public/admin breadcrumb labels use Proper Case through the shared stylesheet, for example **Council Sessions** and **Your Municipal Council**. This presentation rule preserves existing acronyms and CMS content; descriptions, form values, URLs and stored titles are unchanged.

`/legislative/members` uses a shorter hero and a compact directory toolbar with the published official count and term selector. Dates use readable month names. On mobile the selector stacks below the directory heading and fills the available width. The existing four/two/one-column official cards, CMS descriptions and term filtering are preserved; empty selections show an explanatory message. These styles are scoped to the council page and the selector's opt-in compact variant.

Build and lint passed. The existing public term-filtering scenarios passed on desktop/mobile, and both council screenshots were reviewed. The Windows browser test server was interrupted after both scenarios passed because teardown remained running.

### Legislative CSV controls

The Legislative document toolbar and Add Document screens include compact **Import CSV** and **Export CSV** buttons. Accessible dialogs provide a document-type selector, template/reference-ID downloads, file validation feedback and an import progress state. Controls wrap on small screens; the dialog scrolls within the viewport. Import visibility follows existing write access and export follows read access, with the same checks repeated on the server. See [LEGISLATIVE-IMPORT-EXPORT.md](LEGISLATIVE-IMPORT-EXPORT.md) for the CSV columns, term relationships, limits and attachment behavior.

### Master Committee Catalog

`/superadmin/master-committees` manages the shared database catalog and display order. Legislative Access > Committees now shows a compact per-term table with chairperson, vice-chairperson, members, publication status and composition actions. Unsaved templates are explicitly unassigned; historical records requiring association remain editable in a separate review table. The existing form supports empty official positions and term-filtered choices. Both routes reuse the admin loading skeleton. Public committee directories still show saved, published records only. See [MASTER-COMMITTEES.md](MASTER-COMMITTEES.md) for migration 020 and historical-name preservation.

### Admin Table Pagination

Admin content lists, Legislative documents and committee compositions, Transparency reports/modules, and Superadmin users, departments, master committees and terms use shared `AdminPagination` controls. Tables display 25 records per page; the audit log retains 50. The footer shows the visible range and total, with numbered pages and Previous/Next controls when more than one page exists. Controls wrap on small screens and identify the current page for assistive technology.

Page links retain office, term, search, type, sort, module and year filters. Applying new filters resets the page. The committee catalog and preserved historical compositions paginate independently, with both resetting when the term changes. Inline master/term edit forms retain their selected record when paging the table. Invalid page values use page one; pages beyond the last record clamp to the last available page.

Existing database-paginated tables apply authorization and filters before counting/ranging. Committee and Transparency views paginate their existing authorized, filtered lists after composing their catalog/count information; dropdown choices and module document counts still use the full permitted dataset. Content, storage, permissions and database migrations are unchanged.

Verification: `npx playwright test --config playwright.pagination.config.ts` uses an isolated fixture containing multiple pages of records, including foreign-office controls. Focused range/query checks are in `tests/data/admin-pagination.spec.ts`.

Validation: type check, full lint, production build and seven focused pagination tests passed. All eight desktop/mobile browser scenarios passed, covering record counts, ordering, office/term/filter preservation, independent committee tables, empty results, out-of-range pages and responsive controls. Desktop/mobile screenshots were reviewed. Windows test-server teardown was interrupted after all browser assertions passed (cleanup exit 1). These are local fixture checks; no hosted data or deployment was changed.
