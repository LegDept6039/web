# Current implementation map

Paths below are relative to the repository root. Verify the code for the requested change; these notes describe migrations 009-010, not proof of the live database version.

| Area | Source |
| --- | --- |
| Public layouts and routes | `app/(public)/`, including `departments/[slug]/page.tsx` |
| Public content | `lib/api/index.ts` -> `lib/content/repository.ts` -> `lib/content/supabase.ts`; mappings/validation in `lib/content/schema.ts`, domain types in `types/index.ts` |
| Content editing | `app/admin/content/ContentForm.tsx`, `actions.ts`, generic collection routes |
| System management | `app/superadmin/departments/`, `app/superadmin/users/`; actual user actions also in `app/admin/users/actions.ts` |
| Staff shell | `components/admin/AdminShell.tsx`, `app/staff.css` |
| Current architecture notes | `docs/DYNAMIC-DEPARTMENTS.md` |

Department reads require active, published, nonarchived Executive records. Detail lookup uses the database slug; old aliases redirect to the current slug. News/program/contact requests filter by the department UUID. Missing/inactive/unpublished details use not-found. Directory emptiness stays empty. Legacy Executive department URLs redirect to canonical routes.

Authentication has an independent Supabase configuration; explicitly choosing mock public content does not disable configured staff authentication. Public headers/footers belong only to the public route group. Login is entered by URL; do not add public login links.

## Checks matched to changes

Use `npm run typecheck`, `npm run lint`, `npm run build` for application changes. Use `test:data` for adapters/migrations/RLS, `test:admin` for staff workflows and `test:public` for public UI. On this Windows shell use `npm.cmd` when PowerShell blocks npm.ps1. Build before production-server browser suites.

Data tests execute SQL in PGlite. Admin tests use isolated Supabase transport; public tests explicitly select mock mode. Neither verifies hosted production. If Windows Playwright teardown hangs after assertions, stop only owned sessions and distinguish passed assertions from an interrupted command. Documentation-only skill edits need skill validation and link checks, not an application rebuild.
