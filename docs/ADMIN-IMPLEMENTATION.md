# Administration implementation inventory

> Current model: Legislative has one office, **Legislative Access**, using the same office permissions as Executive offices. Apply migration 007 after 001-006. See [current setup](LEGISLATIVE-IMPLEMENTATION.md). No module permissions or separate SB/VMO/Secretary access remain.

## Created

- `supabase/migrations/202610010004_office_access.sql`: additive migration, roles, offices, memberships, ownership, RLS, safe profile/access RPC, audit triggers, and 16 initial offices.
- `app/(public)/layout.tsx`: original public header/footer shell.
- `app/login/layout.tsx`: standalone authentication shell.
- `components/admin/AdminShell.tsx`, `SidebarNav.tsx`: administration sidebar/topbar driven by authorized offices.
- `app/superadmin/layout.tsx`, `page.tsx`, `users/**`, `offices/**`, `audit/page.tsx`: Super Admin dashboard, account provisioning/edit/access/reset, office CRUD, audit viewer.
- `app/admin/content/page.tsx`: office-aware collection selection.
- `app/account/layout.tsx`, `actions.ts`, `PasswordForm.tsx`: private profile layout and self-service password change.
- `lib/auth/config.ts`, `admin.ts`: auth configuration independent of public content mode; server-only privileged Auth client.
- `lib/offices/permissions.ts`, `server.ts`: shared role/office permission model and authorized office data.
- `lib/admin/users.ts`: account/password/assignment input validation.
- `scripts/check-auth.mjs`: read-only configuration diagnostics.
- `tests/data/offices.spec.ts`: migration/RLS tests.
- `tests/administration.spec.ts`, `tests/fixtures/supabase.mjs`, `playwright.administration.config.ts`, `playwright.public.config.ts`: isolated browser authentication/admin workflow tests.

## Modified or moved

- `app/layout.tsx`: keeps document metadata/styles; public chrome moved to the public layout.
- Existing `app/page.tsx`, `contact`, `executive`, `legislative`, `news`, `search`, `services`, and `transparency` moved under `app/(public)/` without URL changes.
- `lib/auth/server.ts`, `proxy.ts`, `app/login/actions.ts`, `app/login/page.tsx`: new roles, deleted status, protected Super Admin routes, correct role landing pages.
- `app/admin/layout.tsx`, `page.tsx`, `content/**`: dedicated shell and office-scoped lists/forms/server authorization; existing `/admin/users` redirects to protected `/superadmin/users`.
- `app/account/page.tsx`, `app/staff.css`: profile and responsive admin styles.
- `.env.example`, ignored `.env.local`: blank server-only administration key entry; existing credentials preserved.
- `package.json`, Playwright configurations, `tests/auth.spec.ts`: scripts and route/layout checks.
- `docs/AUTH.md`, `docs/SUPABASE.md`, `README.md`: upgrade, environment, deployment, and validation instructions.

## Design decisions

Use existing `staff_accounts` as profiles, with global roles `superadmin/admin/editor/viewer`. Per-office levels are `viewer/editor/manager`. Both limits apply. Public content remains anonymously readable if published. Office-restricted admin pages filter published as well as draft data, so administrative lists do not mix in other offices' public content. All writes go through user sessions and database RLS except the strictly server-side Supabase Auth Admin operations.

Existing unowned content is restricted to Super Admin management until explicitly assigned. The legacy `departments` content collection remains separate from the authorization `offices` directory, preserving the current public site's data model. Staff deletion is soft; office deletion is restricted by foreign keys. Audit logs retain attribution and action summaries.

No hosted database mutation, production deployment, real account creation, or email delivery was performed during implementation. The migration and server key require manual setup as detailed in AUTH.md.

## Validation recorded on October 1, 2026

- 56 database/adapter/permission tests passed.
- All 8 administration browser test assertions passed across desktop and mobile, including account creation and password reset.
- All 12 public-site browser test assertions passed across desktop and mobile.
- TypeScript, ESLint, and the production build passed.
- All 23 moved public route files were compared against their prior Git versions; their contents were unchanged.
- Browser-built static assets contained neither the server administration-key variable nor the fixture secret.
- The local `/login` route responded successfully with the standalone layout on port 3000.

The Windows browser test runners stalled during final cleanup after reporting all test cases as successful and were interrupted. Browser assertions passed, but those interrupted runner processes did not finish with a clean exit code. Test output folders are now separated between data, authentication, administration, and public suites.

A final read-only hosted check still returned 404 for `offices`, `user_office_access`, and `audit_logs`; the local administration-key setting was blank. Apply the migration and configure the key before testing real admin workflows. No authenticated live/Vercel account test was performed.

Official integration references: [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
