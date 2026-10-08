> Migration **009** consolidates the Department system. See [Dynamic departments](DYNAMIC-DEPARTMENTS.md) for the current architecture and deployment steps.

# Department ownership and public pages

## Apply before deploying this version

Run the **contents** of `supabase/migrations/202610020008_department_scope.sql` in the Supabase SQL Editor after migrations 001-007. Do not paste the filename as SQL. Then deploy/redeploy the updated application. No environment variable changes are needed. This migration has been tested locally; it has not been applied to your live project by this change.

Migration 008:

- Adds `departments.slug`, `head_name`, `head_title`, and `head_photo`. Slugs are unique, validated, and initially use existing IDs.
- Reuses the existing `office_id` foreign keys on departments, news and programs; adds no duplicate department/access model.
- Links the six original sample directory records to their known Executive offices. Creates unpublished profiles for Executive offices without profiles. Newly created Executive offices automatically receive an unpublished profile.
- Replaces content management RLS policies with branch-aware checks. Executive users manage only their office's department profile, news and programs. Legislative Access retains its existing branch collections. No account role or per-user module permission is added.
- Requires ownership when news, programs or department profiles are created/edited. Existing unassigned content is preserved; a Superadmin must assign an office when editing it. No arbitrary department ownership is guessed.
- Adds department-head Storage upload policies. Files are validated/re-encoded on the server; existing and replaced uploads are retained. Referenced profile photos cannot be deleted through the cleanup policy.
- Adds the read-only `published_news` projection: published article fields plus source name and the published Executive department slug. Drafts, staff records and account data are not exposed by this projection.

For a fresh setup, load the optional sample seed **before migration 008**. Do not rerun the sample seed against a production content database. Existing Legislative content, old office attribution, official roles, memberships and files remain intact.

## Admin workflow and authorization

`Your offices` contains office short names and one `Legislative Access` link. No repeated branch prefixes or nested Legislative links. The current office is highlighted; breadcrumbs retain the branch hierarchy.

An Executive office dashboard contains **Department Profile**, **News**, and **Programs**. Open Department Profile and edit the office's existing record to publish its description, head name/title/photo and slug. Publishing the profile makes it available in the public directory. Superadmins create/delete departments; department staff edit their own profiles but cannot transfer ownership. Existing global role and viewer/editor/manager limits still apply (e.g. an editor cannot delete records).

Single-office users receive a read-only ownership label and automatic assignment on the server. Multi-office staff can choose only authorized offices on creation. Ordinary staff cannot transfer an existing record. Admin list queries are filtered by branch and authorized office IDs, even for publicly readable records.

Every action checks the current authenticated staff account and office membership, then checks both the collection and resource ownership. Direct database requests also pass RLS. A forged MHO-to-MENRO insert raises SQLSTATE `42501`, mapped by PostgREST to HTTP 403. The existing website uses Next Server Actions, which return an inline permission error using the action protocol; there is no new duplicate REST mutation API. Unauthorized admin pages use the existing not-found behavior.

Superadmin retains all content, user, office and access-management tools. Existing foreign-key protections still prevent deletion of an office with dependent content; resolve those relationships first.

## Public routes

- `/executive`: dynamic department cards in Municipal Leadership, View All Departments, Executive news/programs.
- `/executive/department`: canonical published Executive directory.
- `/executive/department/[slug]`: head profile, description, and published news/programs matched by `office_id`. Missing sections have explicit empty states.
- `/executive/departments`: permanent redirect to the canonical directory.
- `/news` and `/news/[slug]`: existing pages retained; cards/article headers now show their source and link to a published Executive profile when available.
- `/legislative/ordinances` and `/legislative/resolutions`: shared compact table with wrapping titles, compact metadata/actions, responsive rows, and existing filters/detail links.

Public presentation uses the existing data layer. It does not hardcode department heads or content in pages. Anonymous reads use only the publishable key. Legacy unassigned articles remain on general listings, but cannot appear on an unrelated department detail page.

## Main files

- Authorization: `lib/offices/collections.ts`, `lib/offices/server.ts`, `app/admin/content/actions.ts`, collection list/new routes.
- Sidebar/form: `components/admin/AdminShell.tsx`, `OfficeLink.tsx`, `app/admin/content/ContentForm.tsx`, `app/staff.css`.
- Schema/data: migration 008, `types/index.ts`, `lib/content/schema.ts`, `lib/content/supabase.ts`, `lib/api/index.ts`, `lib/admin/content.ts`, `lib/admin/photo.ts`, `scripts/check-supabase.mjs`.
- Public pages: Executive pages under `app/(public)/executive`, existing news detail, `components/departments/DepartmentGrid.tsx`, `components/news/NewsSource.tsx`, `NewsCard.tsx`, `components/layout/Header.tsx`.
- Shared records layout: `components/legislative/DocumentDirectory.tsx`, `app/globals.css`.
- Tests: `tests/data/department-scope.spec.ts`, `tests/department-admin.spec.ts`, existing Legislative/public suites and their Supabase transport fixture/configuration.

## Verification

- `npm run test:data`: 84 passed. Includes migration execution, branch restrictions, MHO/MENRO isolation, forged office SQLSTATE 42501, photo storage, anonymous source projection and preserved content.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed. Newly published news detail routes now render dynamically instead of attempting static fallback rendering.
- Admin browser coverage: 22 scenarios passed across the full run and targeted reruns (desktop/mobile). Includes Accounting sidebar/collections, Legislative dashboard, Superadmin user management, MHO profile/photo + news/program publishing, forged Server Action rejection, filtered admin lists, general news/article/Executive/MHO placement and MENRO exclusion.
- Public browser coverage: 14 desktop/mobile scenarios, including filters/details/navigation/images, canonical redirect, responsive layouts and very long legislative titles.
- Inspected generated mobile department and long-title table screenshots.

Browser tests use an isolated Supabase transport fixture; database authorization is independently tested against the actual migration SQL in PGlite. This does not claim a live Supabase/Vercel deployment test. The Windows Playwright web-server teardown remained running after the last assertions; owned test processes were interrupted after results were collected (the interrupted command exits 1 despite the successful assertions).
