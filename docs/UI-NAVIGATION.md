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
